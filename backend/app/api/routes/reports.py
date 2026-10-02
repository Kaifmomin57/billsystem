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
    total_bills = db.query(Bill).join(Customer, Customer.id == Bill.customer_id).count()
    total_revenue = db.query(func.sum(Bill.total_amount)).join(Customer, Customer.id == Bill.customer_id).scalar() or 0.0

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    today_bills = db.query(Bill).join(Customer, Customer.id == Bill.customer_id).filter(Bill.bill_date == today_str).count()
    today_revenue = db.query(func.sum(Bill.total_amount)).join(Customer, Customer.id == Bill.customer_id).filter(Bill.bill_date == today_str).scalar() or 0.0

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


def _get_report_data_for_period(start: str, end: str, db: Session) -> Dict[str, Any]:
    """
    Core data extraction engine for a date range:
    Accurately computes Customer summaries, Product summaries,
    Detailed itemized bills, and Grand Totals (Total Sale, Received, Pending).
    """
    bills = (
        db.query(Bill)
        .join(Customer, Customer.id == Bill.customer_id)
        .filter(Bill.bill_date >= start, Bill.bill_date <= end)
        .order_by(Customer.name, Bill.bill_date, Bill.id)
        .all()
    )

    cust_map: Dict[int, Dict[str, Any]] = {}
    detailed_rows: List[Dict[str, Any]] = []
    prod_map: Dict[int, Dict[str, Any]] = {}

    for bill in bills:
        c = bill.customer
        cid = c.id
        if cid not in cust_map:
            cust_map[cid] = {
                "customer_id": cid,
                "customer_name": c.name,
                "phone": c.phone or "",
                "bills_count": 0,
                "total_sale": 0.0,
                "amount_paid": 0.0,
                "balance_due": 0.0,
            }

        b_total = float(bill.total_amount or 0)
        b_paid  = float(bill.amount_paid or 0)
        b_due   = float(bill.balance_due or 0)

        cust_map[cid]["bills_count"] += 1
        cust_map[cid]["total_sale"] += b_total
        cust_map[cid]["amount_paid"] += b_paid
        cust_map[cid]["balance_due"] += b_due

        items = bill.items
        if items:
            for idx, itm in enumerate(items):
                prod = itm.product
                pname = prod.name if prod else (itm.tag or "General Item")
                punit = prod.unit if prod else "kg"
                pid = itm.product_id or 0
                amt = float(itm.amount or 0)
                qty = float(itm.quantity or 0)
                rate = float(itm.rate or 0)

                detailed_rows.append({
                    "customer_name": c.name,
                    "customer_phone": c.phone or "",
                    "bill_no": bill.bill_no,
                    "bill_date": bill.bill_date,
                    "product_name": pname,
                    "quantity": qty,
                    "unit": punit,
                    "rate": rate,
                    "amount": amt,
                    "total_bill_amount": b_total,
                    "amount_paid": b_paid,
                    "balance_due": b_due,
                    "payment_method": bill.payment_method or "Cash",
                    "payment_status": bill.payment_status or "unpaid",
                    "is_first_item": (idx == 0),
                })

                # Product aggregation
                if pid not in prod_map:
                    prod_map[pid] = {
                        "product_id": pid,
                        "product_name": pname,
                        "unit": punit,
                        "total_qty": 0.0,
                        "total_amount": 0.0,
                        "amount_paid": 0.0,
                        "balance_due": 0.0,
                    }

                prod_map[pid]["total_qty"] += qty
                prod_map[pid]["total_amount"] += amt

                if b_total > 0:
                    share = amt / b_total
                    prod_map[pid]["amount_paid"] += b_paid * share
                    prod_map[pid]["balance_due"] += b_due * share
        else:
            # Lumpsum bill with no line items
            detailed_rows.append({
                "customer_name": c.name,
                "customer_phone": c.phone or "",
                "bill_no": bill.bill_no,
                "bill_date": bill.bill_date,
                "product_name": "Invoice Total",
                "quantity": 1,
                "unit": "nos",
                "rate": b_total,
                "amount": b_total,
                "total_bill_amount": b_total,
                "amount_paid": b_paid,
                "balance_due": b_due,
                "payment_method": bill.payment_method or "Cash",
                "payment_status": bill.payment_status or "unpaid",
                "is_first_item": True,
            })

    # Prepare customer summary records
    customer_summaries = list(cust_map.values())
    for cs in customer_summaries:
        tot = cs["total_sale"]
        due = cs["balance_due"]
        paid = cs["amount_paid"]
        cs["payment_status"] = "paid" if tot > 0 and due <= 0 else "partial" if paid > 0 else "unpaid"

    customer_summaries.sort(key=lambda x: x["customer_name"].lower())

    # Prepare product summary records
    product_summaries = list(prod_map.values())
    for p in product_summaries:
        qty = p["total_qty"]
        amt = p["total_amount"]
        p["avg_rate"] = round(amt / qty, 2) if qty > 0 else 0.0
        p["total_sale"] = amt

    product_summaries.sort(key=lambda x: x["total_amount"], reverse=True)

    # Compute period grand totals
    grand_sale = sum(float(b.total_amount or 0) for b in bills)
    grand_paid = sum(float(b.amount_paid or 0) for b in bills)
    grand_due  = sum(float(b.balance_due or 0) for b in bills)
    collection_rate = (grand_paid / grand_sale * 100) if grand_sale > 0 else 0.0

    totals = {
        "total_sales": grand_sale,
        "total_received": grand_paid,
        "total_pending": grand_due,
        "collection_rate": round(collection_rate, 1),
        "total_bills": len(bills),
        "total_customers": len(customer_summaries),
        "total_qty": sum(p["total_qty"] for p in product_summaries),
    }

    return {
        "date_from": start,
        "date_to": end,
        "totals": totals,
        "customers": customer_summaries,
        "products": product_summaries,
        "detailed_rows": detailed_rows,
    }


