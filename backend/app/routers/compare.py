from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import ComparisonResult, Document, DocumentStatus, User
from app.routers.summarize import _reconstruct_full_text
from app.schemas import CompareRequest, ComparisonResultOut
from app.services.comparison import compare_documents
from app.services.llm import LLMUnavailableError

router = APIRouter(prefix="/api/v1/compare", tags=["compare"])


@router.post("", response_model=ComparisonResultOut)
def compare(payload: CompareRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    documents = (
        db.query(Document)
        .filter(Document.id.in_(payload.document_ids), Document.org_id == user.org_id)
        .all()
    )
    if len(documents) != len(set(payload.document_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more document_ids not found")

    not_ready = [d.id for d in documents if d.status != DocumentStatus.ready.value]
    if not_ready:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Documents not ready: {not_ready}")

    by_id = {d.id: d for d in documents}
    labeled_texts = []
    for doc_id in payload.document_ids:
        doc = by_id[doc_id]
        text = _reconstruct_full_text(db, doc_id)
        labeled_texts.append((f"Document {doc_id} ({doc.filename})", text))

    try:
        result = compare_documents(labeled_texts)
    except LLMUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    comparison = ComparisonResult(
        org_id=user.org_id,
        document_ids=payload.document_ids,
        comparison_text=result["comparison_text"],
        differences=result["differences"],
    )
    db.add(comparison)
    db.commit()
    db.refresh(comparison)
    return comparison
