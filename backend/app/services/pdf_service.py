import io
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)

def generate_bill_pdf(bill_data: dict) -> bytes:
    """
    Generates a professional PDF invoice for a bill.
    bill_data expected format:
    {
        "bill_no": "BILL-20261002-ABC123",
        "bill_date": "2026-10-02",
        "customer_name": "Ramesh Kumar",
        "customer_phone": "+91 9876543210",
        "customer_address": "Shop #12, Market Road",
        "payment_status": "paid" | "partial" | "unpaid",
        "payment_method": "Cash" | "UPI" | "Mixed",
        "total_amount": 1500.00,
        "amount_paid": 1000.00,
        "balance_due": 500.00,
        "items": [
            {"name": "Milk", "unit": "litre", "quantity": 10, "rate": 60.0, "amount": 600.0},
            {"name": "Paneer", "unit": "kg", "quantity": 2, "rate": 450.0, "amount": 900.0}
        ],
        "payment_history": [
            {"amount": 1000.0, "payment_method": "UPI", "paid_at": "2026-10-02T10:00:00", "note": "Advance"}
        ]
    }
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    brand_style = ParagraphStyle(
        'BrandTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#059669")  # Emerald 600
    )
    sub_brand_style = ParagraphStyle(
        'SubBrand',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#6B7280")
    )
    invoice_title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=2,  # Right aligned
        textColor=colors.HexColor("#111827")
    )
    invoice_meta_style = ParagraphStyle(
        'InvoiceMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=2,
        textColor=colors.HexColor("#374151")
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#374151")
    )
    cust_info_style = ParagraphStyle(
        'CustInfo',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1F2937")
    )
    table_hdr_style = ParagraphStyle(
        'TableHdr',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1F2937")
    )
    table_cell_right = ParagraphStyle(
        'TableCellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#1F2937")
    )
    table_cell_bold_right = ParagraphStyle(
        'TableCellBoldRight',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#1F2937")
    )

    story = []

    # 1. Header Grid: Brand on Left, Invoice Details on Right
    bill_no = bill_data.get("bill_no", "N/A")
    bill_date = bill_data.get("bill_date", "")
    p_status = bill_data.get("payment_status", "unpaid").upper()
    tot = float(bill_data.get("total_amount", 0))
    paid = float(bill_data.get("amount_paid", 0))
    bal = float(bill_data.get("balance_due", max(0.0, tot - paid)))
    prev_bal = float(bill_data.get("previous_balance", 0.0))
    total_net_due = float(bill_data.get("total_due_with_carry_forward", bal + prev_bal))
    
    if prev_bal > 0.009 and p_status == "PAID":
        status_text = f"<font color='#059669'><b>● BILL PAID</b></font> <font color='#DC2626'><b>(PREV DUE: Rs. {prev_bal:.2f})</b></font>"
    else:
        status_color = "#059669" if p_status == "PAID" else ("#D97706" if p_status == "PARTIAL" else "#DC2626")
        status_text = f"<font color='{status_color}'><b>● {p_status}</b></font>"

    header_table_data = [
        [
            Paragraph("<b>BillTrack</b>", brand_style),
            Paragraph("<b>TAX INVOICE</b>", invoice_title_style)
        ],
        [
            Paragraph("Billing & Business Management", sub_brand_style),
            Paragraph(f"<b>Invoice No:</b> #{bill_no}<br/><b>Date:</b> {bill_date}<br/><b>Status:</b> {status_text}", invoice_meta_style)
        ]
    ]
    header_table = Table(header_table_data, colWidths=[260, 260])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 14))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E5E7EB"), spaceAfter=14))

    # 2. Customer Info (Billed To)
    cust_name = bill_data.get("customer_name", "Valued Customer")
    cust_phone = bill_data.get("customer_phone", "")
    cust_addr = bill_data.get("customer_address", "")
    
    cust_lines = [f"<b>{cust_name}</b>"]
    if cust_phone:
        cust_lines.append(f"Phone: {cust_phone}")
    if cust_addr:
        cust_lines.append(f"Address: {cust_addr}")

    if prev_bal > 0.009:
        pay_summary_lines = (
            f"Payment Mode: <b>{bill_data.get('payment_method', 'Cash')}</b><br/>"
            f"Current Bill: <b>Rs. {tot:.2f}</b> (Paid: <b>Rs. {paid:.2f}</b>)<br/>"
            f"Prev. Balance (C/F): <font color='#DC2626'><b>Rs. {prev_bal:.2f}</b></font><br/>"
            f"Total Outstanding: <font color='#DC2626'><b>Rs. {total_net_due:.2f}</b></font>"
        )
    else:
        pay_summary_lines = (
            f"Payment Mode: <b>{bill_data.get('payment_method', 'Cash')}</b><br/>"
            f"Total: <b>Rs. {tot:.2f}</b><br/>"
            f"Paid: <b>Rs. {paid:.2f}</b><br/>"
            f"Balance: <b>Rs. {bal:.2f}</b>"
        )

    billed_to_data = [
        [
            Paragraph("<b>BILLED TO:</b>", section_heading),
            Paragraph("<b>PAYMENT SUMMARY:</b>", section_heading)
        ],
        [
            Paragraph("<br/>".join(cust_lines), cust_info_style),
            Paragraph(pay_summary_lines, cust_info_style)
        ]
    ]
    cust_table = Table(billed_to_data, colWidths=[260, 260])
    cust_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(cust_table)
    story.append(Spacer(1, 16))

    # 3. Items Table
    items = bill_data.get("items", [])
    items_table_data = [
        [
            Paragraph("<b>#</b>", table_hdr_style),
            Paragraph("<b>Item Description</b>", table_hdr_style),
            Paragraph("<b>Unit</b>", table_hdr_style),
            Paragraph("<b>Qty</b>", table_hdr_style),
            Paragraph("<b>Rate (Rs.)</b>", table_hdr_style),
            Paragraph("<b>Amount (Rs.)</b>", table_hdr_style),
        ]
    ]

    for idx, itm in enumerate(items, 1):
        name = itm.get("product_name") or itm.get("name") or "Item"
        unit = itm.get("unit", "pcs")
        qty = float(itm.get("quantity", 0))
        rate = float(itm.get("rate", 0))
        amt = float(itm.get("amount", qty * rate))

        items_table_data.append([
            Paragraph(str(idx), table_cell_style),
            Paragraph(name, table_cell_style),
            Paragraph(unit, table_cell_style),
            Paragraph(f"{qty:g}", table_cell_right),
            Paragraph(f"{rate:.2f}", table_cell_right),
            Paragraph(f"{amt:.2f}", table_cell_bold_right),
        ])

    items_table = Table(
        items_table_data,
        colWidths=[25, 215, 50, 65, 75, 90]
    )
    
    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#065F46")), # Emerald 800
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]
    # Alternating row colors
    for r in range(1, len(items_table_data)):
        if r % 2 == 0:
            t_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor("#F9FAFB")))

    items_table.setStyle(TableStyle(t_style))
    story.append(items_table)
    story.append(Spacer(1, 14))

    # 4. Financial Total Summary Box (aligned right)
    summary_box_style_red = ParagraphStyle('BalDueRed', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor("#DC2626"))
    summary_box_style_red_val = ParagraphStyle('BalDueRedVal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=2, textColor=colors.HexColor("#DC2626"))
    tot_due_color = "#DC2626" if total_net_due > 0 else "#059669"
    tot_due_style = ParagraphStyle('TotDueStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor(tot_due_color))
    tot_due_val_style = ParagraphStyle('TotDueValStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, alignment=2, textColor=colors.HexColor(tot_due_color))

    summary_t_style = [
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F3F4F6")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]

    if prev_bal > 0.009:
        summary_data = [
            [Paragraph("<b>Current Bill Total:</b>", table_cell_style), Paragraph(f"<b>Rs. {tot:.2f}</b>", table_cell_bold_right)],
            [Paragraph(f"Amount Paid ({bill_data.get('payment_method', 'Cash')}):", table_cell_style), Paragraph(f"Rs. {paid:.2f}", table_cell_right)],
            [Paragraph("Current Bill Balance:", table_cell_style), Paragraph(f"Rs. {bal:.2f}", table_cell_bold_right)],
            [Paragraph("<b>Previous Balance (C/F):</b>", summary_box_style_red), Paragraph(f"<b>+ Rs. {prev_bal:.2f}</b>", summary_box_style_red_val)],
            [Paragraph("<b>Total Amount Due:</b>", tot_due_style), Paragraph(f"<b>Rs. {total_net_due:.2f}</b>", tot_due_val_style)],
        ]
        summary_t_style.append(('LINEABOVE', (0, 3), (-1, 3), 0.5, colors.HexColor("#D1D5DB")))
        summary_t_style.append(('LINEABOVE', (0, 4), (-1, 4), 1.2, colors.HexColor("#9CA3AF")))
        summary_t_style.append(('BACKGROUND', (0, 4), (-1, 4), colors.HexColor("#FEE2E2") if total_net_due > 0 else colors.HexColor("#D1FAE5")))
    else:
        bal_color = "#DC2626" if bal > 0 else "#059669"
        bal_style = ParagraphStyle('BalDueSimple', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor(bal_color))
        bal_val_style = ParagraphStyle('BalDueValSimple', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, alignment=2, textColor=colors.HexColor(bal_color))
        summary_data = [
            [Paragraph("<b>Subtotal / Total Bill:</b>", table_cell_style), Paragraph(f"<b>Rs. {tot:.2f}</b>", table_cell_bold_right)],
            [Paragraph(f"Amount Paid ({bill_data.get('payment_method', 'Cash')}):", table_cell_style), Paragraph(f"Rs. {paid:.2f}", table_cell_right)],
            [Paragraph("<b>Balance Due:</b>", bal_style), Paragraph(f"<b>Rs. {bal:.2f}</b>", bal_val_style)],
        ]
        summary_t_style.append(('LINEABOVE', (0, 2), (-1, 2), 1, colors.HexColor("#D1D5DB")))

    summary_table = Table(summary_data, colWidths=[160, 100])
    summary_table.setStyle(TableStyle(summary_t_style))

    # Wrap summary in outer table to push to right
    outer_summary = Table([["", summary_table]], colWidths=[260, 260])
    outer_summary.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(outer_summary)
    story.append(Spacer(1, 14))

    # 4b. Previous Unpaid Bills Breakdown Table (if carry forward exists)
    previous_bills = bill_data.get("previous_bills", [])
    if prev_bal > 0.009 and len(previous_bills) > 0:
        story.append(Paragraph("<b>Previous Unpaid Bills (Carried Forward Details):</b>", section_heading))
        story.append(Spacer(1, 4))
        prev_table_hdr_red = ParagraphStyle('PrevHdrRed', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, alignment=2, textColor=colors.HexColor("#DC2626"))
        prev_cell_red = ParagraphStyle('PrevCellRed', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, alignment=2, textColor=colors.HexColor("#DC2626"))
        prev_cell_style = ParagraphStyle('PrevCell', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor("#1F2937"))
        prev_cell_right = ParagraphStyle('PrevCellR', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=10, alignment=2, textColor=colors.HexColor("#1F2937"))

        prev_table_data = [
            [
                Paragraph("<b>#</b>", prev_cell_style),
                Paragraph("<b>Invoice No</b>", prev_cell_style),
                Paragraph("<b>Date</b>", prev_cell_style),
                Paragraph("<b>Bill Total</b>", prev_cell_right),
                Paragraph("<b>Amount Paid</b>", prev_cell_right),
                Paragraph("<b>Pending Due</b>", prev_table_hdr_red),
            ]
        ]
        for p_idx, pb in enumerate(previous_bills, 1):
            prev_table_data.append([
                Paragraph(str(p_idx), prev_cell_style),
                Paragraph(str(pb.get("bill_no") or "N/A"), prev_cell_style),
                Paragraph(str(pb.get("bill_date") or ""), prev_cell_style),
                Paragraph(f"Rs. {float(pb.get('total_amount', 0)):.2f}", prev_cell_right),
                Paragraph(f"Rs. {float(pb.get('amount_paid', 0)):.2f}", prev_cell_right),
                Paragraph(f"Rs. {float(pb.get('balance_due', 0)):.2f}", prev_cell_red),
            ])

        prev_table = Table(prev_table_data, colWidths=[25, 175, 80, 80, 80, 80])
        prev_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#FEE2E2")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(prev_table)
        story.append(Spacer(1, 14))

    # 5. Payment Installment History (if any)
    installments = bill_data.get("payment_history", [])
    if len(installments) > 0:
        story.append(Paragraph("<b>Payment Installments Recorded:</b>", section_heading))
        story.append(Spacer(1, 4))
        inst_table_data = [
            [
                Paragraph("<b>#</b>", table_cell_style),
                Paragraph("<b>Date & Time</b>", table_cell_style),
                Paragraph("<b>Payment Mode</b>", table_cell_style),
                Paragraph("<b>Note</b>", table_cell_style),
                Paragraph("<b>Amount Paid</b>", table_cell_bold_right),
            ]
        ]
        for i_idx, inst in enumerate(installments, 1):
            paid_time = str(inst.get("paid_at", ""))[:19].replace("T", " ")
            inst_table_data.append([
                Paragraph(str(i_idx), table_cell_style),
                Paragraph(paid_time, table_cell_style),
                Paragraph(inst.get("payment_method", "Cash"), table_cell_style),
                Paragraph(inst.get("note") or "—", table_cell_style),
                Paragraph(f"+Rs. {float(inst.get('amount', 0)):.2f}", table_cell_bold_right),
            ])
        inst_table = Table(inst_table_data, colWidths=[25, 140, 95, 160, 100])
        inst_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(inst_table)
        story.append(Spacer(1, 14))

    # 6. Footer Note
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB"), spaceAfter=8))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        alignment=1, # Center
        textColor=colors.HexColor("#9CA3AF")
    )
    story.append(Paragraph("Thank you for your business! This is a computer-generated invoice from BillTrack.", footer_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
