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

    billed_to_data = [
        [
            Paragraph("<b>BILLED TO:</b>", section_heading),
            Paragraph("<b>PAYMENT SUMMARY:</b>", section_heading)
        ],
        [
            Paragraph("<br/>".join(cust_lines), cust_info_style),
            Paragraph(f"Payment Mode: <b>{bill_data.get('payment_method', 'Cash')}</b><br/>Total: <b>Rs. {float(bill_data.get('total_amount', 0)):.2f}</b><br/>Paid: <b>Rs. {float(bill_data.get('amount_paid', 0)):.2f}</b>", cust_info_style)
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
    tot = float(bill_data.get("total_amount", 0))
    paid = float(bill_data.get("amount_paid", 0))
    bal = float(bill_data.get("balance_due", max(0.0, tot - paid)))

    summary_data = [
        [Paragraph("<b>Subtotal / Total Bill:</b>", table_cell_style), Paragraph(f"<b>Rs. {tot:.2f}</b>", table_cell_bold_right)],
        [Paragraph(f"Amount Paid ({bill_data.get('payment_method', 'Cash')}):", table_cell_style), Paragraph(f"Rs. {paid:.2f}", table_cell_right)],
        [
            Paragraph("<b>Balance Due:</b>", ParagraphStyle('BalDue', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor("#DC2626" if bal > 0 else "#059669"))),
            Paragraph(f"<b>Rs. {bal:.2f}</b>", ParagraphStyle('BalDueVal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, alignment=2, textColor=colors.HexColor("#DC2626" if bal > 0 else "#059669")))
        ],
    ]
    summary_table = Table(summary_data, colWidths=[150, 110])
    summary_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LINEABOVE', (0,2), (-1,2), 1, colors.HexColor("#D1D5DB")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F3F4F6")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))

    # Wrap summary in outer table to push to right
    outer_summary = Table([["", summary_table]], colWidths=[260, 260])
    outer_summary.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(outer_summary)
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
