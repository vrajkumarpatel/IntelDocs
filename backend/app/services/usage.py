from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Document, QueryLog


def compute_usage(db: Session, org_id: int) -> dict:
    settings = get_settings()

    total_documents = db.scalar(select(func.count()).select_from(Document).where(Document.org_id == org_id)) or 0
    total_queries = db.scalar(select(func.count()).select_from(QueryLog).where(QueryLog.org_id == org_id)) or 0
    total_prompt_tokens = db.scalar(
        select(func.coalesce(func.sum(QueryLog.prompt_tokens), 0)).where(QueryLog.org_id == org_id)
    ) or 0
    total_completion_tokens = db.scalar(
        select(func.coalesce(func.sum(QueryLog.completion_tokens), 0)).where(QueryLog.org_id == org_id)
    ) or 0

    def cost(prompt_tokens: int, completion_tokens: int) -> float:
        return (
            prompt_tokens / 1000 * settings.groq_cost_per_1k_prompt_tokens
            + completion_tokens / 1000 * settings.groq_cost_per_1k_completion_tokens
        )

    docs_by_day: dict[str, int] = defaultdict(int)
    for created_at in db.scalars(select(Document.created_at).where(Document.org_id == org_id)):
        docs_by_day[created_at.date().isoformat()] += 1

    queries_by_day: dict[str, dict] = defaultdict(lambda: {"count": 0, "prompt": 0, "completion": 0})
    for created_at, p, c in db.execute(
        select(QueryLog.created_at, QueryLog.prompt_tokens, QueryLog.completion_tokens).where(QueryLog.org_id == org_id)
    ):
        day = created_at.date().isoformat()
        queries_by_day[day]["count"] += 1
        queries_by_day[day]["prompt"] += p
        queries_by_day[day]["completion"] += c

    all_days = sorted(set(docs_by_day) | set(queries_by_day))
    by_day = []
    for day in all_days:
        q = queries_by_day.get(day, {"count": 0, "prompt": 0, "completion": 0})
        by_day.append(
            {
                "day": day,
                "documents_processed": docs_by_day.get(day, 0),
                "queries_run": q["count"],
                "prompt_tokens": q["prompt"],
                "completion_tokens": q["completion"],
                "estimated_cost_usd": round(cost(q["prompt"], q["completion"]), 6),
            }
        )

    return {
        "total_documents": total_documents,
        "total_queries": total_queries,
        "total_prompt_tokens": total_prompt_tokens,
        "total_completion_tokens": total_completion_tokens,
        "total_estimated_cost_usd": round(cost(total_prompt_tokens, total_completion_tokens), 6),
        "by_day": by_day,
    }
