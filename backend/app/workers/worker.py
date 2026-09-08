"""ARQ worker settings. Run with: arq app.workers.worker.WorkerSettings"""

from arq.connections import RedisSettings

from app.config import get_settings
from app.logging_conf import configure_logging
from app.workers.tasks import process_document, run_eval

configure_logging()

settings = get_settings()


class WorkerSettings:
    functions = [process_document, run_eval]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 4
    job_timeout = 900  # eval runs with several LLM calls can take a while
