from app.schemas.paper import Author, Institution, Paper
from app.services.deduplication import (
    deduplicate_papers,
    merge_paper,
    normalize_arxiv_id,
    normalize_doi,
    normalize_title,
)


def test_normalize_helpers():
    assert normalize_doi("https://doi.org/10.1145/12345.6789") == "10.1145/12345.6789"
    assert normalize_doi("doi: 10.1000/182") == "10.1000/182"
    assert normalize_arxiv_id("http://arxiv.org/abs/2104.12345v2") == "2104.12345"
    assert normalize_arxiv_id("arxiv:2104.12345") == "2104.12345"
    assert normalize_title("Attention Is All You Need!") == "attention is all you need"


def test_deduplicate_by_doi():
    p1 = Paper(
        id="s2:1",
        doi="10.1000/test",
        title="Deep Residual Learning",
        abstract=None,
        citation_count=100,
        source="semantic_scholar",
    )
    p2 = Paper(
        id="openalex:2",
        doi="https://doi.org/10.1000/TEST",
        title="Deep Residual Learning for Image Recognition",
        abstract="Deep residual networks are easier to optimize...",
        citation_count=150,
        is_open_access=True,
        source="openalex",
    )

    results = deduplicate_papers([p1, p2])
    assert len(results) == 1
    merged = results[0]
    assert merged.doi == "10.1000/test"
    assert merged.citation_count == 150
    assert "easier to optimize" in merged.abstract
    assert merged.is_open_access is True
    assert "openalex" in merged.source
    assert "semantic_scholar" in merged.source


def test_deduplicate_by_arxiv_id():
    p1 = Paper(
        id="arxiv:1706.03762",
        arxiv_id="1706.03762v5",
        title="Attention Is All You Need",
        abstract="The dominant sequence transduction models...",
        source="arxiv",
    )
    p2 = Paper(
        id="s2:transformer",
        arxiv_id="1706.03762",
        title="Attention Is All You Need",
        citation_count=90000,
        source="semantic_scholar",
    )

    results = deduplicate_papers([p1, p2])
    assert len(results) == 1
    merged = results[0]
    assert merged.arxiv_id == "1706.03762"
    assert merged.citation_count == 90000
    assert "dominant sequence" in merged.abstract


def test_deduplicate_by_title_and_year():
    p1 = Paper(
        id="p1",
        title="BERT: Pre-training of Deep Bidirectional Transformers",
        year=2019,
        source="s2",
    )
    p2 = Paper(
        id="p2",
        title="BERT: Pre-training of Deep Bidirectional Transformers!",
        year=2019,
        source="openalex",
        citation_count=50000,
    )

    results = deduplicate_papers([p1, p2])
    assert len(results) == 1
    assert results[0].citation_count == 50000


def test_merge_authors_and_institutions():
    a1 = Author(name="Yann LeCun", institutions=[Institution(name="NYU", ror="https://ror.org/nyu")])
    a2 = Author(name="Yann LeCun", institutions=[Institution(name="Meta AI", ror="https://ror.org/meta")])

    p1 = Paper(id="1", title="Title A", authors=[a1], source="s1")
    p2 = Paper(id="2", title="Title A", authors=[a2], source="s2")

    merged = merge_paper(p1, p2)
    assert len(merged.authors) == 1
    assert len(merged.authors[0].institutions) == 2
