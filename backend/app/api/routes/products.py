from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Product, User
from app.schemas.schemas import ProductCreate, ProductUpdate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])

@router.get("", response_model=List[ProductOut])
def list_products(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    return query.order_by(Product.name.asc()).all()

@router.post("", response_model=ProductOut)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Product).filter(Product.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product with this name already exists")
    
    product = Product(
        name=data.name.strip(),
        unit=data.unit.strip() if data.unit else "pcs",
        is_active=data.is_active
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if data.name is not None:
        existing = db.query(Product).filter(Product.name == data.name.strip(), Product.id != product_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another product with this name already exists")
        product.name = data.name.strip()
    if data.unit is not None:
        product.unit = data.unit.strip()
    if data.is_active is not None:
        product.is_active = data.is_active
    
    db.commit()
    db.refresh(product)
    return product

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    return {"message": "Product deactivated successfully"}
