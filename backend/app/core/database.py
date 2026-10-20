from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import get_settings

settings = get_settings()

# SQLite needs check_same_thread=False for FastAPI async
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

# SQLAlchemy 2.x maps bare "postgresql://" to the psycopg3 driver.
# We only have psycopg2-binary installed, so force the correct dialect.
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgres://"):
    # Render sometimes provides postgres:// (Heroku-style)
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)

if "sqlite" in db_url:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        echo=(settings.APP_ENV == "development"),
    )
else:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        echo=(settings.APP_ENV == "development"),
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,      # Tests connection before using from pool (prevents stale socket errors)
        pool_recycle=300,        # Recycles idle connections every 5 mins (avoids Render drops)
        pool_timeout=30,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
