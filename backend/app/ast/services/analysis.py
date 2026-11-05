"""AST indexing and evidence mapping over ARVE's immutable scan workspace."""
from __future__ import annotations
import hashlib, logging, re
from datetime import datetime
from pathlib import Path
from app.ast.engine import SCHEMA_VERSION, detect_language, normalize_and_link, parser_versions, parse_source, validate_output
from app.ast.engine.extractors.python import extract_python
from app.ast.engine.extractors.javascript import extract_javascript
from app.ast.engine.extractors.typescript import extract_typescript
from app.ast.engine.extractors.java import extract_java
from app.ast.engine.extractors.php import extract_php
from app.ast.engine.extractors.go import extract_go
from app.models.models import ASTAnalysisRun, ASTFile, ASTSymbol, ASTRelationship, SecurityContext, SecurityFinding
logger=logging.getLogger(__name__)
EXTRACTORS={"python":extract_python,"javascript":extract_javascript,"typescript":extract_typescript,"java":extract_java,"php":extract_php,"go":extract_go}
MAX_FILES=5000
MAX_BYTES=200*1024*1024
MAX_FILE_BYTES=1024*1024
ROUTE_RE=re.compile(r"""(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]""",re.I)
INPUT_RE=re.compile(r"\b(req\.(?:params|query|body|headers)|request\.(?:params|query|body|headers))\b")
OP_RE=re.compile(r"\b(query|execute|exec|findOne|findMany|insert|update|delete|unlink|readFile|writeFile|spawn|execSync|jwt\.verify|verifyToken)\s*\(")
class ASTAnalysisService:
    def __init__(self, db): self.db=db
    def analyze_and_persist(self, scan, workspace):
        prior=self.db.query(ASTAnalysisRun).filter(ASTAnalysisRun.scan_id==scan.id).first()
        if prior and prior.status in {"COMPLETED","PARTIAL"}: return prior
        if prior: self.db.delete(prior); self.db.flush()
        run=ASTAnalysisRun(scan_id=scan.id,project_id=scan.project_id,commit_sha=scan.commit_sha,
            schema_version=SCHEMA_VERSION,parser_versions=parser_versions(),status="RUNNING")
        self.db.add(run); self.db.flush()
        paths=sorted(p for p in Path(workspace).rglob("*") if p.is_file())
        run.files_discovered=len(paths)
        if len(paths)>MAX_FILES: raise ValueError(f"AST file limit exceeded ({len(paths)} > {MAX_FILES})")
        total=sum(p.stat().st_size for p in paths)
        if total>MAX_BYTES: raise ValueError(f"AST workspace size exceeds {MAX_BYTES} bytes")
        files=[]; file_sources={}; errors=[]; unsupported=0
        for path in paths:
            rel=path.relative_to(workspace).as_posix()
            detected=detect_language(rel)
            if not detected:
                unsupported+=1; continue
            if path.stat().st_size>MAX_FILE_BYTES:
                errors.append(f"{rel}: file exceeds {MAX_FILE_BYTES} bytes"); continue
            try:
                source=path.read_text(encoding="utf-8")
                grammar=detected["grammar"]; language=detected["language"]
                tree=parse_source(source,grammar)
                data=EXTRACTORS[language](tree,source,rel)
                data["language"]=language
                data["has_syntax_errors"]=bool(tree.root_node.has_error)
                files.append(data); file_sources[rel]=source
            except Exception as exc:
                errors.append(f"{rel}: {type(exc).__name__}: {exc}")
        files,relationships=normalize_and_link(files)
        contract_errors=validate_output({"schema_version":SCHEMA_VERSION,"files":files,"relationships":relationships})
        if contract_errors:
            raise ValueError("AST output contract validation failed: "+"; ".join(contract_errors[:20]))
        self._persist(run,files,relationships,file_sources)
        run.files_parsed=len(files); run.files_failed=len(errors); run.files_unsupported=unsupported
        run.total_functions=sum(len(f.get("functions",[])) for f in files)
        run.total_classes=sum(len(f.get("classes",[])) for f in files)
        run.total_imports=sum(len(f.get("imports",[])) for f in files)
        run.total_calls=sum(len(fn.get("calls",[])) for f in files for fn in f.get("functions",[]))
        run.total_relationships=len(relationships)
        run.status="PARTIAL" if errors else "COMPLETED"
        run.error_summary="\n".join(errors[:100]) or None
        run.completed_at=datetime.utcnow()
        self._map_findings(scan.id,run,files,file_sources)
        self.db.commit(); self.db.refresh(run)
        return run
    def _persist(self,run,files,relationships,sources):
        stable_to_db={}
        for f in files:
            loc=f.get("location") or {}
            row=ASTFile(ast_analysis_id=run.id,path=f["path"],language=f.get("language"),status="PARSED",
                has_syntax_errors=f.get("has_syntax_errors",False),
                content_hash=hashlib.sha256(sources[f["path"]].encode()).hexdigest(),
                function_count=len(f.get("functions",[])),class_count=len(f.get("classes",[])),import_count=len(f.get("imports",[])))
            self.db.add(row); self.db.flush()
            def add(entity,kind,parent=None):
                key=entity["id"]; location=entity.get("location") or {}
                symbol=ASTSymbol(ast_analysis_id=run.id,ast_file_id=row.id,stable_key=key,symbol_type=kind.upper(),
                    name=str(entity.get("name") or entity.get("statement") or kind)[:500],
                    line_start=location.get("start_line"),line_end=location.get("end_line"),
                    parent_stable_key=parent,metadata_json={k:v for k,v in entity.items() if k not in {"id","name","location","calls","variables"}})
                self.db.add(symbol); stable_to_db[key]=symbol
                for nested_key,nested_kind in (("calls","CALL"),("variables","VARIABLE")):
                    for nested in entity.get(nested_key,[]): add(nested,nested_kind,key)
            stable_to_db[f["id"]]=row
            for key,kind in (("functions","FUNCTION"),("classes","CLASS"),("imports","IMPORT"),("global_variables","VARIABLE")):
                for entity in f.get(key,[]): add(entity,kind,f["id"])
        self.db.flush()
        for edge in relationships:
            self.db.add(ASTRelationship(ast_analysis_id=run.id,source_stable_key=edge["source_id"],
                target_stable_key=edge["target_id"],relationship_type=edge["type"],
                evidence=edge.get("evidence") or {},resolution_status=edge.get("resolution_status","resolved")))
    def _map_findings(self,scan_id,run,files,sources):
        findings=self.db.query(SecurityFinding).filter(SecurityFinding.scan_id==scan_id).all()
        by_path={f["path"]:f for f in files}
        for finding in findings:
            path=(finding.file_path or "").replace("\\","/")
            data=by_path.get(path)
            if not data: continue
            line=finding.line_start or 0
            functions=[x for x in data.get("functions",[]) if (x.get("location") or {}).get("start_line",0)<=line<=(x.get("location") or {}).get("end_line",0)] if line else []
            classes=[x for x in data.get("classes",[]) if (x.get("location") or {}).get("start_line",0)<=line<=(x.get("location") or {}).get("end_line",0)] if line else []
            fn=min(functions,key=lambda x:(x["location"]["end_line"]-x["location"]["start_line"])) if functions else None
            cls=min(classes,key=lambda x:(x["location"]["end_line"]-x["location"]["start_line"])) if classes else None
            source=sources[path]; lines=source.splitlines()
            route=None; framework=None
            if data.get("language") in {"javascript","typescript"}:
                for match in ROUTE_RE.finditer(source):
                    ln=source.count("\n",0,match.start())+1
                    if not line or abs(ln-line)<=100:
                        route={"method":match.group(1).upper(),"path":match.group(2),"line":ln}; framework="Express"; break
            observed=[]; operations=[]; evidence=[]
            if line and 1<=line<=len(lines):
                lo=max(1,line-15); hi=min(len(lines),line+15)
                for number in range(lo,hi+1):
                    text=lines[number-1]
                    if INPUT_RE.search(text): observed.append({"expression":text.strip()[:500],"line":number})
                    if OP_RE.search(text): operations.append({"expression":text.strip()[:500],"line":number})
                evidence.append({"type":"SOURCE_LOCATION","file":path,"line_start":finding.line_start,"line_end":finding.line_end,"description":"Scanner finding source location"})
                if fn: evidence.append({"type":"AST_FUNCTION","file":path,"line_start":fn["location"]["start_line"],"line_end":fn["location"]["end_line"],"description":"Finding line is inside this extracted function"})
                if route: evidence.append({"type":"ROUTE_DECLARATION","file":path,"line_start":route["line"],"line_end":route["line"],"description":"Nearby Express route declaration"})
            self.db.add(SecurityContext(scan_id=scan_id,finding_id=finding.id,ast_analysis_id=run.id,file_path=path,
                function_name=fn.get("name") if fn else None,class_name=cls.get("name") if cls else None,
                route_method=route.get("method") if route else None,route_path=route.get("path") if route else None,
                framework=framework,observed_inputs=observed,security_operations=operations,
                resolution_status="RESOLVED" if fn or cls or route else "FILE_ONLY",evidence=evidence))
