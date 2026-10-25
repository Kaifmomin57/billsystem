from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    Customer, CustomerRate, CustomerAlias, RateHistory,
    Bill, BillItem, PaymentInstallment, AppSetting
)

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    opening_balance: Optional[float] = 0.0
    is_active: bool = True


def _format_customer(c: Customer, bill_dues: dict) -> dict:
    op = float(c.opening_balance or 0.0)
    bd = float(bill_dues.get(c.id, 0.0))
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "address": c.address,
        "notes": c.notes,
        "opening_balance": op,
        "bills_balance": bd,
        "total_balance": round(op + bd, 2),
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
