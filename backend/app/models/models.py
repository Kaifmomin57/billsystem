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
    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(255), unique=True, nullable=False, index=True)
    phone      = Column(String(50))
    address    = Column(Text)
    notes      = Column(Text)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    bills      = relationship("Bill", back_populates="customer")
    aliases    = relationship("CustomerAlias", back_populates="customer")


class Product(Base):
    __tablename__ = "products"
    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String(255), unique=True, nullable=False, index=True)
    unit      = Column(String(50), default="pcs")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProductRate(Base):
    __tablename__ = "product_rates"
    id         = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True)
    rate       = Column(Numeric(12, 2), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    product    = relationship("Product")


class CustomerRate(Base):
    __tablename__ = "customer_rates"
    id          = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    product_id  = Column(Integer, ForeignKey("products.id"))
    rate        = Column(Numeric(12, 2), nullable=False)
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
    customer_id   = Column(Integer, ForeignKey("customers.id"))
    bill_no       = Column(String(50), unique=True)
    bill_date     = Column(String(20), index=True)
    total_amount   = Column(Numeric(12, 2), default=0)
    amount_paid    = Column(Numeric(12, 2), default=0)
    balance_due    = Column(Numeric(12, 2), default=0)
    payment_status = Column(String(20), default="unpaid")    # paid | partial | unpaid
    payment_method = Column(String(20), default="Cash")      # Cash | UPI | Mixed
    source         = Column(String(20), default="manual")    # manual | ledger_ai | bill_ai
    upload_id      = Column(Integer, ForeignKey("uploads.id"), nullable=True)
    image_path     = Column(String(500))
    status         = Column(String(20), default="active")
    created_at     = Column(DateTime, default=datetime.utcnow)
    customer      = relationship("Customer", back_populates="bills")
    upload        = relationship("Upload", back_populates="bills")
    items         = relationship("BillItem", back_populates="bill")
    payment_installments = relationship("PaymentInstallment", back_populates="bill", order_by="PaymentInstallment.paid_at")


class BillItem(Base):
    __tablename__ = "bill_items"
    id               = Column(Integer, primary_key=True, index=True)
    bill_id          = Column(Integer, ForeignKey("bills.id"))
    product_id       = Column(Integer, ForeignKey("products.id"), nullable=True)
    quantity         = Column(Numeric(12, 3))
    rate             = Column(Numeric(12, 2))
    amount           = Column(Numeric(12, 2))
    tag              = Column(String(50))
    circled_value    = Column(String(100))
    confidence       = Column(Numeric(4, 2))
    raw_text         = Column(Text)
    bill             = relationship("Bill", back_populates="items")
    product          = relationship("Product")


class PaymentInstallment(Base):
    __tablename__ = "payment_installments"
    id             = Column(Integer, primary_key=True, index=True)
    bill_id        = Column(Integer, ForeignKey("bills.id"), nullable=False)
    amount         = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(20), default="Cash")  # Cash | UPI | Mixed
    note           = Column(String(255), nullable=True)
    paid_at        = Column(DateTime, default=datetime.utcnow)
    bill           = relationship("Bill", back_populates="payment_installments")


class CustomerAlias(Base):
    __tablename__ = "customer_aliases"
    id          = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
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
