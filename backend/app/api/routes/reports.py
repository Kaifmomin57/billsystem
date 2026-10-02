from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Bill, BillItem, Customer, Product, User
from app.services.excel_service import build_daily_by_product, build_daily_by_customer

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/stats")
def get_reports_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_customers = db.query(Customer).filter(Customer.is_active == True).count()
    total_products = db.query(Product).filter(Product.is_active == True).count()
    total_bills = db.query(Bill).count()
    total_revenue = db.query(func.sum(Bill.total_amount)).scalar() or 0.0
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    today_bills = db.query(Bill).filter(Bill.bill_date == today_str).count()
    today_revenue = db.query(func.sum(Bill.total_amount)).filter(Bill.bill_date == today_str).scalar() or 0.0
    
    return {
        "total_customers": total_customers,
        "total_products": total_products,
        "total_bills": total_bills,
        "total_revenue": float(total_revenue),
        "bills_today": today_bills,
        "today_bills": today_bills,
        "revenue_today": float(today_revenue),
        "today_revenue": float(today_revenue)
    }


@router.get("/daily/by-product")
def get_daily_by_product(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    date_to:   Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    # Legacy single-date param kept for backwards compat
    date: Optional[str] = Query(None, description="YYYY-MM-DD (single day)"),
    download: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Resolve date range
    start = date_from or date or datetime.utcnow().strftime("%Y-%m-%d")
    end   = date_to   or date or start

    q = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.unit.label("unit"),
            func.sum(BillItem.quantity).label("total_qty"),
            func.sum(BillItem.amount).label("total_amount")
        )
        .join(Bill, Bill.id == BillItem.bill_id)
        .join(Product, Product.id == BillItem.product_id)
        .filter(Bill.bill_date >= start, Bill.bill_date <= end)
        .group_by(Product.id, Product.name, Product.unit)
    )
    items = q.all()

    rows = []
    grand_total = 0.0
    for itm in items:
        qty = float(itm.total_qty or 0)
        amt = float(itm.total_amount or 0)
        avg_rate = round(amt / qty, 2) if qty > 0 else 0.0
        grand_total += amt
        rows.append({
            "product_id": itm.product_id,
            "product_name": itm.product_name,
            "unit": itm.unit,
            "total_qty": qty,
            "avg_rate": avg_rate,
            "total_amount": amt
        })

    # Always return Excel when called from the download button
    label = start if start == end else f"{start}_to_{end}"
    stream = build_daily_by_product(rows, label)
    filename = f"daily_by_product_{label}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/daily/by-customer")
def get_daily_by_customer(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    date_to:   Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    # Legacy single-date param kept for backwards compat
    date: Optional[str] = Query(None, description="YYYY-MM-DD (single day)"),
    download: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Resolve date range
    start = date_from or date or datetime.utcnow().strftime("%Y-%m-%d")
    end   = date_to   or date or start

    bills = (
        db.query(Bill)
        .filter(Bill.bill_date >= start, Bill.bill_date <= end)
        .order_by(Bill.bill_date, Bill.customer_id)
        .all()
    )

    rows = []
    running_total = 0.0
    for bill in bills:
        cust = db.query(Customer).filter(Customer.id == bill.customer_id).first()
        c_name = cust.name if cust else "Unknown"
        for item in bill.items:
            prod = db.query(Product).filter(Product.id == item.product_id).first() if item.product_id else None
            amt = float(item.amount or 0)
            running_total += amt
            rows.append({
                "customer_name": c_name,
                "bill_no": bill.bill_no,
                "bill_date": bill.bill_date,
                "product_name": prod.name if prod else "Unknown",
                "quantity": float(item.quantity or 0),
                "rate": float(item.rate or 0),
                "amount": amt,
                "running_total": running_total,
                "tag": item.tag,
                "circled_value": item.circled_value
            })

    label = start if start == end else f"{start}_to_{end}"
    stream = build_daily_by_customer(rows, label)
    filename = f"daily_by_customer_{label}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