@router.get("/summary")
def get_reports_summary(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    date_to:   Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    date:      Optional[str] = Query(None, description="YYYY-MM-DD single day"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns live analytical summary for the selected period:
    Total Sales, Received, Pending, Customer breakdown, and Product breakdown.
    Powers the executive dashboard on the Reports page.
    """
    start = date_from or date or datetime.utcnow().strftime("%Y-%m-%d")
    end   = date_to   or date or start

    data = _get_report_data_for_period(start, end, db)
    return {
        "date_from": data["date_from"],
        "date_to": data["date_to"],
        "totals": data["totals"],
        "customers": data["customers"],
        "products": data["products"],
    }


@router.get("/daily/by-customer")
def get_daily_by_customer(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    date_to:   Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    date:      Optional[str] = Query(None, description="YYYY-MM-DD single day"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads an Excel spreadsheet organized By Customer:
    - Sheet 1: Customer Summary (Each customer: Total Sale, Received, Pending, Status)
    - Sheet 2: Detailed Bills & Items breakdown with customer subtotals
    """
    start = date_from or date or datetime.utcnow().strftime("%Y-%m-%d")
    end   = date_to   or date or start

    data = _get_report_data_for_period(start, end, db)
    label = start if start == end else f"{start}_to_{end}"
    stream = build_daily_by_customer(data, label)
    filename = f"daily_by_customer_{label}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/daily/by-product")
def get_daily_by_product(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    date_to:   Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    date:      Optional[str] = Query(None, description="YYYY-MM-DD single day"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads an Excel spreadsheet organized By Product:
    - Quantity sold, Average rate, Total sale
    - Allocated received and pending per product
    - KPI cards and Grand Totals
    """
    start = date_from or date or datetime.utcnow().strftime("%Y-%m-%d")
    end   = date_to   or date or start

    data = _get_report_data_for_period(start, end, db)
    label = start if start == end else f"{start}_to_{end}"
    stream = build_daily_by_product(data, label)
    filename = f"daily_by_product_{label}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
