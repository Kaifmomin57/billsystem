from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit import record_audit
from app.models.models import (
    Customer, CustomerRate, CustomerAlias, RateHistory,
    Bill, BillItem, PaymentInstallment, AppSetting, User
)

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    opening_balance: Optional[float] = 0.0
    is_active: bool = True


class CustomerPaymentIn(BaseModel):
    amount: float
    payment_method: Optional[str] = "Cash"
    note: Optional[str] = None
    date: Optional[str] = None


def _format_customer(c: Customer, bill_dues: dict) -> dict:
    op = float(c.opening_balance or 0.0)
    bd = float(bill_dues.get(c.id, 0.0))
    tot = round(op + bd, 2)
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "address": c.address,
        "notes": c.notes,
        "opening_balance": op,
        "bills_balance": bd,
        "total_balance": tot,
        "advance_balance": round(abs(min(0.0, tot)), 2),
        "is_active": c.is_active,
    }


@router.get("")
def list_customers(
    search: str = Query(""),
    is_active: Optional[bool] = None,
    limit: Optional[int] = Query(None, le=1000),
    offset: Optional[int] = Query(None, ge=0),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Customer)
    if search:
        q = q.filter(Customer.name.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.filter(Customer.is_active == is_active)

    total = q.count()

    if page is not None:
        ps = page_size or 10
        off = (page - 1) * ps
        items = q.order_by(Customer.name).offset(off).limit(ps).all()
        total_pages = max(1, (total + ps - 1) // ps)

        cust_ids = [c.id for c in items]
        bill_dues = {}
        if cust_ids:
            dues_query = (
                db.query(Bill.customer_id, func.coalesce(func.sum(Bill.balance_due), 0))
                .filter(Bill.customer_id.in_(cust_ids), Bill.balance_due > 0)
                .group_by(Bill.customer_id)
                .all()
            )
            bill_dues = {cid: float(amt) for cid, amt in dues_query}

        return {
            "items": [_format_customer(c, bill_dues) for c in items],
            "total": total,
            "page": page,
            "page_size": ps,
            "total_pages": total_pages,
        }

    lim = limit or 200
    off = offset or 0
    items = q.order_by(Customer.name).offset(off).limit(lim).all()
    cust_ids = [c.id for c in items]
    bill_dues = {}
    if cust_ids:
        dues_query = (
            db.query(Bill.customer_id, func.coalesce(func.sum(Bill.balance_due), 0))
            .filter(Bill.customer_id.in_(cust_ids), Bill.balance_due > 0)
            .group_by(Bill.customer_id)
            .all()
        )
        bill_dues = {cid: float(amt) for cid, amt in dues_query}

    return [_format_customer(c, bill_dues) for c in items]


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    bd = float(
        db.query(func.coalesce(func.sum(Bill.balance_due), 0))
        .filter(Bill.customer_id == customer_id, Bill.balance_due > 0)
        .scalar() or 0.0
    )
    return _format_customer(c, {c.id: bd})


@router.post("", status_code=201)
def create_customer(body: CustomerIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    data = body.model_dump()
    if not (data.get("phone") or "").strip():
        setting = db.query(AppSetting).filter(AppSetting.key == "default_customer_phone").first()
        data["phone"] = setting.value if setting and setting.value else "9730526659"
    c = Customer(**data)
    db.add(c); db.commit(); db.refresh(c)
    op = float(c.opening_balance or 0.0)
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "address": c.address,
        "notes": c.notes,
        "opening_balance": op,
        "bills_balance": 0.0,
        "total_balance": op,
        "is_active": c.is_active,
    }


@router.put("/{customer_id}")
def update_customer(customer_id: int, body: CustomerIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    bd = float(
        db.query(func.coalesce(func.sum(Bill.balance_due), 0))
        .filter(Bill.customer_id == customer_id, Bill.balance_due > 0)
        .scalar() or 0.0
    )
    return _format_customer(c, {c.id: bd})


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    # ── 1. Delete bill children first ──────────────────────────────────────
    bill_ids = [b.id for b in db.query(Bill.id).filter(Bill.customer_id == customer_id).all()]
    if bill_ids:
        db.query(BillItem).filter(BillItem.bill_id.in_(bill_ids)).delete(synchronize_session=False)
        db.query(PaymentInstallment).filter(PaymentInstallment.bill_id.in_(bill_ids)).delete(synchronize_session=False)
        db.query(Bill).filter(Bill.id.in_(bill_ids)).delete(synchronize_session=False)

    # ── 2. Delete customer-level related records ────────────────────────────
    db.query(CustomerRate).filter(CustomerRate.customer_id == customer_id).delete(synchronize_session=False)
    db.query(RateHistory).filter(RateHistory.customer_id == customer_id).delete(synchronize_session=False)
    db.query(CustomerAlias).filter(CustomerAlias.customer_id == customer_id).delete(synchronize_session=False)

    # ── 3. Finally delete the customer ─────────────────────────────────────
    db.delete(c)
    db.commit()
    return {"message": "Customer deleted successfully"}


@router.post("/{customer_id}/payment")
def record_customer_payment(
    customer_id: int,
    body: CustomerPaymentIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records a payment for a customer:
    1. First clears any unpaid/partial bills in FIFO order (oldest first).
    2. Any remaining excess pays off customer.opening_balance (unbilled previous dues).
    3. If all bills and previous dues are paid (or already zero), any remaining excess
       is credited to customer's Advance Balance (customer.opening_balance becomes negative).
    """
    amount = float(body.amount or 0.0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    pay_method = body.payment_method or "Cash"
    user_note = (body.note or "").strip()
    remaining = round(amount, 2)

    # 1. Settle unpaid bills FIFO
    unpaid_bills = (
        db.query(Bill)
        .filter(
            Bill.customer_id == customer_id,
            Bill.payment_status.in_(["unpaid", "partial"]),
            Bill.balance_due > 0,
        )
        .order_by(Bill.bill_date.asc(), Bill.id.asc())
        .all()
    )

    bills_settled = []
    total_applied_to_bills = 0.0

    for b in unpaid_bills:
        if remaining <= 0.001:
            break
        b_bal = float(b.balance_due or 0)
        if b_bal <= 0.001:
            continue

        pay_for_this_bill = min(remaining, b_bal)
        b_curr_paid = float(b.amount_paid or 0)
        b_tot = float(b.total_amount or 0)

        new_paid = b_curr_paid + pay_for_this_bill
        new_bal = max(0.0, b_tot - new_paid)

        b.amount_paid = new_paid
        b.balance_due = new_bal
        b.payment_status = "paid" if new_bal <= 0.001 else "partial"

        if b.payment_method and b.payment_method != pay_method and b_curr_paid > 0:
            b.payment_method = "Mixed"
        elif not b.payment_method or b_curr_paid == 0:
            b.payment_method = pay_method

        inst_note = f"Customer payment ({user_note})" if user_note else "Customer payment"
        inst = PaymentInstallment(
            bill_id=b.id,
            amount=pay_for_this_bill,
            payment_method=pay_method,
            note=inst_note,
            paid_at=datetime.utcnow()
        )
        db.add(inst)

        remaining = round(remaining - pay_for_this_bill, 2)
        total_applied_to_bills = round(total_applied_to_bills + pay_for_this_bill, 2)
        bills_settled.append({
            "bill_id": b.id,
            "bill_no": b.bill_no,
            "paid_amount": pay_for_this_bill,
            "remaining_bill_balance": new_bal,
            "status": b.payment_status
        })

    # 2. Settle positive opening balance (previous dues without bill)
    applied_to_opening_balance = 0.0
    curr_opening = float(c.opening_balance or 0.0)

    if remaining > 0.001 and curr_opening > 0.001:
        pay_op = min(remaining, curr_opening)
        c.opening_balance = round(curr_opening - pay_op, 2)
        applied_to_opening_balance = pay_op
        remaining = round(remaining - pay_op, 2)

    # 3. If all bills and previous dues are cleared, excess becomes Customer Advance (credit)
    advance_credited = 0.0
    if remaining > 0.001:
        c.opening_balance = round(float(c.opening_balance or 0.0) - remaining, 2)
        advance_credited = remaining
        remaining = 0.0

    db.commit()
    db.refresh(c)

    # Compute final customer balances
    bd = float(
        db.query(func.coalesce(func.sum(Bill.balance_due), 0))
        .filter(Bill.customer_id == customer_id, Bill.balance_due > 0)
        .scalar() or 0.0
    )
    final_op = float(c.opening_balance or 0.0)
    final_total_bal = round(final_op + bd, 2)

    # Audit logging
    req_id = getattr(request.state, "request_id", None) if hasattr(request, "state") else None
    client_ip = request.client.host if request and request.client else None
    record_audit(
        db=db,
        action="customer_payment",
        entity_type="customer",
        entity_id=str(c.id),
        user_id=current_user.id,
        changes={
            "amount": amount,
            "payment_method": pay_method,
            "applied_to_bills": total_applied_to_bills,
            "applied_to_opening": applied_to_opening_balance,
            "advance_credited": advance_credited,
            "final_total_balance": final_total_bal,
            "note": user_note,
        },
        request_id=req_id,
        ip_address=client_ip
    )

    return {
        "success": True,
        "message": f"Payment of ₹{amount:.2f} processed successfully",
        "customer": _format_customer(c, {c.id: bd}),
        "settlement": {
            "amount_paid": amount,
            "applied_to_bills": total_applied_to_bills,
            "applied_to_opening_balance": applied_to_opening_balance,
            "advance_credited": advance_credited,
            "bills_settled": bills_settled,
            "new_opening_balance": final_op,
            "new_bills_balance": bd,
            "new_total_balance": final_total_bal,
        }
    }
