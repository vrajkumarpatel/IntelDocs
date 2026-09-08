"""Chunking of extracted document text into ~300-500 token pieces, with page
tracking and a small overlap between consecutive chunks.

Token counting here is an approximation: we treat whitespace-delimited words
as tokens. This avoids pulling in a tokenizer tied to a specific model and is
within ~20-30% of real BPE token counts for English prose, which is fine for
sizing retrieval chunks. This approximation is intentional and documented
rather than silently assumed.
"""

from dataclasses import dataclass


@dataclass
class PageText:
    page_number: int
    text: str


@dataclass
class ChunkOut:
    page_number: int
    chunk_index: int
    text: str


def _word_count(text: str) -> int:
    return len(text.split())


def chunk_pages(
    pages: list[PageText],
    min_tokens: int = 300,
    max_tokens: int = 500,
    overlap_tokens: int = 50,
) -> list[ChunkOut]:
    """Greedily pack words from each page into chunks of roughly
    ``min_tokens``-``max_tokens`` words, carrying ``overlap_tokens`` words of
    context from the tail of one chunk into the start of the next chunk *on
    the same page*. Chunks never span pages, so a chunk's page_number is
    always unambiguous.
    """
    if max_tokens <= 0 or min_tokens < 0 or min_tokens > max_tokens:
        raise ValueError("invalid chunk token bounds")

    chunks: list[ChunkOut] = []
    chunk_index = 0

    for page in pages:
        words = page.text.split()
        if not words:
            continue

        start = 0
        n = len(words)
        while start < n:
            end = min(start + max_tokens, n)
            piece_words = words[start:end]

            # If this leaves a tiny orphan tail behind (< min_tokens) that
            # would become its own chunk, merge it into the current one
            # instead — but only if doing so still respects max_tokens.
            # Otherwise, leave the orphan as its own (possibly sub-min) chunk
            # rather than violate the max bound.
            remaining = n - end
            if 0 < remaining < min_tokens and (end - start) + remaining <= max_tokens:
                end = n
                piece_words = words[start:end]

            chunks.append(
                ChunkOut(
                    page_number=page.page_number,
                    chunk_index=chunk_index,
                    text=" ".join(piece_words),
                )
            )
            chunk_index += 1

            if end >= n:
                break
            start = max(end - overlap_tokens, start + 1)

    return chunks


def chunk_text_single_page(text: str, page_number: int = 1, **kwargs) -> list[ChunkOut]:
    return chunk_pages([PageText(page_number=page_number, text=text)], **kwargs)
