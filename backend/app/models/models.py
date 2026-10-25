from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON
from datetime import datetime
import enum
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"
    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(255), unique=True, nullable=False, index=True)
    phone           = Column(String(50), default="9730526659")
    address         = Column(Text)
    notes           = Column(Text)
    opening_balance = Column(Numeric(12, 2), default=0.0)  # Previous pending balance without bill
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    bills           = relationship("Bill", back_populates="customer")
    aliases         = relationship("CustomerAlias", back_populates="customer")


class Product(Base):
    __tablename__ = "products"
    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(255), unique=True, nullable=False, index=True)
    unit           = Column(String(50), default="pcs")
    product_code   = Column(String(50))
    purchase_price = Column(Numeric(12, 2), nullable=True)  # Cost/purchase price for P&L calculation
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime, default=datetime.utcnow)


class ProductRate(Base):
    __tablename__ = "product_rates"
    id         = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True)
    rate       = Column(Numeric(12, 2), nullable=False)
    live_rate  = Column(Numeric(12, 2), nullable=True)  # Rate for live fish (circled values)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    product    = relationship("Product")


class CustomerRate(Base):
    __tablename__ = "customer_rates"
    id          = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), index=True)
    product_id  = Column(Integer, ForeignKey("products.id"), index=True)
    rate        = Column(Numeric(12, 2), nullable=False)
    live_rate   = Column(Numeric(12, 2), nullable=True)  # Custom live fish rate for customer
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = ({"sqlite_autoincrement": False},)


class RateHistory(Base):
    __tablename__ = "rate_history"
    id          = Column(Integer, primary_key=True, index=True)
    rate_type   = Column(String(20)) # base | customer
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    product_id  = Column(Integer, ForeignKey("products.id"))
    old_rate    = Column(Numeric(12, 2), nullable=True)
    new_rate    = Column(Numeric(12, 2), nullable=False)
    changed_by  = Column(String(100), default="admin")
    changed_at  = Column(DateTime, default=datetime.utcnow)



class UploadStatus(str, enum.Enum):
    uploaded     = "uploaded"
    processing   = "processing"
    needs_review = "needs_review"
    saved        = "saved"
    failed       = "failed"


class Upload(Base):
    __tablename__ = "uploads"
    id                  = Column(Integer, primary_key=True, index=True)
    upload_type         = Column(String(20), default="ledger")  # ledger | bill
    image_path          = Column(String(500))
    image_hash          = Column(String(64))
    page_date           = Column(String(20))
    status              = Column(String(20), default="uploaded")
    gemini_raw_response = Column(Text)
    draft_data          = Column(Text)  # JSON string
    excel_path          = Column(String(500))
    error_message       = Column(Text)
    created_at          = Column(DateTime, default=datetime.utcnow)
    bills               = relationship("Bill", back_populates="upload")


class Bill(Base):
    __tablename__ = "bills"
    id            = Column(Integer, primary_key=True, index=True)
    customer_id   = Column(Integer, ForeignKey("customers.id"), index=True)
    bill_no       = Column(String(50), unique=True)
    bill_date     = Column(String(20), index=True)
    total_amount   = Column(Numeric(12, 2), default=0)
    amount_paid    = Column(Numeric(12, 2), default=0)
    balance_due    = Column(Numeric(12, 2), default=0)
    payment_status = Column(String(20), default="unpaid", index=True)    # paid | partial | unpaid
    payment_method = Column(String(20), default="Cash")      # Cash | UPI | Mixed
    source         = Column(String(20), default="manual")    # manual | ledger_ai | bill_ai
    upload_id      = Column(Integer, ForeignKey("uploads.id"), nullable=True)
    image_path     = Column(String(500))
    status         = Column(String(20), default="active")
    created_at     = Column(DateTime, default=datetime.utcnow, index=True)
    customer      = relationship("Customer", back_populates="bills")
    upload        = relationship("Upload", back_populates="bills")
    items         = relationship("BillItem", back_populates="bill")
    payment_installments = relationship("PaymentInstallment", back_populates="bill", order_by="PaymentInstallment.paid_at")


