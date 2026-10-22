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

from fastapi.middleware.gzip import GZipMiddleware
from datetime import datetime, timezone

# CORS
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()
origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = [
        frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*" if settings.APP_ENV == "development" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression (compresses responses over 1KB, speeding up API downloads over network)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount uploads directory for images
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.UPLOAD_DIR), name="media")

# Keep-alive & Health Check endpoint (ultra lightweight, no DB query)
@app.get("/health", tags=["system"])
@app.get("/", tags=["system"])
def health_check():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

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


def _run_schema_migrations():
    """
    Idempotent startup migrations for columns added to SQLAlchemy models
    after the PostgreSQL table was first created.

    ALTER TABLE ... ADD COLUMN IF NOT EXISTS  is safe to re-run every restart.
    For SQLite the IF NOT EXISTS syntax on ADD COLUMN requires v3.35+; we
    guard older versions with a pragma check.
    """
    import logging
    from sqlalchemy import text

    log = logging.getLogger(__name__)

    migrations = [
        {
            # Fixes: sqlalchemy.exc.ProgrammingError: column products.product_code does not exist
            "pg": "ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);",
            "sqlite_check": (
                "SELECT COUNT(*) FROM pragma_table_info('products') "
                "WHERE name='product_code';"
            ),
            "sqlite_add": "ALTER TABLE products ADD COLUMN product_code VARCHAR(50);",
            "description": "Add product_code to products table",
        },
        {
            "pg": "ALTER TABLE product_rates ADD COLUMN IF NOT EXISTS live_rate NUMERIC(12, 2);",
            "sqlite_check": (
                "SELECT COUNT(*) FROM pragma_table_info('product_rates') "
                "WHERE name='live_rate';"
            ),
            "sqlite_add": "ALTER TABLE product_rates ADD COLUMN live_rate NUMERIC(12, 2);",
            "description": "Add live_rate to product_rates table",
        },
        {
            "pg": "ALTER TABLE customer_rates ADD COLUMN IF NOT EXISTS live_rate NUMERIC(12, 2);",
            "sqlite_check": (
                "SELECT COUNT(*) FROM pragma_table_info('customer_rates') "
                "WHERE name='live_rate';"
            ),
            "sqlite_add": "ALTER TABLE customer_rates ADD COLUMN live_rate NUMERIC(12, 2);",
            "description": "Add live_rate to customer_rates table",
        },
        {
            "pg": "ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;",
            "sqlite_check": (
                "SELECT COUNT(*) FROM pragma_table_info('bill_items') "
                "WHERE name='is_live';"
            ),
            "sqlite_add": "ALTER TABLE bill_items ADD COLUMN is_live BOOLEAN DEFAULT 0;",
            "description": "Add is_live to bill_items table",
        },
        {
            "pg": "ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) DEFAULT 0;",
            "sqlite_check": (
                "SELECT COUNT(*) FROM pragma_table_info('customers') "
                "WHERE name='opening_balance';"
            ),
            "sqlite_add": "ALTER TABLE customers ADD COLUMN opening_balance NUMERIC(12, 2) DEFAULT 0;",
            "description": "Add opening_balance to customers table",
        },
    ]

    is_sqlite = "sqlite" in str(engine.url)

    with engine.connect() as conn:
        for m in migrations:
            try:
                if is_sqlite:
                    count = conn.execute(text(m["sqlite_check"])).scalar()
                    if count == 0:
                        conn.execute(text(m["sqlite_add"]))
                        conn.commit()
                        log.info("Migration applied: %s", m["description"])
                else:
                    conn.execute(text(m["pg"]))
                    conn.commit()
                    log.info("Migration applied (or already existed): %s", m["description"])
            except Exception as exc:
                log.warning("Schema migration warning [%s]: %s", m["description"], exc)

        # Performance indexes for fast querying on Render PostgreSQL / SQLite
        indexes = [
            ("idx_bills_customer_id", "CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);"),
            ("idx_bills_payment_status", "CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);"),
            ("idx_bills_cust_unpaid", "CREATE INDEX IF NOT EXISTS idx_bills_cust_unpaid ON bills(customer_id, payment_status, balance_due);"),
            ("idx_bills_bill_date", "CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date);"),
            ("idx_bills_created_at", "CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);"),
            ("idx_bill_items_bill_id", "CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);"),
            ("idx_bill_items_product_id", "CREATE INDEX IF NOT EXISTS idx_bill_items_product_id ON bill_items(product_id);"),
            ("idx_payment_installments_bill_id", "CREATE INDEX IF NOT EXISTS idx_payment_installments_bill_id ON payment_installments(bill_id);"),
            ("idx_customer_rates_customer_id", "CREATE INDEX IF NOT EXISTS idx_customer_rates_customer_id ON customer_rates(customer_id);"),
            ("idx_customer_rates_product_id", "CREATE INDEX IF NOT EXISTS idx_customer_rates_product_id ON customer_rates(product_id);"),
        ]
        for idx_name, idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
                conn.commit()
            except Exception as exc:
                log.warning("Index creation warning [%s]: %s", idx_name, exc)


@app.on_event("startup")
def on_startup():
    # ── 1. Apply any pending schema migrations BEFORE create_all ─────────
    _run_schema_migrations()

    # Create all DB tables (new tables only; existing tables are not altered)
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
