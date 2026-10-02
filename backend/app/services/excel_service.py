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

    # ── Styles ────────────────────────────────────────────────────────────
    PAID_FILL    = PatternFill("solid", fgColor="DCFCE7")   # green
    PARTIAL_FILL = PatternFill("solid", fgColor="FEF9C3")   # yellow
    UNPAID_FILL  = PatternFill("solid", fgColor="FEE2E2")   # red
    SUMMARY_FILL = PatternFill("solid", fgColor="0F172A")
    SUMMARY_FONT = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")

    NUM_FMT = "#,##0.00"
    CENTER  = Alignment(horizontal="center", vertical="center")
    RIGHT   = Alignment(horizontal="right",  vertical="center")
    LEFT    = Alignment(horizontal="left",   vertical="center")

    # ── Banner ────────────────────────────────────────────────────────────
    NCOLS = 7
    ws.merge_cells(f"A1:{get_column_letter(NCOLS)}1")
    c = ws["A1"]
    c.value = f"DAILY SALES REPORT — BY PRODUCT   |   {report_date}"
    c.font = HEADER_FONT; c.fill = HEADER_FILL
    c.alignment = CENTER
    ws.row_dimensions[1].height = 30

    # ── Column headers ────────────────────────────────────────────────────
    headers = ["Product", "Unit", "Qty Sold", "Avg Rate (₹)",
               "Total Sale (₹)", "Received (₹)", "Pending (₹)"]
    for ci, h in enumerate(headers, 1):
        cell = ws.cell(row=2, column=ci, value=h)
        cell.font = SUBHDR_FONT; cell.fill = SUBHDR_FILL
        cell.alignment = CENTER; cell.border = CELL_BORDER
    ws.row_dimensions[2].height = 20

    # ── Data rows ─────────────────────────────────────────────────────────
    grand_sale = grand_received = grand_pending = 0.0

    for ri, row in enumerate(rows, start=3):
        sale     = float(row.get("total_amount")   or 0)
        received = float(row.get("amount_paid")    or 0)
        pending  = float(row.get("balance_due")    or (sale - received))
        qty      = float(row.get("total_qty")      or 0)
        avg_rate = float(row.get("avg_rate")       or 0)

        grand_sale     += sale
        grand_received += received
        grand_pending  += pending

        fill = EVEN_FILL if ri % 2 == 0 else ODD_FILL
        vals = [row.get("product_name"), row.get("unit"), qty, avg_rate, sale, received, pending]
        for ci, val in enumerate(vals, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.font = BODY_FONT; cell.fill = fill; cell.border = CELL_BORDER
            if ci <= 2:
                cell.alignment = LEFT
            else:
                cell.number_format = NUM_FMT
                cell.alignment = RIGHT

    # ── Grand total row ───────────────────────────────────────────────────
    gr = len(rows) + 3
    ws.merge_cells(f"A{gr}:D{gr}")
    lbl = ws[f"A{gr}"]
    lbl.value = "GRAND TOTAL"
    lbl.font = TOTAL_FONT; lbl.fill = TOTAL_FILL
    lbl.alignment = RIGHT; lbl.border = CELL_BORDER

    for ci, val in enumerate([grand_sale, grand_received, grand_pending], start=5):
        cell = ws.cell(row=gr, column=ci, value=val)
        cell.font = TOTAL_FONT; cell.fill = TOTAL_FILL
        cell.number_format = NUM_FMT; cell.alignment = RIGHT
        cell.border = CELL_BORDER

    # ── Summary box (right-side KPI cards) ───────────────────────────────
    sr = 3
    summaries = [
        ("TOTAL SALE",     grand_sale,     "16A34A"),
        ("TOTAL RECEIVED", grand_received, "2563EB"),
        ("TOTAL PENDING",  grand_pending,  "DC2626"),
    ]
    for label, value, color in summaries:
        ws.merge_cells(f"I{sr}:J{sr}")
        lc = ws.cell(row=sr, column=9, value=label)
        lc.font = Font(name="Segoe UI", size=9, bold=True, color="FFFFFF")
        lc.fill = PatternFill("solid", fgColor=color)
        lc.alignment = CENTER; lc.border = CELL_BORDER

        ws.merge_cells(f"I{sr+1}:J{sr+1}")
        vc = ws.cell(row=sr+1, column=9, value=value)
        vc.font = Font(name="Segoe UI", size=13, bold=True, color=color)
        vc.fill = PatternFill("solid", fgColor="F8FAFC")
        vc.number_format = "₹#,##0.00"
        vc.alignment = CENTER; vc.border = CELL_BORDER
        sr += 3

    # ── Column widths ─────────────────────────────────────────────────────
    widths = [30, 8, 14, 14, 16, 16, 16, 4, 20, 20]
    for ci, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(ci)].width = w

    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return buf


