import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Document, DocumentStatus, User
from app.queue import get_arq_pool
from app.schemas import DocumentDetailOut, DocumentListOut, DocumentOut, DocumentVersionsOut

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/tiff",
}


def _save_upload(org_id: int, filename: str, content: bytes) -> str:
    settings = get_settings()
    org_dir = os.path.join(settings.storage_dir, str(org_id))
    os.makedirs(org_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    path = os.path.join(org_dir, unique_name)
    with open(path, "wb") as f:
        f.write(content)
    return path


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    content_type = file.content_type or "application/octet-stream"
    storage_path = _save_upload(user.org_id, file.filename or "upload", content)

    document = Document(
        org_id=user.org_id,
        filename=file.filename or "upload",
        content_type=content_type,
        status=DocumentStatus.processing.value,
        version=1,
        uploaded_by=user.id,
        storage_path=storage_path,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    pool = await get_arq_pool()
    await pool.enqueue_job("process_document", document.id)

    return document


@router.get("", response_model=DocumentListOut)
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Document).filter(Document.org_id == user.org_id).order_by(Document.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return DocumentListOut(items=items, total=total, page=page, page_size=page_size)


def _get_org_document_or_404(db: Session, document_id: int, org_id: int) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.get("/{document_id}", response_model=DocumentDetailOut)
def get_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_org_document_or_404(db, document_id, user.org_id)


@router.post("/{document_id}/reupload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def reupload_document(
    document_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    parent = _get_org_document_or_404(db, document_id, user.org_id)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    content_type = file.content_type or "application/octet-stream"
    storage_path = _save_upload(user.org_id, file.filename or "upload", content)

    # Walk to the root of the version chain so version numbers keep
    # incrementing regardless of which version was reuploaded against.
    root_id = parent.id
    latest_version = parent.version
    node = parent
    while node.parent_document_id is not None:
        node = db.get(Document, node.parent_document_id)
        root_id = node.id
    # Find max version across the whole chain.
    chain = db.query(Document).filter(
        (Document.id == root_id) | (Document.parent_document_id == root_id)
    ).all()
    latest_version = max((d.version for d in chain), default=parent.version)

    new_document = Document(
        org_id=user.org_id,
        filename=file.filename or "upload",
        content_type=content_type,
        status=DocumentStatus.processing.value,
        version=latest_version + 1,
        parent_document_id=root_id,
        uploaded_by=user.id,
        storage_path=storage_path,
    )
    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    pool = await get_arq_pool()
    await pool.enqueue_job("process_document", new_document.id)

    return new_document


@router.get("/{document_id}/versions", response_model=DocumentVersionsOut)
def get_versions(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = _get_org_document_or_404(db, document_id, user.org_id)
    root_id = document.parent_document_id or document.id
    chain = (
        db.query(Document)
        .filter((Document.id == root_id) | (Document.parent_document_id == root_id))
        .order_by(Document.version.asc())
        .all()
    )
    return DocumentVersionsOut(items=chain)
