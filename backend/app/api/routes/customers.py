from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    Customer, CustomerRate, CustomerAlias, RateHistory,
    Bill, BillItem, PaymentInstallment,
)

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


@router.get("")
def list_customers(
    search: str = Query(""),
    is_active: Optional[bool] = None,
    limit: int = Query(500),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Customer)
    if search:
        q = q.filter(Customer.name.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.filter(Customer.is_active == is_active)
    items = q.order_by(Customer.name).limit(limit).all()
    return [
        {"id": c.id, "name": c.name, "phone": c.phone, "address": c.address, "notes": c.notes, "is_active": c.is_active}
        for c in items
    ]


@router.post("", status_code=201)
def create_customer(body: CustomerIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = Customer(**body.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return {"id": c.id, "name": c.name}


@router.put("/{customer_id}")
def update_customer(customer_id: int, body: CustomerIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return {"id": c.id, "name": c.name}


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
