import pytest

from app.services.chunking import PageText, chunk_pages, chunk_text_single_page


def make_words(n: int, prefix: str = "word") -> str:
    return " ".join(f"{prefix}{i}" for i in range(n))


def test_single_short_page_becomes_one_chunk():
    text = make_words(100)
    chunks = chunk_pages([PageText(page_number=1, text=text)], min_tokens=300, max_tokens=500, overlap_tokens=50)
    assert len(chunks) == 1
    assert chunks[0].page_number == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].text.split() == text.split()


def test_long_page_splits_into_multiple_chunks_within_bounds():
    text = make_words(1200)
    chunks = chunk_pages([PageText(page_number=1, text=text)], min_tokens=300, max_tokens=500, overlap_tokens=50)
    assert len(chunks) > 1
    for c in chunks:
        word_count = len(c.text.split())
        assert word_count <= 500
        # Every chunk should carry a meaningful amount of text (allowing the
        # final short-tail merge to exceed max slightly, but not near-empty).
        assert word_count >= 20


def test_chunks_never_span_pages():
    pages = [
        PageText(page_number=1, text=make_words(600, "p1w")),
        PageText(page_number=2, text=make_words(600, "p2w")),
    ]
    chunks = chunk_pages(pages, min_tokens=300, max_tokens=500, overlap_tokens=50)
    page1_chunks = [c for c in chunks if c.page_number == 1]
    page2_chunks = [c for c in chunks if c.page_number == 2]
    assert page1_chunks and page2_chunks
    for c in page1_chunks:
        assert "p2w" not in c.text
    for c in page2_chunks:
        assert "p1w" not in c.text


def test_consecutive_chunks_on_same_page_overlap():
    text = make_words(900)
    chunks = chunk_pages([PageText(page_number=1, text=text)], min_tokens=300, max_tokens=500, overlap_tokens=50)
    assert len(chunks) >= 2
    first_words = chunks[0].text.split()
    second_words = chunks[1].text.split()
    overlap = set(first_words[-50:]) & set(second_words[:50])
    assert len(overlap) > 0


def test_chunk_index_is_sequential_and_global_across_pages():
    pages = [
        PageText(page_number=1, text=make_words(600, "p1w")),
        PageText(page_number=2, text=make_words(200, "p2w")),
    ]
    chunks = chunk_pages(pages, min_tokens=300, max_tokens=500, overlap_tokens=50)
    indices = [c.chunk_index for c in chunks]
    assert indices == list(range(len(chunks)))


def test_empty_page_produces_no_chunks():
    chunks = chunk_pages([PageText(page_number=1, text="   ")])
    assert chunks == []


def test_invalid_bounds_raise():
    with pytest.raises(ValueError):
        chunk_pages([PageText(page_number=1, text="a b c")], min_tokens=500, max_tokens=300)


def test_single_page_helper():
    chunks = chunk_text_single_page(make_words(50), page_number=3)
    assert len(chunks) == 1
    assert chunks[0].page_number == 3
