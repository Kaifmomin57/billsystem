from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Bill, Customer, Product, Upload, User

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/dashboard")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    total_customers = db.query(Customer).filter(Customer.is_active == True).count()
    total_products  = db.query(Product).filter(Product.is_active == True).count()
    
    # Query non-ledger bills for financial analytics
    bills_query = db.query(Bill).filter(Bill.source != "ledger_ai")
    total_bills  = bills_query.count()
    
    total_sales    = float(db.query(func.sum(Bill.total_amount)).filter(Bill.source != "ledger_ai").scalar() or 0.0)
    received_pay   = float(db.query(func.sum(Bill.amount_paid)).filter(Bill.source != "ledger_ai").scalar() or 0.0)
    balance_pay    = float(db.query(func.sum(Bill.balance_due)).filter(Bill.source != "ledger_ai").scalar() or 0.0)
    
    # Today's stats
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    today_bills   = bills_query.filter(Bill.bill_date == today_str).count()
    today_sales   = float(db.query(func.sum(Bill.total_amount)).filter(Bill.source != "ledger_ai", Bill.bill_date == today_str).scalar() or 0.0)
    today_received = float(db.query(func.sum(Bill.amount_paid)).filter(Bill.source != "ledger_ai", Bill.bill_date == today_str).scalar() or 0.0)
    
    # Payment status count breakdown
    paid_count    = bills_query.filter(Bill.payment_status == "paid").count()
    partial_count = bills_query.filter(Bill.payment_status == "partial").count()
    unpaid_count  = bills_query.filter(Bill.payment_status == "unpaid").count()
    
    # Payment method breakdown
    cash_total = float(db.query(func.sum(Bill.amount_paid)).filter(Bill.source != "ledger_ai", Bill.payment_method == "Cash").scalar() or 0.0)
    upi_total  = float(db.query(func.sum(Bill.amount_paid)).filter(Bill.source != "ledger_ai", Bill.payment_method == "UPI").scalar() or 0.0)
    mixed_total= float(db.query(func.sum(Bill.amount_paid)).filter(Bill.source != "ledger_ai", Bill.payment_method == "Mixed").scalar() or 0.0)
    
    # Top debtors (customers with pending balance)
    top_debtors_raw = (
        db.query(
            Customer.id,
            Customer.name,
            func.sum(Bill.balance_due).label("total_due"),
            func.count(Bill.id).label("unpaid_bills")
        )
        .join(Bill, Bill.customer_id == Customer.id)
        .filter(Bill.source != "ledger_ai", Bill.balance_due > 0)
        .group_by(Customer.id, Customer.name)
        .order_by(func.sum(Bill.balance_due).desc())
        .limit(5)
        .all()
    )
    
    top_debtors = [
        {
            "customer_id": d.id,
            "customer_name": d.name,
            "total_due": float(d.total_due or 0),
            "unpaid_bills": d.unpaid_bills
        }
        for d in top_debtors_raw
    ]

    # Recent bills
    recent_bills = bills_query.order_by(Bill.created_at.desc()).limit(5).all()
    recent_bills_data = []
    for b in recent_bills:
        cust = db.query(Customer).filter(Customer.id == b.customer_id).first()
        recent_bills_data.append({
            "id": b.id,
            "bill_no": b.bill_no,
            "customer_name": cust.name if cust else "Unknown",
            "bill_date": b.bill_date,
            "total_amount": float(b.total_amount or 0),
            "amount_paid": float(b.amount_paid or 0),
            "balance_due": float(b.balance_due or 0),
            "payment_status": b.payment_status or "unpaid",
            "payment_method": b.payment_method or "Cash",
            "source": b.source
        })

    return {
        "total_customers": total_customers,
        "total_products": total_products,
        "total_bills": total_bills,
        "total_sales": total_sales,
        "received_payment": received_pay,
        "balance_payment": balance_pay,
        "total_revenue": total_sales,
        "revenue_today": today_sales,
        "today_bills": today_bills,
        "today_sales": today_sales,
        "today_received": today_received,
        "status_breakdown": {
            "paid": paid_count,
            "partial": partial_count,
            "unpaid": unpaid_count
        },
        "method_breakdown": {
            "cash": cash_total,
            "upi": upi_total,
            "mixed": mixed_total
        },
        "top_debtors": top_debtors,
        "recent_bills": recent_bills_data
    }
