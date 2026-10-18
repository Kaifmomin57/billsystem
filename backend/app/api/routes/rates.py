from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import ProductRate, CustomerRate, RateHistory, Product, Customer, User
from app.schemas.schemas import ProductRateCreate, ProductRateOut, CustomerRateCreate, CustomerRateOut, RateResolutionOut

router = APIRouter(prefix="/rates", tags=["rates"])

# Base product rates
@router.get("/products", response_model=List[ProductRateOut])
def list_product_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rates = db.query(ProductRate).join(Product).all()
    results = []
    for r in rates:
        results.append(ProductRateOut(
            id=r.id,
            product_id=r.product_id,
            rate=float(r.rate),
            live_rate=float(r.live_rate) if r.live_rate is not None else None,
            updated_at=r.updated_at,
            product_name=r.product.name if r.product else None,
            unit=r.product.unit if r.product else None,
            product_code=r.product.product_code if r.product else None
        ))
    return results

@router.post("/products", response_model=ProductRateOut)
def set_product_rate(
    data: ProductRateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    rate_record = db.query(ProductRate).filter(ProductRate.product_id == data.product_id).first()
    old_val = float(rate_record.rate) if rate_record else None
    
    if rate_record:
        rate_record.rate = data.rate
        if data.live_rate is not None:
            rate_record.live_rate = data.live_rate
    else:
        rate_record = ProductRate(
            product_id=data.product_id,
            rate=data.rate,
            live_rate=data.live_rate
        )
        db.add(rate_record)
        
    # Log history
    history = RateHistory(
        rate_type="base",
        product_id=data.product_id,
        old_rate=old_val,
        new_rate=data.rate,
        changed_by=current_user.username
    )
    db.add(history)
    db.commit()
    db.refresh(rate_record)
    
    return ProductRateOut(
        id=rate_record.id,
        product_id=rate_record.product_id,
        rate=float(rate_record.rate),
        live_rate=float(rate_record.live_rate) if rate_record.live_rate is not None else None,
        updated_at=rate_record.updated_at,
        product_name=product.name,
        unit=product.unit,
        product_code=product.product_code
    )

@router.post("/products/{product_id}/live-rate", response_model=ProductRateOut)
def set_product_live_rate(
    product_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    rate_record = db.query(ProductRate).filter(ProductRate.product_id == product_id).first()
    new_live = float(data["live_rate"]) if data.get("live_rate") is not None else None
    old_live = float(rate_record.live_rate) if rate_record and rate_record.live_rate is not None else None
    
    if rate_record:
        rate_record.live_rate = new_live
    else:
        rate_record = ProductRate(product_id=product_id, rate=0.0, live_rate=new_live)
        db.add(rate_record)
        
    if new_live is not None:
        history = RateHistory(
            rate_type="base_live",
            product_id=product_id,
            old_rate=old_live,
            new_rate=new_live,
            changed_by=current_user.username
        )
        db.add(history)
        
    db.commit()
    db.refresh(rate_record)
    
    return ProductRateOut(
        id=rate_record.id,
        product_id=rate_record.product_id,
        rate=float(rate_record.rate),
        live_rate=float(rate_record.live_rate) if rate_record.live_rate is not None else None,
        updated_at=rate_record.updated_at,
        product_name=product.name,
        unit=product.unit,
        product_code=product.product_code
    )

# Customer-specific rates
@router.get("/customers", response_model=List[CustomerRateOut])
def list_customer_rates(
    customer_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CustomerRate)
    if customer_id:
        query = query.filter(CustomerRate.customer_id == customer_id)
    if product_id:
        query = query.filter(CustomerRate.product_id == product_id)
        
    rates = query.all()
    results = []
    for r in rates:
        cust = db.query(Customer).filter(Customer.id == r.customer_id).first()
        prod = db.query(Product).filter(Product.id == r.product_id).first()
        results.append(CustomerRateOut(
            id=r.id,
            customer_id=r.customer_id,
            product_id=r.product_id,
            rate=float(r.rate),
            live_rate=float(r.live_rate) if r.live_rate is not None else None,
            updated_at=r.updated_at,
            customer_name=cust.name if cust else None,
            product_name=prod.name if prod else None,
            unit=prod.unit if prod else None
        ))
    return results

@router.post("/customers", response_model=CustomerRateOut)
def set_customer_rate(
    data: CustomerRateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    prod = db.query(Product).filter(Product.id == data.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
        
    rate_record = db.query(CustomerRate).filter(
        CustomerRate.customer_id == data.customer_id,
        CustomerRate.product_id == data.product_id
    ).first()
    
    old_val = float(rate_record.rate) if rate_record else None
    
    if rate_record:
        rate_record.rate = data.rate
        if data.live_rate is not None:
            rate_record.live_rate = data.live_rate
    else:
        rate_record = CustomerRate(
            customer_id=data.customer_id,
            product_id=data.product_id,
            rate=data.rate,
            live_rate=data.live_rate
        )
        db.add(rate_record)
        
    history = RateHistory(
        rate_type="customer",
        customer_id=data.customer_id,
        product_id=data.product_id,
        old_rate=old_val,
        new_rate=data.rate,
        changed_by=current_user.username
    )
    db.add(history)
    db.commit()
    db.refresh(rate_record)
    
    return CustomerRateOut(
        id=rate_record.id,
        customer_id=rate_record.customer_id,
        product_id=rate_record.product_id,
        rate=float(rate_record.rate),
        live_rate=float(rate_record.live_rate) if rate_record.live_rate is not None else None,
        updated_at=rate_record.updated_at,
        customer_name=cust.name,
        product_name=prod.name,
        unit=prod.unit
    )

@router.delete("/customers/{rate_id}")
def delete_customer_rate(
    rate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rate = db.query(CustomerRate).filter(CustomerRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Customer rate not found")
    db.delete(rate)
    db.commit()
    return {"message": "Customer rate deleted"}

# Effective rate resolution: (Customer Live / Base Live) -> Customer Rate -> Base Rate -> 0
@router.get("/effective", response_model=RateResolutionOut)
def get_effective_rate(
    product_id: int = Query(...),
    customer_id: Optional[int] = Query(None),
    is_live: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if is_live:
        # Check customer live rate override
        if customer_id:
            cr = db.query(CustomerRate).filter(
                CustomerRate.customer_id == customer_id,
                CustomerRate.product_id == product_id
            ).first()
            if cr and cr.live_rate is not None:
                return RateResolutionOut(
                    customer_id=customer_id,
                    product_id=product_id,
                    product_name=prod.name,
                    rate=float(cr.live_rate),
                    rate_type="customer_live",
                    is_live=True
                )
                
        # Base live rate
        pr = db.query(ProductRate).filter(ProductRate.product_id == product_id).first()
        if pr and pr.live_rate is not None:
            return RateResolutionOut(
                customer_id=customer_id,
                product_id=product_id,
                product_name=prod.name,
                rate=float(pr.live_rate),
                rate_type="base_live",
                is_live=True
            )
            
        # Fallback to customer regular rate
        if customer_id:
            cr = db.query(CustomerRate).filter(
                CustomerRate.customer_id == customer_id,
                CustomerRate.product_id == product_id
            ).first()
            if cr and cr.rate is not None:
                return RateResolutionOut(
                    customer_id=customer_id,
                    product_id=product_id,
                    product_name=prod.name,
                    rate=float(cr.rate),
                    rate_type="customer",
                    is_live=True
                )
                
        # Fallback to base regular rate
        if pr and pr.rate is not None:
            return RateResolutionOut(
                customer_id=customer_id,
                product_id=product_id,
                product_name=prod.name,
                rate=float(pr.rate),
                rate_type="base",
                is_live=True
            )
            
        return RateResolutionOut(
            customer_id=customer_id,
            product_id=product_id,
            product_name=prod.name,
            rate=0.0,
            rate_type="none",
            is_live=True
        )

    # Standard (non-live) rate resolution
    if customer_id:
        cr = db.query(CustomerRate).filter(
            CustomerRate.customer_id == customer_id,
            CustomerRate.product_id == product_id
        ).first()
        if cr and cr.rate is not None:
            return RateResolutionOut(
                customer_id=customer_id,
                product_id=product_id,
                product_name=prod.name,
                rate=float(cr.rate),
                rate_type="customer",
                is_live=False
            )
            
    # Base rate fallback
    pr = db.query(ProductRate).filter(ProductRate.product_id == product_id).first()
    if pr and pr.rate is not None:
        return RateResolutionOut(
            customer_id=customer_id,
            product_id=product_id,
            product_name=prod.name,
            rate=float(pr.rate),
            rate_type="base",
            is_live=False
        )
        
    return RateResolutionOut(
        customer_id=customer_id,
        product_id=product_id,
        product_name=prod.name,
        rate=0.0,
        rate_type="none",
        is_live=False
    )

@router.get("/history")
def get_rate_history(
    product_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(RateHistory)
    if product_id:
        query = query.filter(RateHistory.product_id == product_id)
    if customer_id:
        query = query.filter(RateHistory.customer_id == customer_id)
    history = query.order_by(RateHistory.changed_at.desc()).limit(100).all()
    
    results = []
    for h in history:
        prod = db.query(Product).filter(Product.id == h.product_id).first()
        cust = db.query(Customer).filter(Customer.id == h.customer_id).first() if h.customer_id else None
        results.append({
            "id": h.id,
            "rate_type": h.rate_type,
            "product_id": h.product_id,
            "product_name": prod.name if prod else None,
            "customer_id": h.customer_id,
            "customer_name": cust.name if cust else None,
            "old_rate": float(h.old_rate) if h.old_rate is not None else None,
            "new_rate": float(h.new_rate),
            "changed_by": h.changed_by,
            "changed_at": h.changed_at.isoformat()
        })
    return results
