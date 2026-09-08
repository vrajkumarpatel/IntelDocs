from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Organization, Role, User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    org = Organization(name=payload.org_name)
    db.add(org)
    db.flush()  # get org.id without committing yet

    user = User(
        org_id=org.id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=Role.admin.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "org_id": user.org_id, "role": user.role})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "org_id": user.org_id, "role": user.role})
    return TokenResponse(access_token=token)
