from typing import List, Optional, Dict, Any
import uuid
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Bill, BillItem, Customer, Product, User, PaymentInstallment
from app.schemas.schemas import BillCreate, BillUpdate, BillOut, BillItemOut, BillPaymentUpdate, PaymentInstallmentOut, BulkWhatsAppRequest
from app.services.pdf_service import generate_bill_pdf
from app.services.whatsapp_service import send_whatsapp_direct, clean_phone_number, check_openwa_status
from app.services.cloudinary_service import upload_image_to_cloudinary

router = APIRouter(prefix="/bills", tags=["bills"])

def _format_bill_out(bill, db):
    items_out = []
    for item in bill.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first() if item.product_id else None
        items_out.append(BillItemOut(
            id=item.id, bill_id=item.bill_id, product_id=item.product_id,
            product_name=prod.name if prod else None,
            unit=prod.unit if (prod and prod.unit) else "kg",
            quantity=float(item.quantity or 0), rate=float(item.rate or 0),
            amount=float(item.amount or 0), tag=item.tag, circled_value=item.circled_value,
            confidence=float(item.confidence) if item.confidence is not None else 1.0,
            raw_text=item.raw_text
        ))
    cust = db.query(Customer).filter(Customer.id == bill.customer_id).first() if bill.customer_id else None
    tot = float(bill.total_amount or 0)
    paid = float(bill.amount_paid or 0)
    bal = float(bill.balance_due if bill.balance_due is not None else max(0.0, tot - paid))
    p_status = bill.payment_status or ("paid" if paid >= tot and tot > 0 else "partial" if paid > 0 else "unpaid")
    history_out = []
    for inst in bill.payment_installments:
        history_out.append(PaymentInstallmentOut(
            id=inst.id, bill_id=inst.bill_id, amount=float(inst.amount),
            payment_method=inst.payment_method, note=inst.note, paid_at=inst.paid_at
        ))
    return BillOut(
        id=bill.id, customer_id=bill.customer_id,
        customer_name=cust.name if cust else None,
        customer_phone=cust.phone if cust else None,
        customer_address=cust.address if cust else None,
        bill_no=bill.bill_no, bill_date=bill.bill_date,
        total_amount=tot, amount_paid=paid, balance_due=bal,
        payment_status=p_status, payment_method=bill.payment_method or "Cash",
        source=bill.source, upload_id=bill.upload_id, image_path=bill.image_path,
        status=bill.status, created_at=bill.created_at,
        items=items_out, payment_history=history_out
    )

@router.get("", response_model=List[BillOut])
def list_bills(
    customer_id: Optional[int] = None, start_date: Optional[str] = None,
    end_date: Optional[str] = None, source: Optional[str] = None,
    limit: int = 100, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Bill).join(Customer, Customer.id == Bill.customer_id)  # excludes orphan bills
    if customer_id: query = query.filter(Bill.customer_id == customer_id)
    if start_date: query = query.filter(Bill.bill_date >= start_date)
    if end_date: query = query.filter(Bill.bill_date <= end_date)
    if source: query = query.filter(Bill.source == source)
    else: query = query.filter(Bill.source != "ledger_ai")
    bills = query.order_by(Bill.bill_date.desc(), Bill.id.desc()).limit(limit).all()
    return [_format_bill_out(b, db) for b in bills]