class BillItem(Base):
    __tablename__ = "bill_items"
    id               = Column(Integer, primary_key=True, index=True)
    bill_id          = Column(Integer, ForeignKey("bills.id"), index=True)
    product_id       = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    quantity         = Column(Numeric(12, 3))
    rate             = Column(Numeric(12, 2))
    amount           = Column(Numeric(12, 2))
    tag              = Column(String(50))
    circled_value    = Column(String(100))
    is_live          = Column(Boolean, default=False)
    confidence       = Column(Numeric(4, 2))
    raw_text         = Column(Text)
    bill             = relationship("Bill", back_populates="items")
    product          = relationship("Product")


class PaymentInstallment(Base):
    __tablename__ = "payment_installments"
    id             = Column(Integer, primary_key=True, index=True)
    bill_id        = Column(Integer, ForeignKey("bills.id"), nullable=False, index=True)
    amount         = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(20), default="Cash")  # Cash | UPI | Mixed
    note           = Column(String(255), nullable=True)
    paid_at        = Column(DateTime, default=datetime.utcnow)
    bill           = relationship("Bill", back_populates="payment_installments")


class CustomerAlias(Base):
    __tablename__ = "customer_aliases"
    id          = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), index=True)
    alias       = Column(String(255), index=True)
    customer    = relationship("Customer", back_populates="aliases")


class ColumnMapping(Base):
    __tablename__ = "column_mappings"
    id           = Column(Integer, primary_key=True, index=True)
    column_code  = Column(String(10), unique=True)
    product_id   = Column(Integer, ForeignKey("products.id"))
    active       = Column(Boolean, default=True)


class TagDictionary(Base):
    __tablename__ = "tag_dictionary"
    id      = Column(Integer, primary_key=True, index=True)
    tag     = Column(String(20), unique=True)
    meaning = Column(String(255))


class IdempotencyRecord(Base):
    """Stores client idempotency keys and cached responses to prevent duplicate financial writes (PRD Section 6)."""
    __tablename__ = "idempotency_keys"
    key              = Column(String(255), primary_key=True, index=True)
    user_id          = Column(Integer, nullable=True, index=True)
    route            = Column(String(255), nullable=False)
    request_hash     = Column(String(64), nullable=False)
    status_code      = Column(Integer, nullable=False)
    response_headers = Column(Text, nullable=True)  # JSON-encoded headers
    response_body    = Column(Text, nullable=False)  # JSON-encoded response
    created_at       = Column(DateTime, default=datetime.utcnow, index=True)


class BackgroundJob(Base):
    """Durable background jobs for slow work: OCR scans, PDFs, exports, bulk WhatsApp (PRD Section 7)."""
    __tablename__ = "background_jobs"
    id               = Column(String(36), primary_key=True, index=True)  # UUID
    user_id          = Column(Integer, nullable=True, index=True)
    job_type         = Column(String(50), nullable=False, index=True)    # ocr | pdf | excel_report | bulk_whatsapp
    status           = Column(String(30), default="queued", index=True)  # queued | processing | needs_review | ready | completed | failed
    progress         = Column(Integer, default=0)                        # 0 to 100
    progress_message = Column(String(255), nullable=True)                # Plain language progress
    payload          = Column(Text, nullable=True)                       # JSON request parameters
    result           = Column(Text, nullable=True)                       # JSON output (draft data, file URL, stats)
    error_message    = Column(Text, nullable=True)                       # Safe error summary
    attempts         = Column(Integer, default=0)
    created_at       = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at     = Column(DateTime, nullable=True)


class AuditLog(Base):
    """Immutable audit trail for financial actions, edits, and deletions (PRD Section 9)."""
    __tablename__ = "audit_logs"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, nullable=True, index=True)
    action      = Column(String(50), nullable=False, index=True)  # create_bill | record_payment | delete_bill | edit_bill | setting_change
    entity_type = Column(String(50), nullable=False, index=True)  # bill | payment | customer | rate | setting
    entity_id   = Column(String(50), nullable=True, index=True)
    changes     = Column(Text, nullable=True)                     # JSON delta/details
    request_id  = Column(String(50), nullable=True, index=True)
    ip_address  = Column(String(50), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, index=True)


class AppSetting(Base):
    """Dynamic key-value settings for application configuration (e.g. default customer phone)."""
    __tablename__ = "app_settings"
    key         = Column(String(100), primary_key=True, index=True)
    value       = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

