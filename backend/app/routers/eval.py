from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Document, DocumentStatus, EvalRun, User
from app.queue import get_arq_pool
from app.schemas import EvalRunDetailOut, EvalRunListOut, EvalRunOut, EvalRunRequest
from app.services.retrieval import RETRIEVAL_CONFIGS

router = APIRouter(prefix="/api/v1/eval", tags=["eval"])


@router.post("/runs", response_model=EvalRunOut, status_code=status.HTTP_202_ACCEPTED)
async def create_eval_run(payload: EvalRunRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.retrieval_config not in RETRIEVAL_CONFIGS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"retrieval_config must be one of {RETRIEVAL_CONFIGS}")
    if payload.num_questions_per_doc < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="num_questions_per_doc must be >= 1")
    if not payload.document_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="document_ids must be non-empty")

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

    eval_run = EvalRun(
        org_id=user.org_id,
        retrieval_config=payload.retrieval_config,
        document_ids=payload.document_ids,
        num_questions=payload.num_questions_per_doc,  # placeholder until the job fills in the real count
    )
    db.add(eval_run)
    db.commit()
    db.refresh(eval_run)

    pool = await get_arq_pool()
    await pool.enqueue_job("run_eval", eval_run.id)

    return eval_run


@router.get("/runs", response_model=EvalRunListOut)
def list_eval_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(EvalRun).filter(EvalRun.org_id == user.org_id).order_by(EvalRun.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return EvalRunListOut(items=items, total=total, page=page, page_size=page_size)


@router.get("/runs/{eval_run_id}", response_model=EvalRunDetailOut)
def get_eval_run(eval_run_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    eval_run = db.get(EvalRun, eval_run_id)
    if eval_run is None or eval_run.org_id != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eval run not found")
    return eval_run
