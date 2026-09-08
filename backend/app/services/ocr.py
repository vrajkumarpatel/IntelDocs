"""Document text extraction: native-PDF text via PyMuPDF where available,
falling back to Tesseract OCR (via pdf2image rasterization) for pages that
have no extractable text layer (scanned pages), plus a direct-image OCR path
for image uploads (png/jpg/tiff).
"""

import io
import logging

import fitz  # PyMuPDF
import pytesseract
from PIL import Image

from app.config import get_settings
from app.services.chunking import PageText

logger = logging.getLogger("inteldocs.ocr")

# Minimum characters of native text on a page before we trust it and skip OCR.
NATIVE_TEXT_MIN_CHARS = 20


def _configure_tesseract() -> None:
    settings = get_settings()
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def extract_pages_from_pdf(file_bytes: bytes) -> tuple[list[PageText], bool]:
    """Returns (pages, used_ocr). Tries native text extraction per page via
    PyMuPDF; for any page with too little native text, rasterizes that page
    and OCRs it with Tesseract. `used_ocr` is True if any page needed OCR.
    """
    _configure_tesseract()
    pages: list[PageText] = []
    used_ocr = False

    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for i, page in enumerate(doc):
            native_text = page.get_text("text").strip()
            if len(native_text) >= NATIVE_TEXT_MIN_CHARS:
                pages.append(PageText(page_number=i + 1, text=native_text))
                continue

            # Scanned page: rasterize at 200 DPI and OCR it.
            used_ocr = True
            try:
                pix = page.get_pixmap(dpi=200)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                ocr_text = pytesseract.image_to_string(img)
            except Exception:
                logger.exception("OCR failed for page %s", i + 1)
                ocr_text = ""
            pages.append(PageText(page_number=i + 1, text=ocr_text.strip()))

    return pages, used_ocr


def extract_pages_from_image(file_bytes: bytes) -> tuple[list[PageText], bool]:
    _configure_tesseract()
    img = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(img)
    return [PageText(page_number=1, text=text.strip())], True


def extract_pages(file_bytes: bytes, content_type: str) -> tuple[list[PageText], bool]:
    if content_type == "application/pdf" or content_type.endswith("/pdf"):
        return extract_pages_from_pdf(file_bytes)
    if content_type.startswith("image/"):
        return extract_pages_from_image(file_bytes)
    # Fall back: treat as plain text.
    return [PageText(page_number=1, text=file_bytes.decode("utf-8", errors="ignore"))], False
