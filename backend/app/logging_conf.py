import logging
import sys

from app.config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
        stream=sys.stdout,
        force=True,
    )
    # Quiet noisy third-party loggers.
    for noisy in ("httpx", "sentence_transformers", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


logger = logging.getLogger("inteldocs")
