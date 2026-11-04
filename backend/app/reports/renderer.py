"""Render a ``SecurityReport`` to HTML (Jinja2, autoescaped) and PDF (xhtml2pdf)."""
from __future__ import annotations

import io
import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.reports.builder import SecurityReport

TEMPLATE_VERSION = "1.1"
_TEMPLATES = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES)),
    autoescape=True,  # repository-derived text must never become markup
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)


class ReportRenderError(Exception):
    """PDF conversion failed."""


def _date(value) -> str:
    return value.strftime("%Y-%m-%d %H:%M UTC") if value else "not recorded"


CODE_WRAP_WIDTH = 92


def _code_lines(excerpt: str, start_line: int) -> list[str]:
    """Number excerpt lines and hard-wrap long ones; xhtml2pdf does not wrap <pre>."""
    out: list[str] = []
    for offset, line in enumerate(excerpt.splitlines()):
        if line == "...":
            out.append("...")
            continue
        prefix = f"{start_line + offset:5d}  "
        line = line.expandtabs(4)
        width = CODE_WRAP_WIDTH - len(prefix)
        chunks = [line[i:i + width] for i in range(0, len(line), width)] or [""]
        out.append(prefix + chunks[0])
        out.extend(" " * len(prefix) + chunk for chunk in chunks[1:])
    return out


def _wrap_code(code: str) -> list[str]:
    """Hard-wrap unnumbered code (AI suggested change) for the PDF."""
    out: list[str] = []
    for line in code.expandtabs(4).splitlines():
        out.extend([line[i:i + CODE_WRAP_WIDTH] for i in range(0, len(line), CODE_WRAP_WIDTH)] or [""])
    return out


_env.filters["date"] = _date
_env.filters["code_lines"] = _code_lines
_env.filters["wrap_code"] = _wrap_code


def render_html(report: SecurityReport, for_pdf: bool = False) -> str:
    return _env.get_template("report.html").render(
        report=report, for_pdf=for_pdf, template_version=TEMPLATE_VERSION
    )


def _no_external_resources(uri: str, rel: str) -> str:
    # The template references nothing external; refuse anything else so a
    # crafted value can never make the renderer fetch a URL or read a file.
    return ""


# The built-in PDF fonts have no glyphs for these; replace them so they don't render as boxes.
_PDF_GLYPH_FALLBACKS = str.maketrans({
    "→": "->", "←": "<-", "⇒": "=>", "↔": "<->",
    "≤": "<=", "≥": ">=", "≠": "!=",
    "✓": "v", "✔": "v", "✗": "x", "✘": "x",
})


def render_pdf(report: SecurityReport) -> bytes:
    from xhtml2pdf import pisa  # imported lazily: heavy, and only needed for PDF

    output = io.BytesIO()
    result = pisa.CreatePDF(
        render_html(report, for_pdf=True).translate(_PDF_GLYPH_FALLBACKS),
        dest=output,
        encoding="utf-8",
        link_callback=_no_external_resources,
    )
    pdf = output.getvalue()
    if result.err or not pdf.startswith(b"%PDF"):
        raise ReportRenderError("PDF conversion failed")
    return pdf


def report_filename(report: SecurityReport, extension: str) -> str:
    repo = (report.repo_name or report.project_name or "report").rsplit("/", 1)[-1]
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", repo).strip("-") or "report"
    return f"arve-security-report-{safe}-{report.commit_sha[:7]}.{extension}"
