from typing import List, Optional, Dict, Any, Union
import uuid
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Bill, BillItem, Customer, Product, User, PaymentInstallment
from app.schemas.schemas import (
    BillCreate, BillUpdate, BillOut, BillItemOut, BillPaymentUpdate,
    PaymentInstallmentOut, BulkWhatsAppRequest, PaginatedBillsOut
)
from app.services.pdf_service import generate_bill_pdf
from app.services.whatsapp_service import send_whatsapp_direct, clean_phone_number, check_openwa_status
from app.services.cloudinary_service import upload_image_to_cloudinary

router = APIRouter(prefix="/bills", tags=["bills"])

from sqlalchemy.orm import joinedload, selectinload

def _get_previous_unpaid_bills(bill, db):
    """Returns list of other unpaid/partial bills for the same customer, ordered by date, excluding current bill."""
    if not bill.customer_id:
        return []
    return (
        db.query(Bill)
        .filter(
            Bill.customer_id == bill.customer_id,
            Bill.id != bill.id,
            Bill.payment_status.in_(["unpaid", "partial"]),
            Bill.balance_due > 0,
        )
        .order_by(Bill.bill_date.asc(), Bill.id.asc())
        .all()
    )

def _get_bill_eager(bill_id: int, db: Session) -> Optional[Bill]:
    """Helper to fetch a single bill with all its relationships eager loaded."""
    return (
        db.query(Bill)
        .options(
            joinedload(Bill.customer),
            selectinload(Bill.items).joinedload(BillItem.product),
            selectinload(Bill.payment_installments),
        )
        .filter(Bill.id == bill_id)
        .first()
    )

def _format_single_bill(bill, all_customer_unpaid=None):
    """In-memory formatter: 0 SQL queries executed."""
    items_out = []
    for item in (bill.items or []):
        prod = item.product
        items_out.append(BillItemOut(
            id=item.id, bill_id=item.bill_id, product_id=item.product_id,
            product_name=prod.name if prod else None,
            unit=prod.unit if (prod and prod.unit) else "kg",
            quantity=float(item.quantity or 0), rate=float(item.rate or 0),
            amount=float(item.amount or 0), tag=item.tag, circled_value=item.circled_value,
            confidence=float(item.confidence) if item.confidence is not None else 1.0,
            raw_text=item.raw_text
        ))
    cust = bill.customer
    tot = float(bill.total_amount or 0)
    paid = float(bill.amount_paid or 0)
    bal = float(bill.balance_due if bill.balance_due is not None else max(0.0, tot - paid))
    p_status = bill.payment_status or ("paid" if paid >= tot and tot > 0 else "partial" if paid > 0 else "unpaid")
    history_out = []
    for inst in (bill.payment_installments or []):
        history_out.append(PaymentInstallmentOut(
            id=inst.id, bill_id=inst.bill_id, amount=float(inst.amount),
            payment_method=inst.payment_method, note=inst.note, paid_at=inst.paid_at
        ))

    # Older unpaid bills (excluding current bill)
    if all_customer_unpaid:
        prev_bills_list = [pb for pb in all_customer_unpaid if pb.id != bill.id]
    else:
        prev_bills_list = []

    cust_opening = float(getattr(cust, 'opening_balance', 0) or 0) if cust else 0.0
    prev_balance = cust_opening + sum(float(pb.balance_due or 0) for pb in prev_bills_list)
    total_due_cf = bal + prev_balance
    prev_bills_out = [
        {
            "bill_no": pb.bill_no or f"INV-{pb.id}",
            "bill_date": pb.bill_date,
            "total_amount": float(pb.total_amount or 0),
            "amount_paid": float(pb.amount_paid or 0),
            "balance_due": float(pb.balance_due or 0),
        }
        for pb in prev_bills_list[:5]
    ]
    return BillOut(
        id=bill.id, customer_id=bill.customer_id,
        customer_name=cust.name if cust else None,
        customer_phone=cust.phone if cust else None,
        customer_address=cust.address if cust else None,
        bill_no=bill.bill_no, bill_date=bill.bill_date,
        total_amount=tot, amount_paid=paid, balance_due=bal,
        previous_balance=prev_balance,
        total_due_with_carry_forward=total_due_cf,
        payment_status=p_status, payment_method=bill.payment_method or "Cash",
        source=bill.source, upload_id=bill.upload_id, image_path=bill.image_path,
        status=bill.status, created_at=bill.created_at,
        items=items_out, payment_history=history_out,
        previous_bills=prev_bills_out
    )

def _format_bill_out(bill, db):
    prev_bills = _get_previous_unpaid_bills(bill, db) if db else []
    return _format_single_bill(bill, prev_bills)

