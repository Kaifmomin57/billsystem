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
    date: Optional[str] = Query(None, description="YYYY-MM-DD (single day, legacy)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start = date_from or date or datetime.utcnow().strftime("%Y-%m-%d")
    end   = date_to   or date or start

    # ── Aggregate quantity + sale amount per product ──────────────────────
    items = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.unit.label("unit"),
            func.sum(BillItem.quantity).label("total_qty"),
            func.sum(BillItem.amount).label("total_amount"),
        )
        .join(Bill, Bill.id == BillItem.bill_id)
        .join(Product, Product.id == BillItem.product_id)
        .filter(Bill.bill_date >= start, Bill.bill_date <= end)
        .group_by(Product.id, Product.name, Product.unit)
        .all()
    )

    # ── Payment totals per product (join via bill items → bills) ──────────
    # For each product, sum amount_paid and balance_due from all bills
    # that contain that product in the date range
    payment_q = (
        db.query(
            BillItem.product_id,
            func.sum(Bill.amount_paid).label("amount_paid"),
            func.sum(Bill.balance_due).label("balance_due"),
        )
        .join(Bill, Bill.id == BillItem.bill_id)
        .filter(Bill.bill_date >= start, Bill.bill_date <= end)
        .filter(BillItem.product_id.isnot(None))
        .group_by(BillItem.product_id)
        .all()
    )
    payment_map = {p.product_id: p for p in payment_q}

    rows = []
    for itm in items:
        qty  = float(itm.total_qty    or 0)
        amt  = float(itm.total_amount or 0)
        avg_rate = round(amt / qty, 2) if qty > 0 else 0.0
        pay  = payment_map.get(itm.product_id)
        paid    = float(pay.amount_paid  or 0) if pay else 0.0
        pending = float(pay.balance_due  or 0) if pay else 0.0

        rows.append({
            "product_id":    itm.product_id,
            "product_name":  itm.product_name,
            "unit":          itm.unit,
            "total_qty":     qty,
            "avg_rate":      avg_rate,
            "total_amount":  amt,
            "amount_paid":   paid,
            "balance_due":   pending,
        })

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
    date: Optional[str] = Query(None, description="YYYY-MM-DD (single day, legacy)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start = date_from or date or datetime.utcnow().strftime("%Y-%m-%d")
    end   = date_to   or date or start

    bills = (
        db.query(Bill)
        .filter(Bill.bill_date >= start, Bill.bill_date <= end)
        .order_by(Bill.bill_date, Bill.customer_id)
        .all()
    )

    rows = []
    # Track which bills already had their payment columns emitted
    # so we don't double-count across multiple items in same bill
    seen_bill_ids: set = set()

    for bill in bills:
        cust = db.query(Customer).filter(Customer.id == bill.customer_id).first()
        c_name = cust.name if cust else "Unknown"

        bill_total   = float(bill.total_amount  or 0)
        bill_paid    = float(bill.amount_paid   or 0)
        bill_due     = float(bill.balance_due   or 0)
        is_first_item = True  # show payment cols only on the first item row per bill

        for item in bill.items:
            prod = (
                db.query(Product).filter(Product.id == item.product_id).first()
                if item.product_id else None
            )
            amt = float(item.amount or 0)

            # Prorate payment info per-item for the summary accumulation
            # Show full bill amounts only on first item (for readability)
            rows.append({
                "customer_name":     c_name,
                "bill_no":           bill.bill_no,
                "bill_date":         bill.bill_date,
                "product_name":      prod.name if prod else (item.tag or "—"),
                "quantity":          float(item.quantity or 0),
                "rate":              float(item.rate or 0),
                "amount":            amt,
                "total_bill_amount": bill_total   if is_first_item else "",
                "amount_paid":       bill_paid    if is_first_item else "",
                "balance_due":       bill_due     if is_first_item else "",
                "payment_status":    bill.payment_status,
                # These are used for grand-total accumulation in the excel builder
                "item_received":     round(bill_paid * (amt / bill_total), 2)
                                     if bill_total > 0 else 0,
                "item_pending":      round(bill_due  * (amt / bill_total), 2)
                                     if bill_total > 0 else 0,
            })
            is_first_item = False

    label = start if start == end else f"{start}_to_{end}"
    stream = build_daily_by_customer(rows, label)
    filename = f"daily_by_customer_{label}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
