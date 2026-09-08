import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.logging_conf import configure_logging
from app.queue import close_arq_pool
from app.routers import admin, auth, compare, documents, eval, health, query, summarize

configure_logging()
logger = logging.getLogger("inteldocs.api")

app = FastAPI(title="IntelDocs API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(query.router)
app.include_router(summarize.router)
app.include_router(compare.router)
app.include_router(eval.router)
app.include_router(admin.router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak stack traces to the client; log server-side with full detail.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.on_event("shutdown")
async def shutdown():
    await close_arq_pool()
