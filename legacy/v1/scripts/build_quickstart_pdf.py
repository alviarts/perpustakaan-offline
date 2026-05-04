"""Build docs/quickstart.pdf dari docs/quickstart.md via reportlab.

Usage:
    .venv/bin/python scripts/build_quickstart_pdf.py

Hasil:
    docs/quickstart.pdf (target ~1 halaman A4 untuk pustakawan non-teknis)

Pendekatan: parse markdown sederhana (heading, list, table, code) -> reportlab
flowables. Bukan markdown engine penuh -- cukup untuk format quickstart yang
strukturnya stabil.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
SRC_MD = ROOT / "docs" / "quickstart.md"
OUT_PDF = ROOT / "docs" / "quickstart.pdf"


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontSize=14, leading=16,
            textColor=colors.HexColor("#0f172a"), spaceBefore=0, spaceAfter=2,
            fontName="Helvetica-Bold",
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontSize=9.5, leading=11,
            textColor=colors.HexColor("#1e40af"), spaceBefore=4, spaceAfter=1,
            fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontSize=7.8, leading=9.5,
            textColor=colors.HexColor("#1f2937"), spaceAfter=1,
            fontName="Helvetica",
        ),
        "li": ParagraphStyle(
            "li", parent=base["BodyText"], fontSize=7.8, leading=9.5,
            textColor=colors.HexColor("#1f2937"), spaceAfter=0,
            fontName="Helvetica", leftIndent=0,
        ),
        "code": ParagraphStyle(
            "code", parent=base["Code"], fontSize=7.5, leading=9,
            textColor=colors.HexColor("#0f172a"), fontName="Courier",
            backColor=colors.HexColor("#f3f4f6"), borderPadding=3,
            spaceBefore=2, spaceAfter=2,
        ),
        "muted": ParagraphStyle(
            "muted", parent=base["BodyText"], fontSize=7, leading=9,
            textColor=colors.HexColor("#6b7280"),
            fontName="Helvetica-Oblique",
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["BodyText"], fontSize=6.5, leading=8,
            textColor=colors.HexColor("#6b7280"), alignment=1,
            fontName="Helvetica-Oblique", spaceBefore=3,
        ),
    }


_INLINE_BOLD = re.compile(r"\*\*(.+?)\*\*")
_INLINE_CODE = re.compile(r"`([^`]+)`")
_INLINE_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_AUTO_LINK = re.compile(r"<(https?://[^>]+)>")


def _inline(text: str) -> str:
    """Convert markdown inline markers ke <b>/<font face=Courier>/<a>."""
    text = _INLINE_BOLD.sub(r"<b>\1</b>", text)
    text = _INLINE_CODE.sub(
        lambda m: f'<font face="Courier" color="#1e293b">{m.group(1)}</font>',
        text,
    )
    text = _INLINE_LINK.sub(
        lambda m: f'<a href="{m.group(2)}" color="#1e40af">{m.group(1)}</a>',
        text,
    )
    text = _AUTO_LINK.sub(
        lambda m: f'<a href="{m.group(1)}" color="#1e40af">{m.group(1)}</a>',
        text,
    )
    return text


def _parse_table(lines: list[str], i: int) -> tuple[Table | None, int]:
    """Parse markdown pipe table dimulai dari index i. Return (Table, next_idx)."""
    header_line = lines[i].strip()
    if not (header_line.startswith("|") and header_line.endswith("|")):
        return None, i
    if i + 1 >= len(lines):
        return None, i
    sep_line = lines[i + 1].strip()
    if not re.match(r"^\|[\s\-:|]+\|$", sep_line):
        return None, i

    def split_row(line: str) -> list[str]:
        return [c.strip() for c in line.strip("|").split("|")]

    header = split_row(header_line)
    rows: list[list[str]] = []
    j = i + 2
    while j < len(lines):
        line = lines[j].strip()
        if not (line.startswith("|") and line.endswith("|")):
            break
        rows.append(split_row(line))
        j += 1

    styles = _styles()
    th_style = ParagraphStyle(
        "th", parent=styles["li"], textColor=colors.whitesmoke,
        fontName="Helvetica-Bold",
    )
    data: list[list] = [[Paragraph(_inline(c), th_style) for c in header]]
    for row in rows:
        data.append([Paragraph(_inline(c), styles["li"]) for c in row])

    tbl = Table(data, colWidths=None, hAlign="LEFT", repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.HexColor("#f8fafc"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    return tbl, j


def _parse_list(
    lines: list[str], i: int, *, ordered: bool
) -> tuple[list, int]:
    """Parse markdown list (ordered / bullet) -> list of flowables.

    Sub-bullets (indented with 3+ spaces + ``-``) are rendered as separate
    Paragraphs outside the main ListFlowable supaya tidak dapat ordered number.
    """
    styles = _styles()
    flows: list = []
    items: list[ListItem] = []

    def flush_main() -> None:
        if items:
            flows.append(ListFlowable(
                list(items), bulletType="1" if ordered else "bullet",
                leftIndent=12, bulletFontSize=7.8, bulletDedent=9,
                spaceBefore=0, spaceAfter=0,
            ))
            items.clear()

    pat = re.compile(r"^(\s*)" + (r"\d+\." if ordered else r"-") + r"\s+(.*)$")
    sub_indent = ParagraphStyle(
        "sub", parent=styles["li"], leftIndent=18, spaceAfter=0,
    )

    j = i
    while j < len(lines):
        m = pat.match(lines[j])
        if not m:
            break
        text = m.group(2)
        items.append(ListItem(
            Paragraph(_inline(text), styles["li"]),
            leftIndent=8, value="circle" if not ordered else None,
        ))
        j += 1
        # sub-bullets: render setelah flush main list
        sub_collected: list[str] = []
        while (
            j < len(lines)
            and lines[j].startswith("   ")
            and lines[j].strip().startswith("-")
        ):
            sub_collected.append(lines[j].strip().lstrip("-").strip())
            j += 1
        if sub_collected:
            flush_main()
            for sub in sub_collected:
                flows.append(Paragraph(
                    f"\u00b7 {_inline(sub)}", sub_indent,
                ))

    flush_main()
    return flows, j


def md_to_flowables(md: str) -> list:
    styles = _styles()
    lines = md.splitlines()
    flows: list = []
    i = 0
    in_code = False
    code_buf: list[str] = []

    while i < len(lines):
        line = lines[i]

        # fenced code block
        if line.strip().startswith("```"):
            if in_code:
                code_text = "\n".join(code_buf)
                flows.append(Paragraph(
                    code_text.replace("&", "&amp;").replace("<", "&lt;")
                    .replace(">", "&gt;").replace("\n", "<br/>"),
                    styles["code"],
                ))
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        stripped = line.strip()

        # headings
        if stripped.startswith("# "):
            flows.append(Paragraph(_inline(stripped[2:]), styles["h1"]))
            i += 1
            continue
        if stripped.startswith("## "):
            flows.append(Paragraph(_inline(stripped[3:]), styles["h2"]))
            i += 1
            continue
        if stripped.startswith("### "):
            flows.append(Paragraph(_inline(stripped[4:]), styles["h2"]))
            i += 1
            continue

        # horizontal rule
        if stripped == "---":
            flows.append(HRFlowable(width="100%", thickness=0.4,
                                    color=colors.HexColor("#cbd5e1"),
                                    spaceBefore=4, spaceAfter=4))
            i += 1
            continue

        # block quote (single-line)
        if stripped.startswith("> "):
            flows.append(Paragraph(_inline(stripped[2:]), styles["muted"]))
            i += 1
            continue

        # ordered list
        if re.match(r"^\d+\.\s+", stripped):
            sub_flows, i = _parse_list(lines, i, ordered=True)
            flows.extend(sub_flows)
            flows.append(Spacer(1, 1))
            continue

        # bullet list
        if stripped.startswith("- "):
            sub_flows, i = _parse_list(lines, i, ordered=False)
            flows.extend(sub_flows)
            flows.append(Spacer(1, 1))
            continue

        # table
        if stripped.startswith("|") and stripped.endswith("|"):
            tbl, ni = _parse_table(lines, i)
            if tbl is not None:
                flows.append(Spacer(1, 2))
                flows.append(tbl)
                flows.append(Spacer(1, 2))
                i = ni
                continue

        # blank line
        if not stripped:
            flows.append(Spacer(1, 1.5))
            i += 1
            continue

        # paragraph (default)
        if stripped.startswith("*") and stripped.endswith("*") and not stripped.startswith("**"):
            flows.append(Paragraph(_inline(stripped), styles["footer"]))
        else:
            flows.append(Paragraph(_inline(stripped), styles["body"]))
        i += 1

    return flows


def main() -> int:
    if not SRC_MD.exists():
        print(f"ERROR: {SRC_MD} not found")
        return 2

    md_text = SRC_MD.read_text(encoding="utf-8")
    flows = md_to_flowables(md_text)

    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT_PDF), pagesize=A4,
        leftMargin=11 * mm, rightMargin=11 * mm,
        topMargin=8 * mm, bottomMargin=8 * mm,
        title="Perpustakaan Offline v0.3.0 \u2014 Quickstart",
        author="alviarts/perpustakaan-offline",
        subject="Panduan singkat install + alur harian untuk pustakawan",
    )
    doc.build(flows)
    size_kb = OUT_PDF.stat().st_size / 1024
    print(f"-> wrote {OUT_PDF.relative_to(ROOT)} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
