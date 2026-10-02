import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.models import User, Product, ProductRate, ColumnMapping, TagDictionary, Customer

# Import routers
from app.api.routes import auth, customers, products, rates, bills, uploads, settings as settings_route, reports, stats

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="Smart Ledger & Billing Management with Gemini AI Extraction",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for images
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.UPLOAD_DIR), name="media")

# Include API routers
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(products.router)
app.include_router(rates.router)
app.include_router(bills.router)
app.include_router(uploads.router)
app.include_router(settings_route.router)
app.include_router(reports.router)
app.include_router(stats.router)


@app.on_event("startup")
def on_startup():
    # Create all DB tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed default admin user
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                password_hash=get_password_hash("admin123")
            )
            db.add(admin)
            
        # 2. Seed default products and column mappings if empty
        if db.query(Product).count() == 0:
            default_prods = [
                ("M (Milk / Malai)", "kg", 60.0, "M"),
                ("R (Rabdi / Rasgulla)", "kg", 240.0, "R"),
                ("B (Butter / Barfi)", "kg", 450.0, "B"),
                ("P (Paneer)", "kg", 320.0, "P"),
                ("K (Khoya / Khowa)", "kg", 280.0, "K"),
                ("T (Toned / Tea Milk)", "litre", 52.0, "T"),
                ("JB (Gulab Jamun / Jalebi)", "kg", 220.0, "JB")
            ]
            for p_name, unit, base_rate, code in default_prods:
                prod = Product(name=p_name, unit=unit, is_active=True)
                db.add(prod)
                db.flush()
                
                # Base rate
                pr = ProductRate(product_id=prod.id, rate=base_rate)
                db.add(pr)
                
                # Column mapping
                cm = ColumnMapping(column_code=code, product_id=prod.id, active=True)
                db.add(cm)

        # 3. Seed default tag dictionary
        if db.query(TagDictionary).count() == 0:
            default_tags = [
                ("pd", "Paid / Cash Received"),
                ("mi", "Minus / Deduction"),
                ("N", "New Account / Entry"),
                ("B", "Balance Carried Forward"),
                ("R", "Returned Goods"),
                ("k", "Kharab / Spoiled / Replaced")
            ]
            for tag, meaning in default_tags:
                t = TagDictionary(tag=tag, meaning=meaning)
                db.add(t)

        # 4. Seed sample customers if empty
        if db.query(Customer).count() == 0:
            sample_custs = [
                ("Ramvir Sweets", "9876543210", "Main Bazaar, Shop 12"),
                ("Sharma Dairy", "9812345678", "Sector 4"),
                ("Vaishali Sweets", "9823456789", "Station Road"),
                ("Gupta Caterers", "9834567890", "Civil Lines"),
                ("Radhe Shyam Dairy", "9845678901", "Old City")
            ]
            for c_name, phone, addr in sample_custs:
                c = Customer(name=c_name, phone=phone, address=addr, is_active=True)
                db.add(c)

        db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "docs_url": "/docs"
    }