def _format_bills_batch(bills, db: Session):
    """Batch formats a list of bills with 1 query for all customer previous unpaid balances."""
    if not bills:
        return []

    cust_ids = list({b.customer_id for b in bills if b.customer_id})
    unpaid_by_customer = {cid: [] for cid in cust_ids}
    if cust_ids:
        all_unpaid = (
            db.query(Bill)
            .filter(
                Bill.customer_id.in_(cust_ids),
                Bill.payment_status.in_(["unpaid", "partial"]),
                Bill.balance_due > 0,
            )
            .order_by(Bill.bill_date.asc(), Bill.id.asc())
            .all()
        )
        for ub in all_unpaid:
            if ub.customer_id in unpaid_by_customer:
                unpaid_by_customer[ub.customer_id].append(ub)

    return [_format_single_bill(b, unpaid_by_customer.get(b.customer_id, [])) for b in bills]

@router.get("", response_model=Union[PaginatedBillsOut, List[BillOut]])
def list_bills(
    customer_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    limit: Optional[int] = 100,
    offset: Optional[int] = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        db.query(Bill)
        .join(Customer, Customer.id == Bill.customer_id)
    )
    if customer_id:
        query = query.filter(Bill.customer_id == customer_id)
    if start_date:
        query = query.filter(Bill.bill_date >= start_date)
    if end_date:
        query = query.filter(Bill.bill_date <= end_date)
    if source and source.strip() and source.lower() != "all":
        query = query.filter(Bill.source == source.strip())
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Bill.bill_no.ilike(term),
                Customer.name.ilike(term),
                Customer.phone.ilike(term),
            )
        )
    if status and status.strip() and status.lower() != "all":
        st = status.strip().lower()
        if st == "paid":
            query = query.filter(Bill.payment_status == "paid")
        elif st == "due":
            query = query.filter(Bill.payment_status.in_(["unpaid", "partial"]), Bill.balance_due > 0)
        elif st == "partial":
            query = query.filter(Bill.payment_status == "partial")
        elif st == "unpaid":
            query = query.filter(Bill.payment_status == "unpaid")

    total = query.count()

    # Scope query for status breakdown badge counts
    scope_query = db.query(Bill.payment_status, func.count(Bill.id)).join(Customer, Customer.id == Bill.customer_id)
    if customer_id:
        scope_query = scope_query.filter(Bill.customer_id == customer_id)
    if start_date:
        scope_query = scope_query.filter(Bill.bill_date >= start_date)
    if end_date:
        scope_query = scope_query.filter(Bill.bill_date <= end_date)
    if source and source.strip() and source.lower() != "all":
        scope_query = scope_query.filter(Bill.source == source.strip())
    if search and search.strip():
        term = f"%{search.strip()}%"
        scope_query = scope_query.filter(
            or_(
                Bill.bill_no.ilike(term),
                Customer.name.ilike(term),
                Customer.phone.ilike(term),
            )
        )
    counts_by_status = dict(scope_query.group_by(Bill.payment_status).all())
    paid_cnt = counts_by_status.get("paid", 0)
    due_cnt = counts_by_status.get("unpaid", 0) + counts_by_status.get("partial", 0)

    if page is not None:
        ps = page_size or 20
        off = (page - 1) * ps
        lim = ps
    else:
        off = offset or 0
        lim = limit or 100

    bills = (
        query
        .options(
            joinedload(Bill.customer),
            selectinload(Bill.items).joinedload(BillItem.product),
            selectinload(Bill.payment_installments),
        )
        .order_by(Bill.bill_date.desc(), Bill.id.desc())
        .offset(off)
        .limit(lim)
        .all()
    )
    formatted = _format_bills_batch(bills, db)

    if page is not None:
        ps = page_size or 20
        total_pages = max(1, (total + ps - 1) // ps)
        return PaginatedBillsOut(
            items=formatted,
            total=total,
            page=page,
            page_size=ps,
            total_pages=total_pages,
            paid_count=paid_cnt,
            due_count=due_cnt,
        )
    return formatted

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
    eager_bill = _get_bill_eager(bill.id, db)
    return _format_bill_out(eager_bill, db)

# IMPORTANT: Specific routes must come BEFORE generic {bill_id} route

@router.get("/whatsapp-gateway-status")
def get_whatsapp_gateway_status():
    """Checks the live connectivity status of the OpenWA WhatsApp Gateway."""
    return check_openwa_status()

@router.post("/bulk-whatsapp")
def bulk_send_whatsapp(payload: BulkWhatsAppRequest, db: Session = Depends(get_db)):
    """Sends WhatsApp bill invoices in bulk to all selected customer bills."""
    results = []
    sent_count = 0
    failed_count = 0
    skipped_count = 0

    # Batch query bills to avoid N+1 queries
    bills_list = (
        db.query(Bill)
        .options(
            joinedload(Bill.customer),
            selectinload(Bill.items).joinedload(BillItem.product),
            selectinload(Bill.payment_installments),
        )
        .filter(Bill.id.in_(payload.bill_ids))
        .all()
    )
    bills_map = {b.id: b for b in bills_list}

    for bill_id in payload.bill_ids:
        bill = bills_map.get(bill_id)
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

# Generic {bill_id} routes come AFTER specific ones

@router.get("/{bill_id}", response_model=BillOut)
def get_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = _get_bill_eager(bill_id, db)
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
    eager_bill = _get_bill_eager(bill_id, db)
    return _format_bill_out(eager_bill, db)

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
    eager_bill = _get_bill_eager(bill_id, db)
    return _format_bill_out(eager_bill, db)

@router.delete("/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill: raise HTTPException(status_code=404, detail="Bill not found")
    db.query(BillItem).filter(BillItem.bill_id == bill_id).delete()
    db.query(PaymentInstallment).filter(PaymentInstallment.bill_id == bill_id).delete()
    db.delete(bill)
    db.commit()
    return {"message": "Bill deleted successfully"}

def _format_whatsapp_message(formatted) -> str:
    status_emoji = (
        "✅ Paid Complete" if formatted.payment_status == "paid"
        else ("🟡 Partial Paid" if formatted.payment_status == "partial" else "🔴 Unpaid")
    )
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
        f"💰 *Current Bill Total:* ₹{formatted.total_amount:.2f}",
        f"💳 *Amount Paid ({formatted.payment_method}):* ₹{formatted.amount_paid:.2f}",
        f"⏳ *Current Balance Due:* ₹{formatted.balance_due:.2f}",
    ])
    if formatted.previous_balance > 0.009:
        lines.extend([
            f"🔴 *Previous Pending (C/F):* ₹{formatted.previous_balance:.2f}",
            f"🔥 *TOTAL OUTSTANDING:* ₹{formatted.total_due_with_carry_forward:.2f}",
        ])
    lines.extend([
        f"📌 *Payment Status:* {status_emoji}",
        "",
        "🙏 _Thank you for your business!_",
    ])
    return "\n".join(lines)


