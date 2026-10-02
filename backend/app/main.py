import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.models import User, TagDictionary

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
        # ── Seed admin user ONLY if no users exist ────────────────────────
        if db.query(User).count() == 0:
            admin = User(
                username="mohsinmomin",
                password_hash=get_password_hash("KFC@2026")
            )
            db.add(admin)

        # ── Seed tag dictionary ONLY if empty ─────────────────────────────
        if db.query(TagDictionary).count() == 0:
            default_tags = [
                ("pd", "Paid / Cash Received"),
                ("mi", "Minus / Deduction"),
                ("N",  "New Account / Entry"),
                ("B",  "Balance Carried Forward"),
                ("R",  "Returned Goods"),
                ("k",  "Kharab / Spoiled / Replaced")
            ]
            for tag, meaning in default_tags:
                db.add(TagDictionary(tag=tag, meaning=meaning))

        # NOTE: Products and Customers are NOT seeded here.
        # Manage them through the UI to avoid overwriting production data.

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
