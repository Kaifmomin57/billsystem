import os
import json
import hashlib
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import concurrent.futures

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.core.audit import record_audit
from app.core.signing import generate_signed_url
from app.services.job_service import create_job, run_async_task, update_job_progress, complete_job, fail_job
from app.models.models import Upload, UploadStatus, Bill, BillItem, PaymentInstallment, Customer, Product, CustomerAlias, ColumnMapping, CustomerRate, ProductRate, User
from app.schemas.schemas import UploadDraftUpdate, UploadOut
from app.services.gemini_service import analyze_image
from app.services.excel_service import build_ledger_page_excel
from app.services.ledger_service import resolve_ledger_rates, _load_column_mappings
from app.services.cloudinary_service import upload_image_to_cloudinary
from app.utils.image_preprocessor import preprocess_image

router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()

def _enrich_draft(draft: Dict[str, Any], db: Session) -> Dict[str, Any]:
    """Enrich rows with customer IDs, resolved product IDs, and expected rates (batch optimized in-memory)"""
    # 1. Column mappings with fallback to Product codes and abbreviations
    col_prod_map = _load_column_mappings(db)
    col_mappings = {code: prod.id for code, prod in col_prod_map.items()}
    
    parsed_codes = [str(c).strip().upper() for c in (draft.get("column_codes") or []) if c]
    active_codes = [m.column_code.strip().upper() for m in db.query(ColumnMapping).filter(ColumnMapping.active == True).all() if m.column_code]
    codes_list = list(dict.fromkeys(parsed_codes + active_codes))
    
    # 2. Batch load all customers, aliases, and rates to avoid queries in loops
    all_custs = db.query(Customer).all()
    cust_name_map = {c.name.strip().lower(): c for c in all_custs if c.name}
    
    all_aliases = db.query(CustomerAlias).options(joinedload(CustomerAlias.customer)).all()
    alias_map = {a.alias.strip().lower(): a.customer for a in all_aliases if a.customer and a.alias}
    
    all_cr = {(r.customer_id, r.product_id): float(r.rate) for r in db.query(CustomerRate).all()}
    all_pr = {r.product_id: float(r.rate) for r in db.query(ProductRate).all()}

    def _match_customer_in_memory(name_raw: str) -> Optional[Customer]:
        if not name_raw:
            return None
        nc = name_raw.strip().lower()
        if nc in cust_name_map:
            return cust_name_map[nc]
        if nc in alias_map:
            return alias_map[nc]
        for c in all_custs:
            c_low = c.name.strip().lower()
            if nc in c_low or c_low in nc:
                return c
        return None

    rows = draft.get("rows", [])
    for row in rows:
        c_raw = (
            row.get("customer_name_raw") or
            row.get("customer_name") or
            row.get("name") or
            row.get("customer") or
            row.get("customer_raw") or
            ""
        ).strip()
        row["customer_name_raw"] = c_raw
        matched_cust = _match_customer_in_memory(c_raw) if c_raw else None
        row["customer_id"] = matched_cust.id if matched_cust else None
        row["customer_name"] = matched_cust.name if matched_cust else c_raw
        row["is_new_customer"] = matched_cust is None
        
        cells = row.get("cells", {})
        for col_code, c_data in cells.items():
            col_up = str(col_code).strip().upper()
            if col_up not in codes_list:
                codes_list.append(col_up)
                
            prod_id = col_mappings.get(col_up)
            c_data["product_id"] = prod_id
            
            # Fast in-memory Rate lookup
            expected_rate = None
            if prod_id:
                if matched_cust and (matched_cust.id, prod_id) in all_cr:
                    expected_rate = all_cr[(matched_cust.id, prod_id)]
                if expected_rate is None and prod_id in all_pr:
                    expected_rate = all_pr[prod_id]
            
            c_data["expected_rate"] = expected_rate
            if c_data.get("rate") is None and expected_rate is not None:
                c_data["rate"] = expected_rate
                
            # Check rate mismatch
            if c_data.get("rate") is not None and expected_rate is not None:
                c_data["rate_mismatch"] = abs(float(c_data["rate"]) - expected_rate) > 0.01
            else:
                c_data["rate_mismatch"] = False

    # After customer IDs are resolved, also resolve product rates from DB
    resolve_ledger_rates(draft, db)

    draft["column_codes"] = codes_list
    return draft

