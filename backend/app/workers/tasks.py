"""ARQ task functions. Each task opens its own DB session (arq workers run
tasks concurrently in one process, so sessions must not be shared)."""

import logging

from app.database import SessionLocal
from app.models import Chunk, Document, DocumentStatus, EvalQuestion, EvalRun, EvalRunStatus
from app.services.chunking import PageText, chunk_pages
from app.services.embeddings import embed_texts
from app.services.eval_service import (
    aggregate_metrics,
    evaluate_one_question,
    faithfulness_rate,
    generate_question,
    sample_chunks_for_eval,
)
from app.services.llm import LLMUnavailableError
from app.services.ocr import extract_pages

logger = logging.getLogger("inteldocs.worker")


async def process_document(ctx, document_id: int) -> dict:
    """Ingestion pipeline: read stored file bytes -> extract text (native or
    OCR) -> chunk -> embed -> store chunks -> mark document ready/failed."""
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            logger.error("process_document: document %s not found", document_id)
            return {"ok": False, "error": "document not found"}

        try:
            with open(document.storage_path, "rb") as f:
                file_bytes = f.read()

            pages, used_ocr = extract_pages(file_bytes, document.content_type)
            page_texts = [PageText(page_number=p.page_number, text=p.text) for p in pages]
            chunks = chunk_pages(page_texts)

            if not chunks:
                raise ValueError("No extractable text found in document (empty or unreadable file)")

            embeddings = embed_texts([c.text for c in chunks])

            for chunk, embedding in zip(chunks, embeddings):
                db.add(
                    Chunk(
                        document_id=document.id,
                        page_number=chunk.page_number,
                        chunk_index=chunk.chunk_index,
                        text=chunk.text,
                        embedding=embedding,
                    )
                )

            document.page_count = len(pages)
            document.status = DocumentStatus.ready.value
            document.error_message = None
            db.commit()
            logger.info(
                "document %s processed: %d pages, %d chunks, ocr_used=%s",
                document_id,
                len(pages),
                len(chunks),
                used_ocr,
            )
            return {"ok": True, "chunks": len(chunks), "used_ocr": used_ocr}
        except Exception as exc:
            logger.exception("process_document failed for %s", document_id)
            document.status = DocumentStatus.failed.value
            document.error_message = str(exc)[:2000]
            db.commit()
            return {"ok": False, "error": str(exc)}
    finally:
        db.close()


async def run_eval(ctx, eval_run_id: int) -> dict:
    """Eval pipeline: sample real chunks -> generate real questions ->
    run real retrieval + answer pipelines -> LLM-judge faithfulness ->
    aggregate real hit-rate/MRR/faithfulness numbers into the EvalRun."""
    db = SessionLocal()
    try:
        eval_run = db.get(EvalRun, eval_run_id)
        if eval_run is None:
            logger.error("run_eval: eval_run %s not found", eval_run_id)
            return {"ok": False, "error": "eval_run not found"}

        try:
            document_ids = list(eval_run.document_ids)
            num_per_doc = eval_run.num_questions
            sampled_chunks = sample_chunks_for_eval(db, document_ids, num_per_doc)

            if not sampled_chunks:
                raise ValueError("No chunks available to generate eval questions from (documents not ready?)")

            hits: list[bool] = []
            ranks: list[int | None] = []
            verdicts: list[str] = []
            latencies: list[int] = []

            for chunk in sampled_chunks:
                question = generate_question(chunk.text)
                if not question:
                    continue
                result = evaluate_one_question(
                    db,
                    eval_run.org_id,
                    chunk.id,
                    question,
                    document_ids,
                    eval_run.retrieval_config,
                )
                db.add(
                    EvalQuestion(
                        eval_run_id=eval_run.id,
                        source_chunk_id=result["source_chunk_id"],
                        question=result["question"],
                        retrieved_chunk_ids=result["retrieved_chunk_ids"],
                        hit=result["hit"],
                        rank=result["rank"],
                        generated_answer=result["generated_answer"],
                        faithfulness_verdict=result["faithfulness_verdict"],
                        faithfulness_reasoning=result["faithfulness_reasoning"],
                    )
                )
                hits.append(result["hit"])
                ranks.append(result["rank"])
                verdicts.append(result["faithfulness_verdict"])
                latencies.append(result["latency_ms"])

            if not hits:
                raise ValueError("No eval questions were successfully generated/evaluated")

            hit_rate, mrr = aggregate_metrics(hits, ranks)
            eval_run.retrieval_hit_rate = hit_rate
            eval_run.retrieval_mrr = mrr
            eval_run.answer_faithfulness_rate = faithfulness_rate(verdicts)
            eval_run.avg_latency_ms = sum(latencies) / len(latencies)
            eval_run.num_questions = len(hits)
            eval_run.status = EvalRunStatus.completed.value
            db.commit()
            return {"ok": True, "num_questions": len(hits), "hit_rate": hit_rate, "mrr": mrr}
        except LLMUnavailableError as exc:
            db.rollback()
            eval_run.status = EvalRunStatus.failed.value
            eval_run.error_message = str(exc)
            db.commit()
            return {"ok": False, "error": str(exc)}
        except Exception as exc:
            db.rollback()
            logger.exception("run_eval failed for %s", eval_run_id)
            eval_run.status = EvalRunStatus.failed.value
            eval_run.error_message = str(exc)[:2000]
            db.commit()
            return {"ok": False, "error": str(exc)}
    finally:
        db.close()
