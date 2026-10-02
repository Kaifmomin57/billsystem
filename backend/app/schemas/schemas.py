from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from decimal import Decimal


# Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime
    class Config:
        from_attributes = True


# Customer schemas
class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerOut(CustomerBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


# Product schemas
class ProductBase(BaseModel):
    name: str
    unit: str = "pcs"
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None

class ProductOut(ProductBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


# Rate schemas
class ProductRateCreate(BaseModel):
    product_id: int
    rate: float

class ProductRateOut(BaseModel):
    id: int
    product_id: int
    rate: float
    updated_at: datetime
    product_name: Optional[str] = None
    unit: Optional[str] = None
    class Config:
        from_attributes = True

class CustomerRateCreate(BaseModel):
    customer_id: int
    product_id: int
    rate: float

class CustomerRateOut(BaseModel):
    id: int
    customer_id: int
    product_id: int
    rate: float
    updated_at: datetime
    customer_name: Optional[str] = None
    product_name: Optional[str] = None
    unit: Optional[str] = None
    class Config:
        from_attributes = True

class RateResolutionOut(BaseModel):
    customer_id: Optional[int]
    product_id: int
    product_name: str
    rate: float
    rate_type: str  # "customer" | "base" | "none"


# Bill & Bill Item schemas
class BillItemCreate(BaseModel):
    product_id: Optional[int] = None
    quantity: float
    rate: float
    amount: Optional[float] = None
    tag: Optional[str] = None
    circled_value: Optional[str] = None
    confidence: Optional[float] = 1.0
    raw_text: Optional[str] = None

class BillItemOut(BaseModel):
    id: int
    bill_id: int
    product_id: Optional[int]
    product_name: Optional[str] = None
    unit: Optional[str] = "kg"
    quantity: float
    rate: float
    amount: float
    tag: Optional[str]
    circled_value: Optional[str]
    confidence: Optional[float]
    raw_text: Optional[str]
    class Config:
        from_attributes = True

class BillCreate(BaseModel):
    customer_id: int
    bill_date: str
    items: List[BillItemCreate]
    amount_paid: Optional[float] = 0.0
    payment_method: Optional[str] = "Cash"
    source: str = "manual"
    upload_id: Optional[int] = None
    image_path: Optional[str] = None

class BillUpdate(BaseModel):
    customer_id: Optional[int] = None
    bill_date: Optional[str] = None
    items: Optional[List[BillItemCreate]] = None
    payment_method: Optional[str] = None

class BillPaymentUpdate(BaseModel):
    installment_amount: float   # The NEW amount being paid in this installment
    payment_method: Optional[str] = "Cash"
    note: Optional[str] = None

class PaymentInstallmentOut(BaseModel):
    id: int
    bill_id: int
    amount: float
    payment_method: str
    note: Optional[str]
    paid_at: datetime
    class Config:
        from_attributes = True

class BillOut(BaseModel):
    id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    bill_no: Optional[str] = None
    bill_date: str
    total_amount: float
    amount_paid: float = 0.0
    balance_due: float = 0.0
    payment_status: str = "unpaid"
    payment_method: str = "Cash"
    source: str
    upload_id: Optional[int] = None
    image_path: Optional[str] = None
    status: str
    created_at: datetime
    items: List[BillItemOut] = []
    payment_history: List[PaymentInstallmentOut] = []
    class Config:
        from_attributes = True


# Upload & Draft schemas
class UploadDraftUpdate(BaseModel):
    page_date: Optional[str] = None
    draft_data: Dict[str, Any]

class UploadOut(BaseModel):
    id: int
    upload_type: str
    image_path: Optional[str]
    page_date: Optional[str]
    status: str
    draft_data: Optional[Dict[str, Any]] = None
    excel_path: Optional[str]
    error_message: Optional[str]
    created_at: datetime


# Settings schemas
class ColumnMappingCreate(BaseModel):
    column_code: str
    product_id: int
    active: bool = True

class ColumnMappingOut(BaseModel):
    id: int
    column_code: str
    product_id: int
    product_name: Optional[str] = None
    active: bool
    class Config:
        from_attributes = True

class CustomerAliasCreate(BaseModel):
    customer_id: int
    alias: str

class CustomerAliasOut(BaseModel):
    id: int
    customer_id: int
    customer_name: Optional[str] = None
    alias: str
    class Config:
        from_attributes = True

class TagDictionaryCreate(BaseModel):
    tag: str
    meaning: str

class TagDictionaryOut(BaseModel):
    id: int
    tag: str
    meaning: str
    class Config:
        from_attributes = True

class BulkWhatsAppRequest(BaseModel):
    bill_ids: List[int]
    include_pdf_link: bool = True
    delay_seconds: int = 60
