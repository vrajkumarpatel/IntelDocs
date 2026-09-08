from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import User
from app.schemas import UsageOut
from app.services.usage import compute_usage

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/usage", response_model=UsageOut)
def usage(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return compute_usage(db, user.org_id)
