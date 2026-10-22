from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timezone
from typing import Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Bill, Customer, Product, Upload, User
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/dashboard")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    total_customers = db.query(func.count(Customer.id)).filter(Customer.is_active == True).scalar() or 0
    total_products  = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar() or 0
    
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Combined single query for financial & status metrics (eliminates 12 individual queries)
    stats_row = (
        db.query(
            func.count(Bill.id).label("total_bills"),
            func.coalesce(func.sum(Bill.total_amount), 0).label("total_sales"),
            func.coalesce(func.sum(Bill.amount_paid), 0).label("received_pay"),
            func.coalesce(func.sum(Bill.balance_due), 0).label("balance_pay"),
            # Today
            func.coalesce(func.sum(case((Bill.bill_date == today_str, Bill.total_amount), else_=0)), 0).label("today_sales"),
            func.coalesce(func.sum(case((Bill.bill_date == today_str, Bill.amount_paid), else_=0)), 0).label("today_received"),
            func.coalesce(func.sum(case((Bill.bill_date == today_str, 1), else_=0)), 0).label("today_bills"),
            # Status counts
            func.coalesce(func.sum(case((Bill.payment_status == "paid", 1), else_=0)), 0).label("paid_count"),
            func.coalesce(func.sum(case((Bill.payment_status == "partial", 1), else_=0)), 0).label("partial_count"),
            func.coalesce(func.sum(case((Bill.payment_status == "unpaid", 1), else_=0)), 0).label("unpaid_count"),
            # Method sums
            func.coalesce(func.sum(case((Bill.payment_method == "Cash", Bill.amount_paid), else_=0)), 0).label("cash_total"),
            func.coalesce(func.sum(case((Bill.payment_method == "UPI", Bill.amount_paid), else_=0)), 0).label("upi_total"),
            func.coalesce(func.sum(case((Bill.payment_method == "Mixed", Bill.amount_paid), else_=0)), 0).label("mixed_total"),
        )
        .join(Customer, Customer.id == Bill.customer_id)
        .first()
    )

    total_bills   = int(stats_row.total_bills or 0)
    total_sales   = float(stats_row.total_sales or 0.0)
    received_pay  = float(stats_row.received_pay or 0.0)
    total_opening_bal = float(db.query(func.coalesce(func.sum(Customer.opening_balance), 0)).filter(Customer.is_active == True).scalar() or 0.0)
    balance_pay   = float(stats_row.balance_pay or 0.0) + total_opening_bal
    today_sales   = float(stats_row.today_sales or 0.0)
    today_received= float(stats_row.today_received or 0.0)
    today_bills   = int(stats_row.today_bills or 0)
    paid_count    = int(stats_row.paid_count or 0)
    partial_count = int(stats_row.partial_count or 0)
    unpaid_count  = int(stats_row.unpaid_count or 0)
    cash_total    = float(stats_row.cash_total or 0.0)
    upi_total     = float(stats_row.upi_total or 0.0)
    mixed_total   = float(stats_row.mixed_total or 0.0)
    
    # Top debtors (customers with pending balance from bills + opening balance)
    bills_due_query = (
        db.query(Bill.customer_id, func.sum(Bill.balance_due), func.count(Bill.id))
        .filter(Bill.balance_due > 0)
        .group_by(Bill.customer_id)
        .all()
    )
    bills_due_map = {row[0]: (float(row[1] or 0), int(row[2] or 0)) for row in bills_due_query}

    active_customers = (
        db.query(Customer)
        .filter(Customer.is_active == True)
        .all()
    )

    debtor_list = []
    for c in active_customers:
        b_due, unpaid_cnt = bills_due_map.get(c.id, (0.0, 0))
        op_due = float(c.opening_balance or 0.0)
        tot_due = b_due + op_due
        if tot_due > 0:
            debtor_list.append({
                "customer_id": c.id,
                "customer_name": c.name,
                "total_due": round(tot_due, 2),
                "unpaid_bills": unpaid_cnt,
                "opening_balance": op_due,
            })

    debtor_list.sort(key=lambda x: x["total_due"], reverse=True)
    top_debtors = debtor_list[:5]

    # Recent bills — eager load Customer in 1 query
    recent_bills = (
        db.query(Bill)
        .join(Customer, Customer.id == Bill.customer_id)
        .options(joinedload(Bill.customer))
        .order_by(Bill.created_at.desc())
        .limit(5)
        .all()
    )
    recent_bills_data = [
        {
            "id": b.id,
            "bill_no": b.bill_no,
            "customer_name": b.customer.name if b.customer else "Unknown",
            "bill_date": b.bill_date,
            "total_amount": float(b.total_amount or 0),
            "amount_paid": float(b.amount_paid or 0),
            "balance_due": float(b.balance_due or 0),
            "payment_status": b.payment_status or "unpaid",
            "payment_method": b.payment_method or "Cash",
            "source": b.source
        }
        for b in recent_bills
    ]

    return {
        "total_customers": total_customers,
        "total_products": total_products,
        "total_bills": total_bills,
        "total_sales": total_sales,
        "received_payment": received_pay,
        "balance_payment": balance_pay,
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
