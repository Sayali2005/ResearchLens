import pytest
import respx
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.services.cache import cache_service
from app.services.paper_service import paper_service

client = TestClient(app)

MOCK_OPENALEX_RESPONSE = {
    "meta": {"count": 1, "db_response_time_ms": 12},
    "results": [
        {
            "id": "https://openalex.org/W12345",
            "doi": "https://doi.org/10.1145/123.456",
            "title": "A Survey on Deep Learning",
            "publication_year": 2023,
            "publication_date": "2023-01-15",
            "type": "review",
            "cited_by_count": 250,
            "abstract_inverted_index": {
                "Deep": [0],
                "learning": [1],
                "has": [2],
                "transformed": [3],
                "AI.": [4],
            },
            "primary_location": {
                "source": {"display_name": "ACM Computing Surveys", "type": "journal"},
                "landing_page_url": "https://dl.acm.org/doi/10.1145/123.456",
                "pdf_url": "https://dl.acm.org/pdf/10.1145/123.456",
                "is_oa": True,
            },
            "open_access": {"is_oa": True, "oa_url": "https://dl.acm.org/pdf/10.1145/123.456"},
            "authorships": [
                {
                    "author": {"id": "https://openalex.org/A1", "display_name": "Alice Smith"},
                    "institutions": [
                        {
                            "id": "https://openalex.org/I1",
                            "display_name": "Stanford University",
                            "ror": "https://ror.org/stanford",
                            "country_code": "US",
                        }
                    ],
                }
            ],
            "topics": [{"display_name": "Deep Learning"}],
        }
    ],
}

MOCK_S2_RESPONSE = {
    "total": 1,
    "data": [
        {
            "paperId": "s2_987",
            "externalIds": {"DOI": "10.1145/123.456", "ArXiv": "2301.00001"},
            "title": "A Survey on Deep Learning in AI",
            "abstract": "Deep learning has transformed AI extensively across domains.",
            "year": 2023,
            "citationCount": 260,
            "influentialCitationCount": 45,
            "venue": "ACM CSUR",
            "url": "https://www.semanticscholar.org/paper/s2_987",
            "isOpenAccess": True,
            "openAccessPdf": {"url": "https://example.com/s2_paper.pdf"},
            "authors": [{"authorId": "s2_a1", "name": "Alice Smith"}],
            "publicationTypes": ["Review"],
        }
    ],
}

MOCK_ARXIV_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00001v2</id>
    <title>A Survey on Deep Learning Preprints</title>
    <summary>Deep learning has transformed AI preprints.</summary>
    <published>2023-01-10T00:00:00Z</published>
    <author>
      <name>Alice Smith</name>
    </author>
    <link title="pdf" href="https://arxiv.org/pdf/2301.00001.pdf" type="application/pdf"/>
    <arxiv:primary_category term="cs.AI"/>
    <arxiv:doi>10.1145/123.456</arxiv:doi>
  </entry>
</feed>
"""


@pytest.mark.asyncio
@respx.mock
async def test_paper_service_search_and_cache():
    cache_service.clear_memory()

    # Mock external endpoints
    openalex_route = respx.get(url__regex=r"https://api\.openalex\.org/works.*").mock(
        return_value=httpx.Response(200, json=MOCK_OPENALEX_RESPONSE)
    )
    s2_route = respx.get(url__regex=r"https://api\.semanticscholar\.org/graph/v1/paper/search.*").mock(
        return_value=httpx.Response(200, json=MOCK_S2_RESPONSE)
    )
    arxiv_route = respx.get(url__regex=r"https://export\.arxiv\.org/api/query.*").mock(
        return_value=httpx.Response(200, text=MOCK_ARXIV_XML)
    )

    query = "Deep Learning Survey"

    # First call: hits external APIs and populates cache
    papers = await paper_service.search_papers(query=query, limit=10)

    assert openalex_route.call_count == 1
    assert s2_route.call_count == 1
    assert arxiv_route.call_count == 1

    # All 3 sources provided the same paper with DOI 10.1145/123.456
    # Deduplication should collapse them into 1 normalized paper!
    assert len(papers) == 1
    p = papers[0]
    assert p.doi == "10.1145/123.456"
    assert p.arxiv_id == "2301.00001"
    # Merged citation count should be max(250, 260) = 260
    assert p.citation_count == 260
    assert p.influential_citation_count == 45
    assert p.type == "review"
    assert p.is_open_access is True
    assert p.authors[0].institutions[0].name == "Stanford University"

    # Second call: MUST be served from cache with ZERO new HTTP calls
    cached_papers = await paper_service.search_papers(query=query, limit=10)
    assert len(cached_papers) == 1
    assert cached_papers[0].doi == "10.1145/123.456"

    # Confirm no additional calls were made to upstream APIs!
    assert openalex_route.call_count == 1
    assert s2_route.call_count == 1
    assert arxiv_route.call_count == 1


@respx.mock
def test_api_papers_search_endpoint():
    cache_service.clear_memory()

    respx.get(url__regex=r"https://api\.openalex\.org/works.*").mock(
        return_value=httpx.Response(200, json=MOCK_OPENALEX_RESPONSE)
    )
    respx.get(url__regex=r"https://api\.semanticscholar\.org/graph/v1/paper/search.*").mock(
        return_value=httpx.Response(200, json=MOCK_S2_RESPONSE)
    )
    respx.get(url__regex=r"https://export\.arxiv\.org/api/query.*").mock(
        return_value=httpx.Response(200, text=MOCK_ARXIV_XML)
    )

    response = client.get("/api/papers/search?query=Deep+Learning&limit=5")
    assert response.status_code == 200
    json_data = response.json()

    assert json_data["success"] is True
    assert json_data["count"] >= 1
    assert "papers" in json_data
    assert "data" in json_data
    assert "meta" in json_data
    first_paper = json_data["data"]["papers"][0]
    assert first_paper["doi"] == "10.1145/123.456"
