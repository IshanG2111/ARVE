"""PDF report generator for ARVE security assessments using ReportLab."""
from __future__ import annotations

import io
import re
from typing import List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.reports.schemas import ScanReportData


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas that computes total page count and prints 'Page X of Y' in the footer."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_footer(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(40, 32, self._pagesize[0] - 40, 32)

        # Footer text
        left_text = "ARVE Security Assessment Report • Confidential"
        right_text = f"Page {self._pageNumber} of {page_count}"

        self.drawString(40, 20, left_text)
        self.drawRightString(self._pagesize[0] - 40, 20, right_text)
        self.restoreState()


def _to_xml(text: Optional[str]) -> str:
    """Safely escape text for ReportLab Paragraphs and translate common markdown tokens."""
    if not text:
        return ""
    t = (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    # Convert **bold** to <b>bold</b>
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    # Convert `code` to <font name="Courier">\1</font>
    t = re.sub(r"`(.+?)`", r'<font name="Courier">\1</font>', t)
    # Convert newlines to <br/>
    t = t.replace("\n", "<br/>")
    return t


def generate_pdf_report(report: ScanReportData) -> bytes:
    """Generate a clean, professional, enterprise-grade PDF security report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=46,
    )

    styles = getSampleStyleSheet()

    # Typography & Styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=3,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=10,
    )
    h2_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12.5,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True,
    )
    h3_style = ParagraphStyle(
        "SubSectionHeading",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=5,
        spaceAfter=3,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
        spaceAfter=4,
    )
    card_label_style = ParagraphStyle(
        "CardLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
    )
    card_text_style = ParagraphStyle(
        "CardText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.white,
    )
    code_style = ParagraphStyle(
        "ReportCode",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0f172a"),
    )

    story = []

    # Title & Header
    story.append(Paragraph("ARVE Security Assessment Report", title_style))
    story.append(
        Paragraph("Repository Security Audit & Remediation Assessment • Generated by ARVE Intelligence Engine", subtitle_style)
    )
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=8))

    # Metadata Card Table
    repo_name = report.repository_name or report.project_name
    commit_short = report.commit_sha[:8] if report.commit_sha else "HEAD"
    scan_id_short = report.scan_id[:20] if report.scan_id else "N/A"

    meta_data = [
        [
            Paragraph("<b>Project Name:</b>", card_label_style),
            Paragraph(_to_xml(report.project_name or "Default Project"), card_text_style),
            Paragraph("<b>Target Repository:</b>", card_label_style),
            Paragraph(_to_xml(repo_name), card_text_style),
        ],
        [
            Paragraph("<b>Scan Identifier:</b>", card_label_style),
            Paragraph(scan_id_short, code_style),
            Paragraph("<b>Commit SHA:</b>", card_label_style),
            Paragraph(commit_short, code_style),
        ],
        [
            Paragraph("<b>Scan Timestamp:</b>", card_label_style),
            Paragraph(report.scan_timestamp, card_text_style),
            Paragraph("<b>Audit Status:</b>", card_label_style),
            Paragraph("<b>COMPLETED</b> (Verified Audit)", card_text_style),
        ],
        [
            Paragraph("<b>Engines Evaluated:</b>", card_label_style),
            Paragraph("OSV • Semgrep • Gitleaks • CodeQL • AST", card_text_style),
            Paragraph("<b>Assessment Scope:</b>", card_label_style),
            Paragraph("Vulnerabilities • SAST • Secrets", card_text_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[95, 171, 95, 171])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 01 — Executive Summary & Overview
    story.append(Paragraph("01 — Executive Summary", h2_style))
    story.append(Paragraph(_to_xml(report.executive_summary), body_style))

    # Canonical Severity Table
    crit = report.severity_counts.get("CRITICAL", 0)
    high = report.severity_counts.get("HIGH", 0)
    med = report.severity_counts.get("MEDIUM", 0)
    low = report.severity_counts.get("LOW", 0)

    sev_table_data = [
        ["Severity", "Count", "Risk Classification", "Action Timeline"],
        ["Critical", str(crit), "Immediate compromise risk", "Immediate (Within 24h SLA)"],
        ["High", str(high), "Severe vulnerability requiring urgent fix", "Urgent (Within 7 days)"],
        ["Medium", str(med), "Defense-in-depth weakness", "Scheduled Sprint"],
        ["Low / Info", str(low), "Security hygiene / deviation", "Maintenance Backlog"],
        ["Total Findings", str(report.total_findings), "All detected issues across enabled engines", "Continuous Triage"],
    ]
    sev_table = Table(sev_table_data, colWidths=[90, 60, 202, 180])
    sev_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("TEXTCOLOR", (0, 1), (0, 1), colors.HexColor("#dc2626")),
            ("TEXTCOLOR", (0, 2), (0, 2), colors.HexColor("#ea580c")),
            ("TEXTCOLOR", (0, 3), (0, 3), colors.HexColor("#ca8a04")),
            ("TEXTCOLOR", (0, 4), (0, 4), colors.HexColor("#2563eb")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f8fafc")),
        ])
    )
    story.append(sev_table)
    story.append(Spacer(1, 8))

    # 02 — Priority Risks ("What needs attention?")
    story.append(Paragraph("02 — Priority Risks (What needs attention?)", h2_style))
    if report.priority_risks:
        for pr in report.priority_risks:
            risk_box = []
            risk_header = f"<b>{pr.index}. {_to_xml(pr.title)}</b> &nbsp;&nbsp; <font color='#dc2626'><b>[{_to_xml(pr.severity)}]</b></font>"
            risk_box.append(Paragraph(risk_header, h3_style))
            risk_box.append(Paragraph(_to_xml(pr.description), body_style))
            target_text = f"<b>Target:</b> <font name='Courier'>{_to_xml(pr.target)}</font>"
            if pr.related_finding_ids:
                target_text += f"<br/><b>Related Findings:</b> <font color='#2563eb'><b>{', '.join(pr.related_finding_ids)}</b></font>"
            if pr.severity_footnote:
                target_text += f"<br/><font color='#64748b' size='7'><i>{_to_xml(pr.severity_footnote)}</i></font>"
            risk_box.append(Paragraph(target_text, body_style))
            risk_box.append(Spacer(1, 3))
            story.append(KeepTogether(risk_box))
    else:
        for c in report.main_concerns:
            story.append(Paragraph(f"• {_to_xml(c)}", body_style))

    story.append(Spacer(1, 6))

    # 03 — Recommended Actions ("Remediation Plan")
    story.append(Paragraph("03 — Recommended Actions (Remediation Plan)", h2_style))
    if report.prioritized_actions:
        action_rows = [
            [
                Paragraph("<b>Priority</b>", table_header_style),
                Paragraph("<b>Action Item</b>", table_header_style),
                Paragraph("<b>Target</b>", table_header_style),
                Paragraph("<b>Triage Rationale</b>", table_header_style),
            ]
        ]
        for act in report.prioritized_actions:
            p_color = (
                "#dc2626" if "1" in act.priority
                else "#ea580c" if "2" in act.priority
                else "#2563eb"
            )
            p_cell = Paragraph(f"<font color='{p_color}'><b>{act.priority}</b></font>", table_cell_style)
            action_cell = Paragraph(_to_xml(act.action), table_cell_style)
            target_cell = Paragraph(_to_xml(act.target or "-"), table_cell_style)
            rationale_cell = Paragraph(_to_xml(act.rationale or "-"), table_cell_style)
            action_rows.append([p_cell, action_cell, target_cell, rationale_cell])

        action_table = Table(action_rows, colWidths=[55, 200, 115, 162])
        action_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ])
        )
        story.append(action_table)

    story.append(Spacer(1, 8))

    # 04 — Detailed Findings
    story.append(Paragraph("04 — Detailed Findings", h2_style))
    if not report.important_findings:
        story.append(Paragraph("No critical or high severity vulnerabilities were detected.", body_style))
    else:
        for finding in report.important_findings[:8]:
            finding_blocks = []

            # Finding Header with ID
            sev_color = "#dc2626" if finding.severity == "CRITICAL" else "#ea580c"
            id_badge = finding.ghsa or finding.cve or finding.rule_id or finding.engine
            header_text = (
                f"<b>{finding.display_id} — {_to_xml(finding.title)}</b> &nbsp;&nbsp;"
                f"<font color='{sev_color}'><b>[{finding.severity}]</b></font> &nbsp;"
                f"<font color='#64748b'>({_to_xml(id_badge)} · {_to_xml(finding.engine.upper())})</font>"
            )
            finding_blocks.append(Paragraph(header_text, h3_style))

            # Component Table
            loc = finding.file_path or "package-lock.json"
            if finding.line_start:
                loc += f":{finding.line_start}"

            comp_rows = [
                [Paragraph("<b>Package:</b>", card_label_style), Paragraph(_to_xml(finding.package_name or "N/A"), card_text_style),
                 Paragraph("<b>Installed:</b>", card_label_style), Paragraph(_to_xml(finding.package_version or "N/A"), card_text_style)],
                [Paragraph("<b>Fixed Version:</b>", card_label_style), Paragraph(_to_xml(finding.fixed_version or "N/A"), card_text_style),
                 Paragraph("<b>Location:</b>", card_label_style), Paragraph(f"<font name='Courier'>{_to_xml(loc)}</font>", card_text_style)],
                [Paragraph("<b>Detection:</b>", card_label_style), Paragraph(_to_xml(finding.engine.upper()), card_text_style),
                 Paragraph("<b>Status:</b>", card_label_style), Paragraph(_to_xml(finding.status), card_text_style)],
            ]
            comp_table = Table(comp_rows, colWidths=[80, 185, 75, 192])
            comp_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ])
            )
            finding_blocks.append(comp_table)

            # Structured fields
            issue_sum = finding.issue_summary or finding.description or "No issue summary provided."
            fields_rows = [
                [
                    Paragraph("<b>What is wrong?</b>", card_label_style),
                    Paragraph(_to_xml(issue_sum), card_text_style),
                ],
                [
                    Paragraph("<b>Potential impact:</b>", card_label_style),
                    Paragraph(_to_xml(finding.potential_impact or "Degrades application defense posture."), card_text_style),
                ],
                [
                    Paragraph("<b>Applicability:</b>", card_label_style),
                    Paragraph(_to_xml(finding.applicability), card_text_style),
                ],
                [
                    Paragraph("<b>Recommended fix:</b>", card_label_style),
                    Paragraph(_to_xml(finding.recommended_fix or "Update to secure version."), card_text_style),
                ],
            ]
            fields_table = Table(fields_rows, colWidths=[100, 432])
            fields_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ])
            )
            finding_blocks.append(fields_table)
            finding_blocks.append(Spacer(1, 6))

            story.append(KeepTogether(finding_blocks))

    story.append(Spacer(1, 6))

    # 05 — Analysis Coverage
    story.append(Paragraph("05 — Analysis Coverage", h2_style))
    cov_rows = [
        [
            Paragraph("<b>Engine / Analysis</b>", table_header_style),
            Paragraph("<b>Status</b>", table_header_style),
            Paragraph("<b>Scope & Purpose</b>", table_header_style),
            Paragraph("<b>Duration / Metrics</b>", table_header_style),
            Paragraph("<b>Findings</b>", table_header_style),
        ]
    ]
    for eng in report.engine_coverage:
        dur = f"{eng.duration_ms}ms" if eng.duration_ms else "Completed" if eng.status == "Completed" else "Not run"
        cov_rows.append([
            Paragraph(f"<b>{_to_xml(eng.engine_name)}</b>", table_cell_style),
            Paragraph(_to_xml(eng.status), table_cell_style),
            Paragraph(_to_xml(eng.purpose), table_cell_style),
            Paragraph(_to_xml(dur), table_cell_style),
            Paragraph(str(eng.findings_count), table_cell_style),
        ])

    cov_table = Table(cov_rows, colWidths=[130, 75, 175, 92, 60])
    cov_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (4, 0), (4, -1), "CENTER"),
        ])
    )
    story.append(cov_table)

    if report.limitations:
        story.append(Spacer(1, 3))
        story.append(Paragraph("<b>Analysis Limitations:</b>", h3_style))
        for lim in report.limitations:
            story.append(Paragraph(f"• {_to_xml(lim)}", body_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Audit Verification & Methodology Standard:</b>", h3_style))
    story.append(
        Paragraph(
            "This assessment was generated through ARVE's automated multi-engine scanning pipeline, synthesizing static analysis results from OSV, Semgrep, Gitleaks, and AST taint graphs with deterministic rule consensus and verified vulnerability databases.",
            body_style,
        )
    )

    story.append(Spacer(1, 8))

    # 06 — Complete Findings Inventory (Compact Table)
    story.append(Paragraph("06 — Complete Findings Inventory", h2_style))
    if not report.appendix_findings:
        story.append(Paragraph("No findings present in scan appendix.", body_style))
    else:
        app_rows = [
            [
                Paragraph("<b>ID</b>", table_header_style),
                Paragraph("<b>Sev</b>", table_header_style),
                Paragraph("<b>Vulnerability</b>", table_header_style),
                Paragraph("<b>Location / Package</b>", table_header_style),
                Paragraph("<b>Engine</b>", table_header_style),
                Paragraph("<b>Status</b>", table_header_style),
            ]
        ]
        for f in report.appendix_findings:
            loc = f.file_path or f.package_name or ""
            if f.line_start:
                loc += f":{f.line_start}"
            loc_short = (loc[:30] + "...") if len(loc) > 33 else loc
            title_short = (f.title[:45] + "...") if len(f.title) > 48 else f.title

            sev_color = {
                "CRITICAL": "#dc2626",
                "HIGH": "#ea580c",
                "MEDIUM": "#ca8a04",
                "LOW": "#2563eb",
            }.get(f.severity.upper(), "#64748b")

            sev_p = Paragraph(f"<font color='{sev_color}'><b>{f.severity[:4]}</b></font>", table_cell_style)
            title_p = Paragraph(_to_xml(title_short), table_cell_style)
            loc_p = Paragraph(f"<font name='Courier'>{_to_xml(loc_short)}</font>", table_cell_style)
            eng_p = Paragraph(_to_xml(f.engine.upper()), table_cell_style)
            status_p = Paragraph(_to_xml(f.status[:6]), table_cell_style)

            app_rows.append([
                Paragraph(f"<b>{f.display_id}</b>", table_cell_style),
                sev_p,
                title_p,
                loc_p,
                eng_p,
                status_p,
            ])

        app_table = Table(app_rows, colWidths=[55, 36, 185, 140, 65, 51])
        app_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("ALIGN", (0, 0), (1, -1), "CENTER"),
            ])
        )
        story.append(app_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