@router.post("", response_model=BillOut)
def create_manual_bill(data: BillCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cust = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not cust: raise HTTPException(status_code=404, detail="Customer not found")
    bill_no = "BILL-" + data.bill_date.replace("-", "") + "-" + str(uuid.uuid4())[:6].upper()
    total = sum((item.quantity * item.rate) for item in data.items)
    paid = max(0.0, float(data.amount_paid or 0))
    if paid > total: paid = total
    bal = max(0.0, total - paid)
    p_status = "paid" if paid >= total and total > 0 else "partial" if paid > 0 else "unpaid"
    bill = Bill(
        customer_id=data.customer_id, bill_no=bill_no, bill_date=data.bill_date,
        total_amount=total, amount_paid=paid, balance_due=bal, payment_status=p_status,
        payment_method=data.payment_method or "Cash", source=data.source,
        upload_id=data.upload_id, image_path=data.image_path, status="active"
    )
    db.add(bill)
    db.flush()
    for item in data.items:
        line_total = item.amount if item.amount is not None else (item.quantity * item.rate)
        db.add(BillItem(
            bill_id=bill.id, product_id=item.product_id, quantity=item.quantity,
            rate=item.rate, amount=line_total, tag=item.tag, circled_value=item.circled_value,
            confidence=item.confidence or 1.0, raw_text=item.raw_text
        ))
    if paid > 0:
        db.add(PaymentInstallment(
            bill_id=bill.id, amount=paid,
            payment_method=data.payment_method or "Cash",
            note="Initial payment at bill creation"
        ))
    db.commit()
    db.refresh(bill)
    return _format_bill_out(bill, db)

@router.get("/{bill_id}", response_model=BillOut)
def get_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill: raise HTTPException(status_code=404, detail="Bill not found")
    return _format_bill_out(bill, db)

@router.put("/{bill_id}", response_model=BillOut)
def edit_bill(bill_id: int, data: BillUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Edit a bill's customer, date, items, and payment method"""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill: raise HTTPException(status_code=404, detail="Bill not found")
    
    # Update customer if provided
    if data.customer_id is not None:
        cust = db.query(Customer).filter(Customer.id == data.customer_id).first()
        if not cust: raise HTTPException(status_code=404, detail="Customer not found")
        bill.customer_id = data.customer_id
    
    # Update bill date if provided
    if data.bill_date is not None:
        bill.bill_date = data.bill_date
    
    # Update payment method if provided
    if data.payment_method is not None:
        bill.payment_method = data.payment_method
    
    # Update items if provided
    if data.items is not None:
        # Delete old items
        db.query(BillItem).filter(BillItem.bill_id == bill_id).delete()
        
        # Calculate new total
        new_total = sum((item.quantity * item.rate) for item in data.items)
        
        # Recalculate payment status
        current_paid = float(bill.amount_paid or 0)
        if current_paid > new_total:
            current_paid = new_total
        
        new_bal = max(0.0, new_total - current_paid)
        
        if current_paid >= new_total and new_total > 0:
            p_status = "paid"
        elif current_paid > 0:
            p_status = "partial"
        else:
            p_status = "unpaid"
        
        # Update bill totals
        bill.total_amount = new_total
        bill.amount_paid = current_paid
        bill.balance_due = new_bal
        bill.payment_status = p_status
        
        # Add new items
        for item in data.items:
            line_total = item.amount if item.amount is not None else (item.quantity * item.rate)
            db.add(BillItem(
                bill_id=bill.id, product_id=item.product_id, quantity=item.quantity,
                rate=item.rate, amount=line_total, tag=item.tag, circled_value=item.circled_value,
                confidence=item.confidence or 1.0, raw_text=item.raw_text
            ))
    
    db.commit()
    db.refresh(bill)
    return _format_bill_out(bill, db)

@router.put("/{bill_id}/payment", response_model=BillOut)
def update_bill_payment(bill_id: int, data: BillPaymentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill: raise HTTPException(status_code=404, detail="Bill not found")
    tot = float(bill.total_amount or 0)
    current_paid = float(bill.amount_paid or 0)
    current_balance = float(bill.balance_due if bill.balance_due is not None else max(0.0, tot - current_paid))
    installment = float(data.installment_amount or 0)
    if installment <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")
    if installment > current_balance + 0.001:
        raise HTTPException(status_code=400, detail="Payment Rs" + str(round(installment,2)) + " exceeds remaining balance Rs" + str(round(current_balance,2)) + ". Cannot overpay.")
    new_paid = current_paid + installment
    new_bal = max(0.0, tot - new_paid)
    if new_paid >= tot: new_paid = tot; new_bal = 0.0; p_status = "paid"
    elif new_paid > 0: p_status = "partial"
    else: p_status = "unpaid"
    prev_method = bill.payment_method or "Cash"
    new_method = data.payment_method or "Cash"
    if current_paid > 0 and prev_method != new_method and prev_method != "Mixed":
        combined_method = "Mixed"
    else:
        combined_method = new_method
    bill.amount_paid = new_paid
    bill.balance_due = new_bal
    bill.payment_status = p_status
    bill.payment_method = combined_method
    db.add(PaymentInstallment(bill_id=bill.id, amount=installment, payment_method=new_method, note=data.note))
    db.commit()
    db.refresh(bill)
    return _format_bill_out(bill, db)

@router.delete("/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill: raise HTTPException(status_code=404, detail="Bill not found")
    db.query(BillItem).filter(BillItem.bill_id == bill_id).delete()
    db.query(PaymentInstallment).filter(PaymentInstallment.bill_id == bill_id).delete()
    db.delete(bill)
    db.commit()
    return {"message": "Bill deleted successfully"}

@router.get("/{bill_id}/pdf")
def get_bill_pdf(bill_id: int, db: Session = Depends(get_db)):
    """Generates and downloads the PDF invoice for a bill."""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    formatted = _format_bill_out(bill, db)
    
    # Prepare bill data dictionary for PDF generator
    bill_dict = {
        "bill_no": formatted.bill_no,
        "bill_date": formatted.bill_date,
        "customer_name": formatted.customer_name or "Valued Customer",
        "customer_phone": formatted.customer_phone or "",
        "customer_address": formatted.customer_address or "",
        "payment_status": formatted.payment_status,
        "payment_method": formatted.payment_method,
        "total_amount": formatted.total_amount,
        "amount_paid": formatted.amount_paid,
        "balance_due": formatted.balance_due,
        "items": [
            {
                "name": item.product_name or "Custom Item",
                "unit": item.unit or "kg",
                "quantity": item.quantity,
                "rate": item.rate,
                "amount": item.amount
            }
            for item in formatted.items
        ],
        "payment_history": [
            {
                "amount": inst.amount,
                "payment_method": inst.payment_method,
                "paid_at": inst.paid_at.isoformat() if inst.paid_at else "",
                "note": inst.note
            }
            for inst in formatted.payment_history
        ]
    }
    
    pdf_bytes = generate_bill_pdf(bill_dict)
    filename = f"Invoice_{formatted.bill_no or bill_id}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.get("/whatsapp-gateway-status")
def get_whatsapp_gateway_status():
    """Checks the live connectivity status of the OpenWA WhatsApp Gateway."""
    return check_openwa_status()

@router.get("/{bill_id}/whatsapp-link")
def get_whatsapp_share_link(bill_id: int, db: Session = Depends(get_db)):
    """Returns formatted WhatsApp message & click-to-chat URL."""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    formatted = _format_bill_out(bill, db)
    cust_phone = (formatted.customer_phone or "").strip()
    clean_phone = clean_phone_number(cust_phone)
    
    # Formulate message
    status_emoji = "✅ Paid Complete" if formatted.payment_status == "paid" else ("🟡 Partial Paid" if formatted.payment_status == "partial" else "🔴 Unpaid")
    
    lines = [
        f"🧾 *INVOICE: #{formatted.bill_no}*",
        f"👤 *Customer:* {formatted.customer_name or 'Customer'}",
        f"📅 *Date:* {formatted.bill_date}",
        "────────────────────",
    ]
    for itm in formatted.items:
        lines.append(f"• {itm.product_name or 'Item'}: {itm.quantity:g} × ₹{itm.rate:.2f} = *₹{itm.amount:.2f}*")
    
    lines.extend([
        "────────────────────",
        f"💰 *Total Amount:* ₹{formatted.total_amount:.2f}",
        f"💳 *Amount Paid ({formatted.payment_method}):* ₹{formatted.amount_paid:.2f}",
        f"⏳ *Balance Due:* ₹{formatted.balance_due:.2f}",
        f"📌 *Payment Status:* {status_emoji}",
        "",
        "🙏 _Thank you for your business!_",
    ])
    
    message_text = "\n".join(lines)
    encoded_text = urllib.parse.quote(message_text)
    
    wa_url = f"https://wa.me/{clean_phone}?text={encoded_text}" if clean_phone else f"https://wa.me/?text={encoded_text}"
    
    return {
        "phone": clean_phone,
        "message": message_text,
        "whatsapp_url": wa_url
    }

def _build_bill_whatsapp_payload(bill, db):
    """Helper to build PDF bytes, Cloudinary URL, and message for a bill."""
    formatted = _format_bill_out(bill, db)
    cust_phone = (formatted.customer_phone or "").strip()
    cleaned_phone = clean_phone_number(cust_phone)
    
    bill_dict = {
        "bill_no": formatted.bill_no,
        "bill_date": formatted.bill_date,
        "customer_name": formatted.customer_name or "Valued Customer",
        "customer_phone": formatted.customer_phone or "",
        "customer_address": formatted.customer_address or "",
        "payment_status": formatted.payment_status,
        "payment_method": formatted.payment_method,
        "total_amount": formatted.total_amount,
        "amount_paid": formatted.amount_paid,
        "balance_due": formatted.balance_due,
        "items": [
            {
                "name": item.product_name or "Custom Item",
                "unit": item.unit or "kg",
                "quantity": item.quantity,
                "rate": item.rate,
                "amount": item.amount
            }
            for item in formatted.items
        ],
        "payment_history": [
            {
                "amount": inst.amount,
                "payment_method": inst.payment_method,
                "paid_at": inst.paid_at.isoformat() if inst.paid_at else "",
                "note": inst.note
            }
            for inst in formatted.payment_history
        ]
    }
    
    # Formulate message
    status_emoji = "✅ Paid Complete" if formatted.payment_status == "paid" else ("🟡 Partial Paid" if formatted.payment_status == "partial" else "🔴 Unpaid")
    lines = [
        f"🧾 *INVOICE: #{formatted.bill_no}*",
        f"👤 *Customer:* {formatted.customer_name or 'Customer'}",
        f"📅 *Date:* {formatted.bill_date}",
        "────────────────────",
    ]
    for itm in formatted.items:
        lines.append(f"• {itm.product_name or 'Item'}: {itm.quantity:g} × ₹{itm.rate:.2f} = *₹{itm.amount:.2f}*")
    
    lines.extend([
        "────────────────────",
        f"💰 *Total Amount:* ₹{formatted.total_amount:.2f}",
        f"💳 *Amount Paid ({formatted.payment_method}):* ₹{formatted.amount_paid:.2f}",
        f"⏳ *Balance Due:* ₹{formatted.balance_due:.2f}",
        f"📌 *Payment Status:* {status_emoji}",
        "",
        "🙏 _Thank you for your business!_",
    ])
    message_text = "\n".join(lines)
    
    pdf_bytes = generate_bill_pdf(bill_dict)
    pdf_filename = f"Invoice_{formatted.bill_no or bill.id}.pdf"
    
    pdf_url = None
    try:
        cld = upload_image_to_cloudinary(
            pdf_bytes,
            folder="smartbill_invoices",
            public_id=f"inv_{formatted.bill_no or bill.id}"
        )
        if cld and cld.get("secure_url"):
            pdf_url = cld.get("secure_url")
    except Exception:
        pdf_url = None
        
    return {
        "formatted": formatted,
        "phone": cleaned_phone,
        "message": message_text,
        "pdf_bytes": pdf_bytes,
        "pdf_url": pdf_url,
        "pdf_filename": pdf_filename
    }

@router.post("/{bill_id}/send-whatsapp")
def send_bill_whatsapp_direct(bill_id: int, db: Session = Depends(get_db)):
    """Dispatches a single bill invoice PDF directly to customer via OpenWA / WhatsApp."""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
        
    payload = _build_bill_whatsapp_payload(bill, db)
    if not payload["phone"]:
        raise HTTPException(status_code=400, detail="Customer has no phone number saved.")
        
    res = send_whatsapp_direct(
        phone=payload["phone"],
        message=payload["message"],
        pdf_bytes=payload["pdf_bytes"],
        pdf_url=payload["pdf_url"],
        pdf_filename=payload["pdf_filename"]
    )
    return res

@router.post("/bulk-whatsapp")
def bulk_send_whatsapp(payload: BulkWhatsAppRequest, db: Session = Depends(get_db)):
    """Sends WhatsApp bill invoices in bulk to all selected customer bills."""
    results = []
    sent_count = 0
    failed_count = 0
    skipped_count = 0
    
    for bill_id in payload.bill_ids:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            results.append({"bill_id": bill_id, "status": "failed", "error": "Bill not found"})
            failed_count += 1
            continue
            
        data = _build_bill_whatsapp_payload(bill, db)
        formatted = data["formatted"]
        cleaned_phone = data["phone"]
        
        if not cleaned_phone:
            results.append({
                "bill_id": bill_id,
                "bill_no": formatted.bill_no,
                "customer_name": formatted.customer_name,
                "status": "skipped",
                "error": "No phone number saved for customer"
            })
            skipped_count += 1
            continue
            
        send_res = send_whatsapp_direct(
            phone=cleaned_phone,
            message=data["message"],
            pdf_bytes=data["pdf_bytes"],
            pdf_url=data["pdf_url"],
            pdf_filename=data["pdf_filename"]
        )
        
        if send_res.get("success"):
            sent_count += 1
            results.append({
                "bill_id": bill_id,
                "bill_no": formatted.bill_no,
                "customer_name": formatted.customer_name,
                "phone": cleaned_phone,
                "status": "sent",
                "provider": send_res.get("provider", "direct_api"),
                "mode": send_res.get("mode", "direct_api"),
                "whatsapp_url": send_res.get("whatsapp_url"),
                "pdf_url": data["pdf_url"]
            })
        else:
            failed_count += 1
            results.append({
                "bill_id": bill_id,
                "bill_no": formatted.bill_no,
                "customer_name": formatted.customer_name,
                "phone": cleaned_phone,
                "status": "failed",
                "error": send_res.get("error")
            })
            
    return {
        "total": len(payload.bill_ids),
        "sent": sent_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "delay_seconds": payload.delay_seconds,
        "details": results
    }
