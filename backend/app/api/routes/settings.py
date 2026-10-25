from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import ColumnMapping, CustomerAlias, TagDictionary, Product, Customer, User, AppSetting
from app.schemas.schemas import (
    ColumnMappingCreate, ColumnMappingOut,
    CustomerAliasCreate, CustomerAliasOut,
    TagDictionaryCreate, TagDictionaryOut,
    GeneralSettingsIn, GeneralSettingsOut
)

router = APIRouter(prefix="/settings", tags=["settings"])

def get_app_setting(db: Session, key: str, default: str = "") -> str:
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    return setting.value if setting and setting.value else default

# General Settings (e.g. Default Customer Phone)
@router.get("/general", response_model=GeneralSettingsOut)
def get_general_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    setting = db.query(AppSetting).filter(AppSetting.key == "default_customer_phone").first()
    phone = setting.value if setting and setting.value else "9730526659"
    updated_at = setting.updated_at if setting else None
    return GeneralSettingsOut(default_customer_phone=phone, updated_at=updated_at)

@router.post("/general", response_model=GeneralSettingsOut)
def update_general_settings(
    data: GeneralSettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    phone_val = (data.default_customer_phone or "").strip()
    setting = db.query(AppSetting).filter(AppSetting.key == "default_customer_phone").first()
    if not setting:
        setting = AppSetting(
            key="default_customer_phone",
            value=phone_val or "9730526659",
            description="Default customer phone number"
        )
        db.add(setting)
    else:
        setting.value = phone_val or "9730526659"
        setting.updated_at = datetime.utcnow()

    # If requested, also update all existing customers whose phone is null or empty
    if data.update_existing_customers and setting.value:
        db.query(Customer).filter((Customer.phone == None) | (Customer.phone == "")).update(
            {"phone": setting.value}, synchronize_session=False
        )

    db.commit()
    db.refresh(setting)
    return GeneralSettingsOut(default_customer_phone=setting.value, updated_at=setting.updated_at)

# Column mappings
@router.get("/columns", response_model=List[ColumnMappingOut])
def list_column_mappings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mappings = db.query(ColumnMapping).all()
    results = []
    for m in mappings:
        prod = db.query(Product).filter(Product.id == m.product_id).first()
        results.append(ColumnMappingOut(
            id=m.id,
            column_code=m.column_code,
            product_id=m.product_id,
            product_name=prod.name if prod else None,
            active=m.active
        ))
    return results

@router.post("/columns", response_model=ColumnMappingOut)
def set_column_mapping(
    data: ColumnMappingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prod = db.query(Product).filter(Product.id == data.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
        
    code_clean = data.column_code.strip().upper()
    existing = db.query(ColumnMapping).filter(ColumnMapping.column_code == code_clean).first()
    if existing:
        existing.product_id = data.product_id
        existing.active = data.active
        mapping = existing
    else:
        mapping = ColumnMapping(column_code=code_clean, product_id=data.product_id, active=data.active)
        db.add(mapping)
        
    db.commit()
    db.refresh(mapping)
    return ColumnMappingOut(
        id=mapping.id,
        column_code=mapping.column_code,
        product_id=mapping.product_id,
        product_name=prod.name,
        active=mapping.active
    )

@router.delete("/columns/{mapping_id}")
def delete_column_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    m = db.query(ColumnMapping).filter(ColumnMapping.id == mapping_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(m)
    db.commit()
    return {"message": "Column mapping removed"}

# Customer Aliases
@router.get("/aliases", response_model=List[CustomerAliasOut])
def list_aliases(
    customer_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CustomerAlias)
    if customer_id:
        query = query.filter(CustomerAlias.customer_id == customer_id)
    aliases = query.all()
    results = []
    for a in aliases:
        cust = db.query(Customer).filter(Customer.id == a.customer_id).first()
        results.append(CustomerAliasOut(
            id=a.id,
            customer_id=a.customer_id,
            customer_name=cust.name if cust else None,
            alias=a.alias
        ))
    return results

@router.post("/aliases", response_model=CustomerAliasOut)
def create_alias(
    data: CustomerAliasCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    alias = CustomerAlias(customer_id=data.customer_id, alias=data.alias.strip())
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return CustomerAliasOut(
        id=alias.id,
        customer_id=alias.customer_id,
        customer_name=cust.name,
        alias=alias.alias
    )

@router.delete("/aliases/{alias_id}")
def delete_alias(
    alias_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alias = db.query(CustomerAlias).filter(CustomerAlias.id == alias_id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    db.delete(alias)
    db.commit()
    return {"message": "Alias deleted"}

# Tag Dictionary
@router.get("/tags", response_model=List[TagDictionaryOut])
def list_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(TagDictionary).all()

@router.post("/tags", response_model=TagDictionaryOut)
def set_tag_meaning(
    data: TagDictionaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tag_clean = data.tag.strip()
    existing = db.query(TagDictionary).filter(TagDictionary.tag.ilike(tag_clean)).first()
    if existing:
        existing.meaning = data.meaning.strip()
        rec = existing
    else:
        rec = TagDictionary(tag=tag_clean, meaning=data.meaning.strip())
        db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

@router.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    t = db.query(TagDictionary).filter(TagDictionary.id == tag_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(t)
    db.commit()
    return {"message": "Tag deleted"}
