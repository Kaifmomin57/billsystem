import io
from typing import Dict, Any, List
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


HEADER_FILL  = PatternFill("solid", fgColor="1E3A8A")
SUBHDR_FILL  = PatternFill("solid", fgColor="2563EB")
EVEN_FILL    = PatternFill("solid", fgColor="F8FAFC")
ODD_FILL     = PatternFill("solid", fgColor="FFFFFF")
TOTAL_FILL   = PatternFill("solid", fgColor="DBEAFE")

HEADER_FONT  = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
SUBHDR_FONT  = Font(name="Segoe UI", size=9,  bold=True, color="FFFFFF")
BODY_FONT    = Font(name="Segoe UI", size=9,  color="334155")
TOTAL_FONT   = Font(name="Segoe UI", size=11, bold=True, color="0F172A")
MONO_FONT    = Font(name="Courier New", size=9, color="334155")

thin = Side(border_style="thin", color="CBD5E1")
CELL_BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def _col(ws, col_idx: int) -> str:
    return get_column_letter(col_idx)


def build_daily_by_product(rows: List[Dict], report_date: str) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "By Product"

    # Banner
    ws.merge_cells("A1:E1")
    c = ws["A1"]
    c.value = f"DAILY REPORT BY PRODUCT — {report_date}"
    c.font = HEADER_FONT; c.fill = HEADER_FILL; c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    headers = ["Product", "Unit", "Total Quantity", "Rate (avg)", "Total Amount"]
    for ci, h in enumerate(headers, 1):
        cell = ws.cell(row=2, column=ci, value=h)
        cell.font = SUBHDR_FONT; cell.fill = SUBHDR_FILL
        cell.alignment = Alignment(horizontal="center")
        cell.border = CELL_BORDER

    total_amount = 0
    for ri, row in enumerate(rows, start=3):
        vals = [row.get("product_name"), row.get("unit"), row.get("total_qty"), row.get("avg_rate"), row.get("total_amount")]
        fill = EVEN_FILL if ri % 2 == 0 else ODD_FILL
        for ci, val in enumerate(vals, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.font = BODY_FONT; cell.fill = fill; cell.border = CELL_BORDER
            if ci >= 3:
                cell.number_format = "#,##0.00"
                cell.alignment = Alignment(horizontal="right")
        total_amount += float(row.get("total_amount") or 0)

    # Grand total
    gr = len(rows) + 3
    ws.merge_cells(f"A{gr}:D{gr}")
    tc = ws[f"A{gr}"]
    tc.value = "GRAND TOTAL"; tc.font = TOTAL_FONT; tc.fill = TOTAL_FILL; tc.border = CELL_BORDER
    tc.alignment = Alignment(horizontal="right")
    vc = ws.cell(row=gr, column=5, value=total_amount)
    vc.font = TOTAL_FONT; vc.fill = TOTAL_FILL; vc.border = CELL_BORDER
    vc.number_format = "#,##0.00"; vc.alignment = Alignment(horizontal="right")

    for ci in range(1, 6):
        ws.column_dimensions[_col(ws, ci)].width = [28, 10, 18, 14, 16][ci - 1]

    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return buf


def build_daily_by_customer(rows: List[Dict], report_date: str) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "By Customer"

    ws.merge_cells("A1:G1")
    c = ws["A1"]
    c.value = f"DAILY REPORT BY CUSTOMER — {report_date}"
    c.font = HEADER_FONT; c.fill = HEADER_FILL; c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    headers = ["Customer", "Bill No", "Product", "Quantity", "Rate", "Amount", "Running Total"]
    for ci, h in enumerate(headers, 1):
        cell = ws.cell(row=2, column=ci, value=h)
        cell.font = SUBHDR_FONT; cell.fill = SUBHDR_FILL
        cell.alignment = Alignment(horizontal="center"); cell.border = CELL_BORDER

    for ri, row in enumerate(rows, start=3):
        vals = [row.get("customer_name"), row.get("bill_no"), row.get("product_name"),
                row.get("quantity"), row.get("rate"), row.get("amount"), row.get("running_total")]
        fill = EVEN_FILL if ri % 2 == 0 else ODD_FILL
        for ci, val in enumerate(vals, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.font = BODY_FONT; cell.fill = fill; cell.border = CELL_BORDER
            if ci >= 4:
                cell.number_format = "#,##0.00"
                cell.alignment = Alignment(horizontal="right")

    widths = [25, 12, 22, 12, 12, 14, 14]
    for ci, w in enumerate(widths, 1):
        ws.column_dimensions[_col(ws, ci)].width = w

    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return buf


def build_ledger_page_excel(draft_data: Dict[str, Any], page_date: str) -> io.BytesIO:
    """Generate multi-sheet Excel for a digitized ledger page (F4.14)."""
    wb = Workbook()
    
    # Sheet 1: Ledger Matrix
    ws1 = wb.active
    ws1.title = "Ledger Grid"
    
    ws1.merge_cells("A1:I1")
    t1 = ws1["A1"]
    t1.value = f"DIGITIZED LEDGER GRID — {page_date or 'UNDATED'}"
    t1.font = HEADER_FONT; t1.fill = HEADER_FILL; t1.alignment = Alignment(horizontal="center", vertical="center")
    ws1.row_dimensions[1].height = 28
    
    col_codes = draft_data.get("column_codes", ["M", "R", "B", "P", "K", "T", "JB"])
    headers = ["#", "Customer Name"] + col_codes + ["Notes / Tags"]
    for ci, h in enumerate(headers, 1):
        cell = ws1.cell(row=2, column=ci, value=h)
        cell.font = SUBHDR_FONT; cell.fill = SUBHDR_FILL; cell.alignment = Alignment(horizontal="center"); cell.border = CELL_BORDER

    rows = draft_data.get("rows", [])
    for ri, row in enumerate(rows, start=3):
        fill = EVEN_FILL if ri % 2 == 0 else ODD_FILL
        ws1.cell(row=ri, column=1, value=ri-2).fill = fill
        ws1.cell(row=ri, column=2, value=row.get("customer_name_raw") or row.get("customer_name") or "").fill = fill
        
        cells_dict = row.get("cells", {})
        for c_idx, code in enumerate(col_codes, start=3):
            cell_data = cells_dict.get(code, {})
            qty = cell_data.get("quantity")
            rate = cell_data.get("rate")
            txt = ""
            if qty is not None and rate is not None:
                txt = f"{qty} / {rate}"
            elif qty is not None:
                txt = str(qty)
            tag = cell_data.get("tag")
            if tag:
                txt += f" ({tag})"
            c_elem = ws1.cell(row=ri, column=c_idx, value=txt or "-")
            c_elem.fill = fill
            c_elem.alignment = Alignment(horizontal="center")
            c_elem.border = CELL_BORDER
            
        ws1.cell(row=ri, column=len(col_codes)+3, value=row.get("notes") or "").fill = fill

    # Sheet 2: Flat Entries List
    ws2 = wb.create_sheet(title="Entries Flat List")
    headers2 = ["Date", "Customer", "Product Code", "Quantity", "Rate", "Amount", "Tag", "Circled Val", "Confidence"]
    for ci, h in enumerate(headers2, 1):
        cell = ws2.cell(row=1, column=ci, value=h)
        cell.font = SUBHDR_FONT; cell.fill = SUBHDR_FILL; cell.alignment = Alignment(horizontal="center"); cell.border = CELL_BORDER
        
    e_row = 2
    for row in rows:
        c_name = row.get("customer_name_raw") or row.get("customer_name") or ""
        cells_dict = row.get("cells", {})
        for code, c_data in cells_dict.items():
            qty = c_data.get("quantity")
            if qty is not None:
                rate = c_data.get("rate") or 0.0
                amt = float(qty) * float(rate)
                vals = [page_date, c_name, code, qty, rate, amt, c_data.get("tag"), c_data.get("circled_value"), c_data.get("confidence")]
                fill = EVEN_FILL if e_row % 2 == 0 else ODD_FILL
                for ci, v in enumerate(vals, 1):
                    cell = ws2.cell(row=e_row, column=ci, value=v)
                    cell.font = BODY_FONT; cell.fill = fill; cell.border = CELL_BORDER
                e_row += 1

    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return buf