def build_daily_by_customer(rows: List[Dict], report_date: str) -> io.BytesIO:
    """
    rows expected keys:
      customer_name, bill_no, bill_date, product_name,
      quantity, rate, amount,
      total_bill_amount, amount_paid, balance_due, payment_status
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "By Customer"

    NUM_FMT = "#,##0.00"
    CENTER  = Alignment(horizontal="center", vertical="center")
    RIGHT   = Alignment(horizontal="right",  vertical="center")
    LEFT    = Alignment(horizontal="left",   vertical="center")

    PAID_FILL    = PatternFill("solid", fgColor="DCFCE7")
    PARTIAL_FILL = PatternFill("solid", fgColor="FEF9C3")
    UNPAID_FILL  = PatternFill("solid", fgColor="FEE2E2")
    PAID_FONT    = Font(name="Segoe UI", size=8, bold=True, color="15803D")
    PARTIAL_FONT = Font(name="Segoe UI", size=8, bold=True, color="92400E")
    UNPAID_FONT  = Font(name="Segoe UI", size=8, bold=True, color="DC2626")

    # ── Banner ────────────────────────────────────────────────────────────
    NCOLS = 10
    ws.merge_cells(f"A1:{get_column_letter(NCOLS)}1")
    c = ws["A1"]
    c.value = f"DAILY SALES REPORT — BY CUSTOMER   |   {report_date}"
    c.font = HEADER_FONT; c.fill = HEADER_FILL
    c.alignment = CENTER
    ws.row_dimensions[1].height = 30

    headers = [
        "Customer", "Bill No", "Date",
        "Product", "Qty", "Rate (₹)", "Amount (₹)",
        "Total Bill (₹)", "Received (₹)", "Pending (₹)"
    ]
    for ci, h in enumerate(headers, 1):
        cell = ws.cell(row=2, column=ci, value=h)
        cell.font = SUBHDR_FONT; cell.fill = SUBHDR_FILL
        cell.alignment = CENTER; cell.border = CELL_BORDER
    ws.row_dimensions[2].height = 20

    # ── Data rows ─────────────────────────────────────────────────────────
    grand_sale = grand_received = grand_pending = 0.0
    prev_customer = None
    cust_sale = cust_received = cust_pending = 0.0
    cust_start_row = 3
    ri = 3

    def _write_customer_subtotal(ws, cust_name, start_row, end_row,
                                  sale, received, pending, ri):
        """Insert a subtotal row after all items for a customer."""
        sub_fill = PatternFill("solid", fgColor="EFF6FF")
        sub_font = Font(name="Segoe UI", size=9, bold=True, color="1E40AF")
        ws.merge_cells(f"A{ri}:G{ri}")
        lbl = ws.cell(row=ri, column=1,
                      value=f"  ↳ {cust_name} subtotal")
        lbl.font = sub_font; lbl.fill = sub_fill
        lbl.alignment = LEFT; lbl.border = CELL_BORDER
        for ci, val in enumerate([sale, received, pending], start=8):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.font = sub_font; cell.fill = sub_fill
            cell.number_format = NUM_FMT
            cell.alignment = RIGHT; cell.border = CELL_BORDER

    for row in rows:
        cname  = row.get("customer_name", "")
        status = (row.get("payment_status") or "unpaid").lower()

        # When customer changes, write subtotal for previous customer
        if prev_customer is not None and cname != prev_customer:
            _write_customer_subtotal(ws, prev_customer, cust_start_row, ri - 1,
                                     cust_sale, cust_received, cust_pending, ri)
            ri += 1
            cust_sale = cust_received = cust_pending = 0.0
            cust_start_row = ri

        # Accumulate per-customer
        amt      = float(row.get("amount")           or 0)
        t_bill   = float(row.get("total_bill_amount") or 0)
        a_paid   = float(row.get("amount_paid")       or 0)
        b_due    = float(row.get("balance_due")        or 0)

        # Only add payment info once per bill (not per item)
        # We track it per-row here; the route consolidates per bill
        cust_sale     += amt
        cust_received += float(row.get("item_received") or 0)
        cust_pending  += float(row.get("item_pending")  or 0)

        fill = EVEN_FILL if ri % 2 == 0 else ODD_FILL
        vals = [
            cname,
            row.get("bill_no"),
            row.get("bill_date"),
            row.get("product_name"),
            row.get("quantity"),
            row.get("rate"),
            amt,
            t_bill,
            a_paid,
            b_due,
        ]
        for ci, val in enumerate(vals, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.font = BODY_FONT; cell.fill = fill; cell.border = CELL_BORDER
            if ci <= 4:
                cell.alignment = LEFT
            else:
                cell.number_format = NUM_FMT
                cell.alignment = RIGHT

        prev_customer = cname
        ri += 1

    # Subtotal for last customer
    if prev_customer is not None:
        _write_customer_subtotal(ws, prev_customer, cust_start_row, ri - 1,
                                 cust_sale, cust_received, cust_pending, ri)
        ri += 1

    # ── Grand total row ───────────────────────────────────────────────────
    for row in rows:
        grand_sale     += float(row.get("amount")          or 0)
        grand_received += float(row.get("item_received")   or 0)
        grand_pending  += float(row.get("item_pending")    or 0)

    ws.merge_cells(f"A{ri}:G{ri}")
    lbl = ws.cell(row=ri, column=1, value="GRAND TOTAL")
    lbl.font = TOTAL_FONT; lbl.fill = TOTAL_FILL
    lbl.alignment = RIGHT; lbl.border = CELL_BORDER

    for ci, val in enumerate([grand_sale, grand_received, grand_pending], start=8):
        cell = ws.cell(row=ri, column=ci, value=val)
        cell.font = TOTAL_FONT; cell.fill = TOTAL_FILL
        cell.number_format = NUM_FMT; cell.alignment = RIGHT
        cell.border = CELL_BORDER

    # ── Summary sheet ─────────────────────────────────────────────────────
    ws2 = wb.create_sheet(title="Summary")
    ws2.merge_cells("A1:D1")
    s = ws2["A1"]
    s.value = f"PAYMENT SUMMARY — {report_date}"
    s.font = HEADER_FONT; s.fill = HEADER_FILL
    s.alignment = CENTER
    ws2.row_dimensions[1].height = 28

    sum_headers = ["Metric", "Amount (₹)"]
    for ci, h in enumerate(sum_headers, 1):
        cell = ws2.cell(row=2, column=ci, value=h)
        cell.font = SUBHDR_FONT; cell.fill = SUBHDR_FILL
        cell.alignment = CENTER; cell.border = CELL_BORDER

    summary_data = [
        ("Total Sale",      grand_sale,                  "16A34A"),
        ("Total Received",  grand_received,              "2563EB"),
        ("Total Pending",   grand_pending,               "DC2626"),
        ("Collection Rate", f"{(grand_received/grand_sale*100):.1f}%" if grand_sale else "0%", "7C3AED"),
    ]
    for sri, (label, value, color) in enumerate(summary_data, start=3):
        ws2.merge_cells(f"A{sri}:A{sri}")
        lc = ws2.cell(row=sri, column=1, value=label)
        lc.font = Font(name="Segoe UI", size=10, bold=True, color=color)
        lc.fill = EVEN_FILL if sri % 2 == 0 else ODD_FILL
        lc.alignment = LEFT; lc.border = CELL_BORDER

        vc = ws2.cell(row=sri, column=2, value=value)
        vc.font = Font(name="Segoe UI", size=11, bold=True, color=color)
        vc.fill = EVEN_FILL if sri % 2 == 0 else ODD_FILL
        if isinstance(value, float):
            vc.number_format = "₹#,##0.00"
        vc.alignment = RIGHT; vc.border = CELL_BORDER

    ws2.column_dimensions["A"].width = 22
    ws2.column_dimensions["B"].width = 20

    # ── Column widths for main sheet ──────────────────────────────────────
    widths = [24, 14, 12, 22, 10, 12, 14, 16, 14, 14]
    for ci, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(ci)].width = w

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

