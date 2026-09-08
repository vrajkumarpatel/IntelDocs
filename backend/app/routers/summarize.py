from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Chunk, Document, DocumentStatus, DocumentSummary, User
from app.schemas import DocumentSummaryOut
from app.services.llm import LLMUnavailableError
from app.services.summarization import summarize_document

router = APIRouter(prefix="/api/v1/documents", tags=["summarize"])


def _reconstruct_full_text(db: Session, document_id: int) -> str:
    chunks = (
        db.query(Chunk)
        .filter(Chunk.document_id == document_id)
        .order_by(Chunk.page_number.asc(), Chunk.chunk_index.asc())
        .all()
    )
    return "\n".join(c.text for c in chunks)


@router.post("/{document_id}/summarize", response_model=DocumentSummaryOut)
def summarize(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = db.get(Document, document_id)
    if document is None or document.org_id != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document.status != DocumentStatus.ready.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Document is not ready (status={document.status})")

    existing = db.query(DocumentSummary).filter(DocumentSummary.document_id == document_id).first()
    if existing is not None:
        return existing

    full_text = _reconstruct_full_text(db, document_id)
    if not full_text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document has no extracted text to summarize")

    try:
        result = summarize_document(full_text)
    except LLMUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    summary = DocumentSummary(
        document_id=document_id,
        summary_text=result["summary_text"],
        key_clauses=result["key_clauses"],
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary
