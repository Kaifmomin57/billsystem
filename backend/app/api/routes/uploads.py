import os
import json
import hashlib
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.models.models import Upload, UploadStatus, Bill, BillItem, Customer, Product, CustomerAlias, ColumnMapping, CustomerRate, ProductRate, User
from app.schemas.schemas import UploadDraftUpdate, UploadOut
from app.services.gemini_service import analyze_image
from app.services.excel_service import build_ledger_page_excel
from app.services.cloudinary_service import upload_image_to_cloudinary
from app.utils.image_preprocessor import preprocess_image

router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()

def _match_or_find_customer(name_raw: str, db: Session) -> Optional[Customer]:
    if not name_raw:
        return None
    name_clean = name_raw.strip()
    # 1. Exact match
    c = db.query(Customer).filter(Customer.name.ilike(name_clean)).first()
    if c: return c
    
    # 2. Alias match
    alias = db.query(CustomerAlias).filter(CustomerAlias.alias.ilike(name_clean)).first()
    if alias and alias.customer:
        return alias.customer
        
    # 3. Substring match
    all_custs = db.query(Customer).all()
    for cust in all_custs:
        if name_clean.lower() in cust.name.lower() or cust.name.lower() in name_clean.lower():
            return cust
    return None

def _enrich_draft(draft: Dict[str, Any], db: Session) -> Dict[str, Any]:
    """Enrich rows with customer IDs, resolved product IDs, and expected rates"""
    # Column mappings
    active_mappings = db.query(ColumnMapping).filter(ColumnMapping.active == True).all()
    col_mappings = {m.column_code: m.product_id for m in active_mappings}
    
    # Ensure column_codes includes all active configured columns + any extra extracted codes
    active_codes = [m.column_code for m in active_mappings]
    parsed_codes = draft.get("column_codes") or []
    codes_list = list(dict.fromkeys(parsed_codes + active_codes))
    
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
        matched_cust = _match_or_find_customer(c_raw, db) if c_raw else None
        row["customer_id"] = matched_cust.id if matched_cust else None
        row["customer_name"] = matched_cust.name if matched_cust else c_raw
        row["is_new_customer"] = matched_cust is None
        
        cells = row.get("cells", {})
        for col_code, c_data in cells.items():
            if col_code not in codes_list:
                codes_list.append(col_code)
                
            prod_id = col_mappings.get(col_code)
            c_data["product_id"] = prod_id
            
            # Rate lookup & mismatch warning
            expected_rate = None
            if prod_id:
                if matched_cust:
                    cr = db.query(CustomerRate).filter(CustomerRate.customer_id == matched_cust.id, CustomerRate.product_id == prod_id).first()
                    if cr: expected_rate = float(cr.rate)
                if expected_rate is None:
                    pr = db.query(ProductRate).filter(ProductRate.product_id == prod_id).first()
                    if pr: expected_rate = float(pr.rate)
            
            c_data["expected_rate"] = expected_rate
            if c_data.get("rate") is None and expected_rate is not None:
                c_data["rate"] = expected_rate
                
            # Check rate mismatch
            if c_data.get("rate") is not None and expected_rate is not None:
                c_data["rate_mismatch"] = abs(float(c_data["rate"]) - expected_rate) > 0.01
            else:
                c_data["rate_mismatch"] = False

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

    # Upload to Cloudinary (cloud storage)
    cld_res = upload_image_to_cloudinary(save_path)
    if cld_res and cld_res.get("secure_url"):
        stored_image_path = cld_res.get("secure_url")
        image_url = stored_image_path
    else:
        stored_image_path = filename
        image_url = f"/media/{filename}"

    # Create Upload DB record
    upload = Upload(
        upload_type=upload_type,
        image_path=stored_image_path,
        image_hash=img_hash,
        status="processing"
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    
    # Call Gemini
    try:
        parsed_json, meta = analyze_image(
            proc_bytes,
            mime_type=file.content_type or "image/jpeg",
            upload_type=upload_type
        )
        
        # Format draft data
        if upload_type == "ledger":
            enriched = _enrich_draft(parsed_json, db)
            upload.page_date = enriched.get("page_date") or datetime.utcnow().strftime("%Y-%m-%d")
            upload.draft_data = json.dumps(enriched)
        else:
            # Single bill format to standard draft
            upload.page_date = parsed_json.get("invoice", {}).get("date") or datetime.utcnow().strftime("%Y-%m-%d")
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
    
    return {
        "id": upload.id,
        "upload_type": upload.upload_type,
        "image_path": upload.image_path,
        "image_url": img_url,
        "page_date": upload.page_date,
        "status": upload.status,
        "draft_data": json.loads(upload.draft_data) if upload.draft_data else None,
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
    upload.draft_data = json.dumps(payload.draft_data)
    db.commit()
    return {"message": "Draft saved successfully", "draft_data": payload.draft_data}

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
    col_mappings = {m.column_code: m.product_id for m in db.query(ColumnMapping).filter(ColumnMapping.active == True).all()}
    
    created_bills = []
    
    # Process rows
    rows = draft.get("rows", [])
    for row in rows:
        c_name = (row.get("customer_name") or row.get("customer_name_raw") or "").strip()
        if not c_name or row.get("skip", False):
            continue
            
        # Get or create customer
        customer = db.query(Customer).filter(Customer.name == c_name).first()
        if not customer:
            customer = Customer(name=c_name, is_active=True)
            db.add(customer)
            db.flush()
            
            # Save alias if raw name was different
            raw_alias = (row.get("customer_name_raw") or "").strip()
            if raw_alias and raw_alias != c_name:
                alias_rec = CustomerAlias(customer_id=customer.id, alias=raw_alias)
                db.add(alias_rec)
                
        # Create Bill records ONLY if upload_type is NOT "ledger" (e.g., single bill / invoice upload)
        if upload.upload_type != "ledger":
            line_items = []
            cells = row.get("cells", {})
            for code, cell_val in cells.items():
                qty = cell_val.get("quantity")
                if qty is not None and float(qty) > 0:
                    rate = cell_val.get("rate") or 0.0
                    prod_id = cell_val.get("product_id") or col_mappings.get(code)
                    line_items.append({
                        "product_id": prod_id,
                        "quantity": float(qty),
                        "rate": float(rate),
                        "amount": float(qty) * float(rate),
                        "tag": cell_val.get("tag"),
                        "circled_value": cell_val.get("circled_value"),
                        "confidence": cell_val.get("confidence") or 1.0,
                        "raw_text": cell_val.get("raw_text")
                    })
                    
            if line_items:
                bill_no = f"BILL-{upload.page_date.replace('-', '')}-{str(uuid.uuid4())[:6].upper()}"
                total_amt = sum(item["amount"] for item in line_items)
                
                bill = Bill(
                    customer_id=customer.id,
                    bill_no=bill_no,
                    bill_date=upload.page_date or datetime.utcnow().strftime("%Y-%m-%d"),
                    total_amount=total_amt,
                    source=f"{upload.upload_type}_ai",
                    upload_id=upload.id,
                    image_path=upload.image_path,
                    status="active"
                )
                db.add(bill)
                db.flush()
                
                for itm in line_items:
                    b_item = BillItem(
                        bill_id=bill.id,
                        product_id=itm["product_id"],
                        quantity=itm["quantity"],
                        rate=itm["rate"],
                        amount=itm["amount"],
                        tag=itm["tag"],
                        circled_value=itm["circled_value"],
                        confidence=itm["confidence"],
                        raw_text=itm["raw_text"]
                    )
                    db.add(b_item)
                    
                created_bills.append(bill.id)
        
    upload.status = "saved"
    db.commit()
    
    if upload.upload_type == "ledger":
        msg = "Ledger confirmed! New customers saved to customer directory (No bills created)."
    else:
        msg = f"Successfully created {len(created_bills)} bill(s) for customer records."

    return {
        "message": msg,
        "created_bill_ids": created_bills,
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
