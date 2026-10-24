import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, case

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.core.signing import generate_signed_url
from app.services.job_service import create_job, run_async_task, update_job_progress, complete_job, fail_job
from app.models.models import Bill, BillItem, Customer, Product, User
from app.services.excel_service import build_daily_by_product, build_daily_by_customer

router = APIRouter(prefix="/reports", tags=["reports"])
settings = get_settings()


@router.get("/stats")
def get_reports_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    total_customers = db.query(func.count(Customer.id)).filter(Customer.is_active == True).scalar() or 0
    total_products = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar() or 0

    bill_stats = (
        db.query(
            func.count(Bill.id),
            func.coalesce(func.sum(Bill.total_amount), 0.0),
            func.coalesce(func.sum(case((Bill.bill_date == today_str, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Bill.bill_date == today_str, Bill.total_amount), else_=0.0)), 0.0),
        )
        .join(Customer, Customer.id == Bill.customer_id)
        .first()
    )

    total_bills = int(bill_stats[0] or 0)
    total_revenue = float(bill_stats[1] or 0.0)
    today_bills = int(bill_stats[2] or 0)
    today_revenue = float(bill_stats[3] or 0.0)

    return {
        "total_customers": total_customers,
        "total_products": total_products,
        "total_bills": total_bills,
        "total_revenue": total_revenue,
        "bills_today": today_bills,
        "today_bills": today_bills,
        "revenue_today": today_revenue,
        "today_revenue": today_revenue
    }


