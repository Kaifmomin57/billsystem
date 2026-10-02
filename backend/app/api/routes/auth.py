from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


from fastapi import Request

@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    username = ""
    password = ""
    if "application/json" in content_type:
        body = await request.json()
        username = body.get("username", "")
        password = body.get("password", "")
    else:
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/setup", status_code=201)
def setup_admin(username: str, password: str, db: Session = Depends(get_db)):
    """One-time admin creation endpoint. Disable after first use in production."""
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="Admin already exists")
    user = User(username=username, password_hash=get_password_hash(password))
    db.add(user)
    db.commit()
    return {"message": f"Admin '{username}' created successfully"}