@router.post("", response_model=Dict[str, Any])
async def upload_and_process_bill(
    file: UploadFile = File(...),
    upload_type: str = Form("ledger"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
    img_hash = hashlib.sha256(contents).hexdigest()
    
    # Save original image
    filename = f"{uuid.uuid4()}_{file.filename}"
    save_path = os.path.join(settings.UPLOAD_DIR, filename)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(save_path, "wb") as f:
        f.write(contents)
        
    # Preprocess image
    proc_path = preprocess_image(save_path)
    with open(proc_path, "rb") as f:
        proc_bytes = f.read()

    # Initial file paths (local fallback immediately available)
    stored_image_path = filename
    image_url = f"/media/{filename}"

    # Create Upload DB record immediately
    upload = Upload(
        upload_type=upload_type,
        image_path=stored_image_path,
        image_hash=img_hash,
        status="processing"
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # Parallel execution: run Cloudinary upload and Gemini AI OCR simultaneously
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_cld = executor.submit(upload_image_to_cloudinary, save_path)
            future_gemini = executor.submit(
                analyze_image,
                proc_bytes,
                file.content_type or "image/jpeg",
                upload_type
            )

            # Await Gemini AI result
            parsed_json, meta = future_gemini.result()

            # Process Cloudinary result if available
            try:
                cld_res = future_cld.result()
                if cld_res and cld_res.get("secure_url"):
                    stored_image_path = cld_res.get("secure_url")
                    image_url = stored_image_path
                    upload.image_path = stored_image_path
            except Exception as cld_err:
                print(f"Cloudinary background upload warning: {cld_err}")
        
        # Format draft data
        if upload_type == "ledger":
            enriched = _enrich_draft(parsed_json, db)
            upload.page_date = enriched.get("page_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            upload.draft_data = json.dumps(enriched)
        else:
            # Single bill format to standard draft
            upload.page_date = parsed_json.get("invoice", {}).get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            upload.draft_data = json.dumps(parsed_json)
            
        upload.gemini_raw_response = json.dumps({"parsed": parsed_json, "meta": meta})
        upload.status = "needs_review"
        db.commit()
        db.refresh(upload)
        
        return {
            "id": upload.id,
            "status": upload.status,
            "page_date": upload.page_date,
            "image_url": image_url,
            "draft_data": json.loads(upload.draft_data),
            "meta": meta
        }
        
    except Exception as e:
        upload.status = "failed"
        upload.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Gemini AI processing error: {str(e)}")

@router.post("/async", status_code=status.HTTP_202_ACCEPTED)
async def upload_and_process_async(
    file: UploadFile = File(...),
    upload_type: str = Form("ledger"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PRD Section 7 & Section 3 (#2):
    Accepts ledger or invoice file, saves image, queues background OCR extraction,
    and returns 202 Accepted with job_id and pollable status URL.
    """
    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")

    img_hash = hashlib.sha256(contents).hexdigest()

    safe_name = f"{uuid.uuid4()}_{file.filename}"
    save_path = os.path.join(settings.UPLOAD_DIR, safe_name)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(save_path, "wb") as f:
        f.write(contents)

    upload = Upload(
        upload_type=upload_type,
        image_path=safe_name,
        image_hash=img_hash,
        status="processing"
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    upload_id = upload.id
    content_type = file.content_type or "image/jpeg"

    job_id = create_job("ocr", {
        "upload_id": upload_id,
        "upload_type": upload_type,
        "filename": safe_name
    }, user_id=current_user.id)

    record_audit(
        db=db,
        action="upload_scan_queued",
        entity_type="upload",
        entity_id=str(upload_id),
        user_id=current_user.id,
        changes={"filename": file.filename, "upload_type": upload_type, "job_id": job_id}
    )

    def _ocr_worker(jid: str):
        from app.core.database import SessionLocal
        task_db = SessionLocal()
        try:
            update_job_progress(jid, 15, "Preprocessing image for optical character recognition…")
            proc_path = preprocess_image(save_path)
            with open(proc_path, "rb") as pf:
                proc_bytes = pf.read()

            update_job_progress(jid, 35, "Uploading to secure cloud storage…")
            stored_image_path = safe_name
            try:
                cld_res = upload_image_to_cloudinary(save_path)
                if cld_res and cld_res.get("secure_url"):
                    stored_image_path = cld_res.get("secure_url")
            except Exception:
                pass

            update_job_progress(jid, 60, "Running Gemini AI neural extraction…")
            parsed_json, meta = analyze_image(proc_bytes, content_type, upload_type)

            update_job_progress(jid, 85, "Cross-referencing customer names and base rates…")
            u_rec = task_db.query(Upload).filter(Upload.id == upload_id).first()
            if u_rec:
                u_rec.image_path = stored_image_path
                if upload_type == "ledger":
                    enriched = _enrich_draft(parsed_json, task_db)
                    u_rec.page_date = enriched.get("page_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                    u_rec.draft_data = json.dumps(enriched)
                else:
                    u_rec.page_date = parsed_json.get("invoice", {}).get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                    u_rec.draft_data = json.dumps(parsed_json)

                u_rec.gemini_raw_response = json.dumps({"parsed": parsed_json, "meta": meta})
                u_rec.status = "needs_review"
                task_db.commit()
                task_db.refresh(u_rec)

                image_url = stored_image_path if stored_image_path.startswith("http") else f"/media/{stored_image_path}"
                complete_job(jid, {
                    "upload_id": u_rec.id,
                    "status": "needs_review",
                    "page_date": u_rec.page_date,
                    "image_url": image_url,
                    "draft_data": json.loads(u_rec.draft_data),
                    "meta": meta
                }, status="needs_review")
        except Exception as exc:
            u_rec = task_db.query(Upload).filter(Upload.id == upload_id).first()
            if u_rec:
                u_rec.status = "failed"
                u_rec.error_message = str(exc)
                task_db.commit()
            fail_job(jid, str(exc))
        finally:
            task_db.close()

    run_async_task(job_id, _ocr_worker)

    return {
        "job_id": job_id,
        "upload_id": upload_id,
        "status": "queued",
        "status_url": f"/jobs/{job_id}",
        "message": "Ledger OCR scan queued. Processing in background."
    }

@router.get("", response_model=List[Dict[str, Any]])
def list_uploads(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    uploads = db.query(Upload).order_by(Upload.id.desc()).limit(limit).all()
    results = []
    for u in uploads:
        img_url = None
        if u.image_path:
            img_url = u.image_path if u.image_path.startswith("http") else f"/media/{u.image_path}"
        results.append({
            "id": u.id,
            "upload_type": u.upload_type,
            "image_path": u.image_path,
            "image_url": img_url,
            "page_date": u.page_date,
            "status": u.status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "error_message": u.error_message
        })
    return results

@router.get("/{upload_id}")
def get_upload_detail(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    img_url = None
    if upload.image_path:
        img_url = upload.image_path if upload.image_path.startswith("http") else f"/media/{upload.image_path}"
    
    draft_obj = json.loads(upload.draft_data) if upload.draft_data else None
    if draft_obj and upload.upload_type == "ledger":
        try:
            draft_obj = resolve_ledger_rates(draft_obj, db)
        except Exception:
            pass

    return {
        "id": upload.id,
        "upload_type": upload.upload_type,
        "image_path": upload.image_path,
        "image_url": img_url,
        "page_date": upload.page_date,
        "status": upload.status,
        "draft_data": draft_obj,
        "excel_path": upload.excel_path,
        "error_message": upload.error_message,
        "created_at": upload.created_at.isoformat() if upload.created_at else None
    }

@router.put("/{upload_id}/draft")
def update_upload_draft(
    upload_id: int,
    payload: UploadDraftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
        
    if payload.page_date:
        upload.page_date = payload.page_date
    draft_data = payload.draft_data
    if upload.upload_type == "ledger" and isinstance(draft_data, dict):
        try:
            draft_data = resolve_ledger_rates(draft_data, db)
        except Exception:
            pass
    upload.draft_data = json.dumps(draft_data)
    db.commit()
    return {"message": "Draft saved successfully", "draft_data": draft_data}

@router.post("/{upload_id}/confirm")
def confirm_upload_and_create_bills(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload or not upload.draft_data:
        raise HTTPException(status_code=404, detail="Upload draft not found")

    draft = json.loads(upload.draft_data)

    # Always re-resolve rates from DB at confirm time so bills use the
    # current authoritative product/rate data — not stale Gemini values.
    draft = resolve_ledger_rates(draft, db)

    col_prod_map = _load_column_mappings(db)
    col_mappings = {
        code: prod.id
        for code, prod in col_prod_map.items()
    }

    # Deduplication & safe replacement: if bills were already created for this upload,
    # remove the previous ones (and their items) so re-saving/confirming never creates duplicates.
    existing_bills = db.query(Bill).filter(Bill.upload_id == upload_id).all()
    if existing_bills:
        has_paid = any(float(b.amount_paid or 0) > 0 for b in existing_bills)
        if has_paid:
            raise HTTPException(
                status_code=400,
                detail="Cannot regenerate bills: some bills from this upload already have payments recorded."
            )
        existing_bill_ids = [b.id for b in existing_bills]
        db.query(PaymentInstallment).filter(PaymentInstallment.bill_id.in_(existing_bill_ids)).delete(synchronize_session=False)
        db.query(BillItem).filter(BillItem.bill_id.in_(existing_bill_ids)).delete(synchronize_session=False)
        db.query(Bill).filter(Bill.id.in_(existing_bill_ids)).delete(synchronize_session=False)
        db.flush()

    created_bills = []
    skipped_rows = []

    # Preload existing customers to avoid N+1 DB queries per row
    existing_customers = db.query(Customer).all()
    customer_name_map = {c.name.strip().lower(): c for c in existing_customers if c.name}

    rows = draft.get("rows", [])
    for row in rows:
        c_name = (row.get("customer_name") or row.get("customer_name_raw") or "").strip()
        if not c_name or row.get("skip", False):
            skipped_rows.append(c_name or "(unnamed)")
            continue

        # Get or create customer (in-memory lookup first)
        c_key = c_name.lower()
        customer = customer_name_map.get(c_key)
        if not customer:
            customer = Customer(name=c_name, is_active=True)
            db.add(customer)
            db.flush()
            customer_name_map[c_key] = customer
            raw_alias = (row.get("customer_name_raw") or "").strip()
            if raw_alias and raw_alias != c_name:
                db.add(CustomerAlias(customer_id=customer.id, alias=raw_alias))

        # Build line items — use DB-resolved rates authoritatively
        line_items = []
        cells = row.get("cells", {})
        for code, cell_val in cells.items():
            if not isinstance(cell_val, dict):
                continue
            qty = cell_val.get("quantity")
            try:
                qty_float = float(qty) if qty is not None else 0.0
            except (ValueError, TypeError):
                qty_float = 0.0

            if qty_float <= 0:
                continue

            # Authoritative: DB resolved rate > Gemini rate > 0
            resolved_rate = cell_val.get("resolved_rate")
            resolved_amount = cell_val.get("resolved_amount")
            if resolved_rate is not None:
                rate_float = float(resolved_rate)
                amount_float = float(resolved_amount) if resolved_amount is not None else round(qty_float * rate_float, 2)
            else:
                gemini_rate = cell_val.get("rate")
                try:
                    rate_float = float(gemini_rate) if gemini_rate is not None else 0.0
                except (ValueError, TypeError):
                    rate_float = 0.0
                amount_float = round(qty_float * rate_float, 2)

            prod_id = (
                cell_val.get("resolved_product_id")
                or cell_val.get("product_id")
                or col_mappings.get(code)
            )

            line_items.append({
                "product_id": prod_id,
                "quantity": qty_float,
                "rate": rate_float,
                "amount": amount_float,
                "tag": cell_val.get("tag"),
                "circled_value": cell_val.get("circled_value"),
                "is_live": cell_val.get("is_live", False),
                "confidence": cell_val.get("confidence") or 1.0,
                "raw_text": cell_val.get("raw_text"),
            })

        if not line_items:
            skipped_rows.append(f"{c_name} (no quantities)")
            continue

        bill_no = f"BILL-{(upload.page_date or '').replace('-', '')}-{str(uuid.uuid4())[:6].upper()}"
        total_amt = round(sum(item["amount"] for item in line_items), 2)

        bill = Bill(
            customer_id=customer.id,
            bill_no=bill_no,
            bill_date=upload.page_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            total_amount=total_amt,
            amount_paid=0,
            balance_due=total_amt,
            payment_status="unpaid",
            source="ledger_ai",
            upload_id=upload.id,
            image_path=upload.image_path,
            status="active"
        )
        db.add(bill)
        db.flush()

        for itm in line_items:
            db.add(BillItem(
                bill_id=bill.id,
                product_id=itm["product_id"],
                quantity=itm["quantity"],
                rate=itm["rate"],
                amount=itm["amount"],
                tag=itm.get("tag"),
                circled_value=itm.get("circled_value"),
                is_live=itm.get("is_live", False),
                confidence=itm.get("confidence") or 1.0,
                raw_text=itm.get("raw_text"),
            ))

        created_bills.append({
            "bill_id": bill.id,
            "bill_no": bill_no,
            "customer_name": c_name,
            "total_amount": total_amt,
            "items_count": len(line_items),
        })

    upload.status = "saved"
    db.commit()

    return {
        "message": f"Successfully created {len(created_bills)} bill(s) from ledger.",
        "created_bills": created_bills,
        "skipped_rows": skipped_rows,
        "upload_status": "saved"
    }


@router.get("/{upload_id}/excel")
def download_upload_excel(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload or not upload.draft_data:
        raise HTTPException(status_code=404, detail="Upload not found or no draft data available")
        
    if isinstance(upload.draft_data, dict):
        draft = upload.draft_data
    else:
        try:
            draft = json.loads(upload.draft_data)
        except Exception:
            draft = {}

    # Re-resolve rates from DB at export time so Excel always reflects
    # the current authoritative product/rate data (handles stale drafts).
    draft = resolve_ledger_rates(draft, db)

    stream = build_ledger_page_excel(draft, upload.page_date or "unknown")
    filename = f"digitized_ledger_{upload.page_date or 'page'}_{upload_id}.xlsx"
    
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.delete("/{upload_id}")
def delete_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    # Check associated bills
    bills = db.query(Bill).filter(Bill.upload_id == upload_id).all()
    if bills:
        # Check if any bill has payments recorded
        has_paid = any(float(b.amount_paid or 0) > 0 for b in bills)
        if has_paid:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete upload because one or more associated bills already have payments recorded."
            )
        bill_ids = [b.id for b in bills]
        db.query(PaymentInstallment).filter(PaymentInstallment.bill_id.in_(bill_ids)).delete(synchronize_session=False)
        db.query(BillItem).filter(BillItem.bill_id.in_(bill_ids)).delete(synchronize_session=False)
        db.query(Bill).filter(Bill.id.in_(bill_ids)).delete(synchronize_session=False)
        db.flush()

    # Clean up local image/excel files if stored locally
    if upload.image_path and not upload.image_path.startswith("http") and os.path.exists(upload.image_path):
        try:
            os.remove(upload.image_path)
        except Exception:
            pass

    if upload.excel_path and os.path.exists(upload.excel_path):
        try:
            os.remove(upload.excel_path)
        except Exception:
            pass

    db.delete(upload)
    db.commit()

    return {"message": f"Upload #{upload_id} deleted successfully"}
