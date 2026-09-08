from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Document, QueryLog, User
from app.schemas import QueryLogListOut, QueryLogOut, QueryRequest, QueryResponse
from app.services.llm import LLMUnavailableError
from app.services.qa import answer_question
from app.services.retrieval import RETRIEVAL_CONFIGS

router = APIRouter(prefix="/api/v1", tags=["query"])


@router.post("/query", response_model=QueryResponse)
def query(payload: QueryRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.retrieval_config not in RETRIEVAL_CONFIGS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"retrieval_config must be one of {RETRIEVAL_CONFIGS}")

    if payload.document_ids:
        count = (
            db.query(Document)
            .filter(Document.id.in_(payload.document_ids), Document.org_id == user.org_id)
            .count()
        )
        if count != len(set(payload.document_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more document_ids not found")

    try:
        result = answer_question(db, user.org_id, payload.question, payload.document_ids, payload.retrieval_config)
    except LLMUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    log = QueryLog(
        org_id=user.org_id,
        user_id=user.id,
        question=payload.question,
        answer=result.answer,
        citations=result.citations,
        retrieval_config=payload.retrieval_config,
        model_used=result.model_used,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        latency_ms=result.latency_ms,
    )
    db.add(log)
    db.commit()

    return QueryResponse(
        answer=result.answer,
        citations=result.citations,
        confidence=result.confidence,
        model_used=result.model_used,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        latency_ms=result.latency_ms,
        retrieval_config=payload.retrieval_config,
    )


@router.get("/queries", response_model=QueryLogListOut)
def list_queries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(QueryLog).filter(QueryLog.org_id == user.org_id).order_by(QueryLog.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return QueryLogListOut(items=items, total=total, page=page, page_size=page_size)