def _get_report_data_for_period(start: str, end: str, db: Session) -> Dict[str, Any]:
    """
    Core data extraction engine for a date range:
    Accurately computes Customer summaries, Product summaries,
    Detailed itemized bills, and Grand Totals (Total Sale, Received, Pending).
    """
    try:
        start_dt = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")

    if (end_dt - start_dt).days > 365:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 365 days.")

    bills = (
        db.query(Bill)
        .join(Customer, Customer.id == Bill.customer_id)
        .options(
            joinedload(Bill.customer),
            selectinload(Bill.items).joinedload(BillItem.product)
        )
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
            op_bal = float(getattr(c, "opening_balance", 0) or 0)
            cust_map[cid] = {
                "customer_id": cid,
                "customer_name": c.name,
                "phone": c.phone or "",
                "opening_balance": op_bal,
                "bills_count": 0,
                "total_sales": 0.0,
                "total_received": 0.0,
                "total_pending": 0.0,
                "total_balance": op_bal,
                "profit_loss": None,  # Will be computed if purchase_prices are set
            }

        b_total = float(bill.total_amount or 0)
        b_paid  = float(bill.amount_paid or 0)
        b_due   = float(bill.balance_due or 0)

        cust_map[cid]["bills_count"] += 1
        cust_map[cid]["total_sales"] += b_total
        cust_map[cid]["total_received"] += b_paid
        cust_map[cid]["total_pending"] += b_due
        cust_map[cid]["total_balance"] = cust_map[cid]["total_pending"] + cust_map[cid]["opening_balance"]

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
                        "purchase_price": float(prod.purchase_price) if prod and prod.purchase_price is not None else None,
                        "total_quantity": 0.0,
                        "total_amount": 0.0,
                        "total_purchase_cost": 0.0,
                        "amount_paid": 0.0,
                        "balance_due": 0.0,
                    }

                prod_map[pid]["total_quantity"] += qty
                prod_map[pid]["total_amount"] += amt
                # Accumulate purchase cost for this product
                pp = prod_map[pid]["purchase_price"]
                if pp is not None:
                    prod_map[pid]["total_purchase_cost"] += pp * qty

                if b_total > 0:
                    share = amt / b_total
                    prod_map[pid]["amount_paid"] += b_paid * share
                    prod_map[pid]["balance_due"] += b_due * share

                # Customer profit tracking per item
                if pp is not None:
                    item_profit = (rate - pp) * qty
                    prev = cust_map[cid]["profit_loss"]
                    cust_map[cid]["profit_loss"] = (0.0 if prev is None else prev) + item_profit
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
        tot = cs["total_sales"]
        due = cs["total_pending"]
        paid = cs["total_received"]
        cs["payment_status"] = "paid" if tot > 0 and due <= 0 else "partial" if paid > 0 else "unpaid"
        if cs["profit_loss"] is not None:
            cs["profit_loss"] = round(cs["profit_loss"], 2)

    customer_summaries.sort(key=lambda x: x["customer_name"].lower())

    # Prepare product summary records
    product_summaries = list(prod_map.values())
    for p in product_summaries:
        qty = p["total_quantity"]
        amt = p["total_amount"]
        pp  = p["purchase_price"]
        p["avg_rate"] = round(amt / qty, 2) if qty > 0 else 0.0
        p["total_sales"] = amt
        if pp is not None and qty > 0:
            p["total_cost"]   = round(p["total_purchase_cost"], 2)
            p["profit_loss"]  = round(amt - p["total_purchase_cost"], 2)
        else:
            p["total_cost"]   = None
            p["profit_loss"]  = None

    product_summaries.sort(key=lambda x: x["total_amount"], reverse=True)

    # Compute period grand totals
    grand_sale = sum(float(b.total_amount or 0) for b in bills)
    grand_paid = sum(float(b.amount_paid or 0) for b in bills)
    grand_due  = sum(float(b.balance_due or 0) for b in bills)
    collection_rate = (grand_paid / grand_sale * 100) if grand_sale > 0 else 0.0

    total_pl = sum(p["profit_loss"] for p in product_summaries if p["profit_loss"] is not None)
    has_pl = any(p["profit_loss"] is not None for p in product_summaries)

    totals = {
        "total_sales": grand_sale,
        "total_received": grand_paid,
        "total_pending": grand_due,
        "collection_rate": round(collection_rate, 1),
        "total_bills": len(bills),
        "total_customers": len(customer_summaries),
        "total_qty": sum(p["total_quantity"] for p in product_summaries),
        "total_profit_loss": round(total_pl, 2) if has_pl else None,
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
    start = date_from or date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
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
    start = date_from or date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
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
    start = date_from or date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
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


@router.get("/daily/{report_type}/async", status_code=status.HTTP_202_ACCEPTED)
def get_daily_report_async(
    report_type: str,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    date_to:   Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    date:      Optional[str] = Query(None, description="YYYY-MM-DD single day"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PRD Section 7 & Section 3 (#3):
    Offload large Excel export generation to a background job, returning 202 Accepted with job_id.
    """
    if report_type not in ["by-customer", "by-product"]:
        raise HTTPException(status_code=400, detail="Invalid report_type. Use 'by-customer' or 'by-product'.")

    start = date_from or date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end   = date_to   or date or start

    job_id = create_job("excel_export", {
        "report_type": report_type,
        "date_from": start,
        "date_to": end
    }, user_id=current_user.id)

    def _export_worker(jid: str):
        from app.core.database import SessionLocal
        task_db = SessionLocal()
        try:
            update_job_progress(jid, 25, "Aggregating customer and product financial data…")
            data = _get_report_data_for_period(start, end, task_db)

            update_job_progress(jid, 60, "Formatting Excel workbook and formula tables…")
            label = start if start == end else f"{start}_to_{end}"
            if report_type == "by-customer":
                stream = build_daily_by_customer(data, label)
                filename = f"daily_by_customer_{label}.xlsx"
            else:
                stream = build_daily_by_product(data, label)
                filename = f"daily_by_product_{label}.xlsx"

            update_job_progress(jid, 85, "Saving export and generating secure download link…")
            out_dir = os.path.join(settings.UPLOAD_DIR, "generated_reports")
            os.makedirs(out_dir, exist_ok=True)
            file_path = os.path.join(out_dir, filename)
            with open(file_path, "wb") as f:
                f.write(stream.getbuffer())

            signed_url = generate_signed_url(f"generated_reports/{filename}")
            complete_job(jid, {
                "download_url": signed_url,
                "filename": filename,
                "report_type": report_type,
                "date_from": start,
                "date_to": end
            })
        except Exception as exc:
            fail_job(jid, str(exc))
        finally:
            task_db.close()

    run_async_task(job_id, _export_worker)

    return {
        "job_id": job_id,
        "status": "queued",
        "status_url": f"/jobs/{job_id}",
        "message": f"Excel report generation ({report_type}) queued."
    }