def _build_bill_pdf_dict(formatted) -> Dict[str, Any]:
    return {
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
        "previous_balance": formatted.previous_balance,
        "total_due_with_carry_forward": formatted.total_due_with_carry_forward,
        "previous_bills": [
            {
                "bill_no": pb.get("bill_no", "") if isinstance(pb, dict) else getattr(pb, "bill_no", ""),
                "bill_date": pb.get("bill_date", "") if isinstance(pb, dict) else getattr(pb, "bill_date", ""),
                "total_amount": float((pb.get("total_amount") if isinstance(pb, dict) else getattr(pb, "total_amount", 0)) or 0),
                "amount_paid": float((pb.get("amount_paid") if isinstance(pb, dict) else getattr(pb, "amount_paid", 0)) or 0),
                "balance_due": float((pb.get("balance_due") if isinstance(pb, dict) else getattr(pb, "balance_due", 0)) or 0),
            }
            for pb in (formatted.previous_bills or [])
        ],
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


@router.get("/{bill_id}/pdf")
def get_bill_pdf(bill_id: int, db: Session = Depends(get_db)):
    """Generates and downloads the PDF invoice for a bill."""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    formatted = _format_bill_out(bill, db)
    bill_dict = _build_bill_pdf_dict(formatted)
    
    pdf_bytes = generate_bill_pdf(bill_dict)
    filename = f"Invoice_{formatted.bill_no or bill_id}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.get("/{bill_id}/whatsapp-link")
def get_whatsapp_share_link(bill_id: int, db: Session = Depends(get_db)):
    """Returns formatted WhatsApp message & click-to-chat URL."""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    formatted = _format_bill_out(bill, db)
    cust_phone = (formatted.customer_phone or "").strip()
    clean_phone = clean_phone_number(cust_phone)
    
    message_text = _format_whatsapp_message(formatted)
    encoded_text = urllib.parse.quote(message_text)
    
    wa_url = f"https://wa.me/{clean_phone}?text={encoded_text}" if clean_phone else f"https://wa.me/?text={encoded_text}"
    
    return {
        "phone": clean_phone,
        "message": message_text,
        "whatsapp_url": wa_url
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

def _build_bill_whatsapp_payload(bill, db):
    """Helper to build PDF bytes, Cloudinary URL, and message for a bill."""
    formatted = _format_bill_out(bill, db)
    cust_phone = (formatted.customer_phone or "").strip()
    cleaned_phone = clean_phone_number(cust_phone)
    
    bill_dict = _build_bill_pdf_dict(formatted)
    message_text = _format_whatsapp_message(formatted)
    
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
