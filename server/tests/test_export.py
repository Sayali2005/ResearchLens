import json
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.domain import Domain, TopicInfo
from app.services.domain_service import domain_service


@pytest.fixture
def mock_export_domain(tmp_path, monkeypatch):
    test_cache_dir = tmp_path / "domains"
    test_cache_dir.mkdir(parents=True, exist_ok=True)

    from app.services import challenge_service as cs_module
    from app.services import gap_service as gs_module
    from app.services import method_service as ms_module
    from app.services import paper_service as ps_module
    from app.services import suggestion_service as ss_module

    monkeypatch.setattr(ms_module, "LOCAL_CACHE_DIR", test_cache_dir)
    monkeypatch.setattr(cs_module, "LOCAL_CACHE_DIR", test_cache_dir)
    monkeypatch.setattr(ss_module, "LOCAL_CACHE_DIR", test_cache_dir)
    monkeypatch.setattr(ps_module, "LOCAL_CACHE_DIR", test_cache_dir)
    monkeypatch.setattr(gs_module, "LOCAL_CACHE_DIR", test_cache_dir)

    domain_id = "test_export_nlp"
    domain = Domain(
        domain_id=domain_id,
        name="Natural Language Processing",
        field_or_subfield_id="fields/17",
        topic_ids=["T_LLM"],
        topics=[
            TopicInfo(
                topic_id="T_LLM",
                name="Large Language Models",
                works_count=25000,
            ),
        ],
        updated_at="2026-10-13T10:00:00Z",
    )
    domain_service._memory_domains[domain_id] = domain

    # Mock paper in cache
    papers = [
        {
            "id": "p_nlp_1",
            "title": "Attention Is All You Need",
            "abstract": "The dominant sequence models are based on complex recurrent or convolutional neural networks. We propose the Transformer.",
            "year": 2017,
            "venue": "NeurIPS",
            "citation_count": 95000,
            "type": "article",
            "is_open_access": True,
            "doi": "10.5555/3295222.3295349",
            "landing_url": "https://arxiv.org/abs/1706.03762",
            "authors": [{"name": "Ashish Vaswani"}],
            "quality": {
                "quality_score": 0.95,
                "venue_tier": "tier_1",
                "institution_group": "group_a",
                "is_top_venue": True,
                "is_top_institution": True,
            },
        }
    ]

    papers_file = test_cache_dir / f"{domain_id}_papers.json"
    with open(papers_file, "w", encoding="utf-8") as f:
        json.dump(papers, f)

    return domain_id


@pytest.mark.asyncio
async def test_export_domain_json_endpoint(mock_export_domain):
    domain_id = mock_export_domain
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(f"/api/export/{domain_id}.json")
        assert res.status_code == 200
        assert "application/json" in res.headers["content-type"]
        assert f"researchlens_{domain_id}_dossier.json" in res.headers["content-disposition"]

        data = res.json()
        assert "export_metadata" in data
        assert data["export_metadata"]["domain_id"] == domain_id
        assert "generator" in data["export_metadata"]
        assert "sample_papers" in data


@pytest.mark.asyncio
async def test_export_domain_csv_endpoint(mock_export_domain):
    domain_id = mock_export_domain
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(f"/api/export/{domain_id}.csv")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert f"researchlens_{domain_id}_papers.csv" in res.headers["content-disposition"]

        csv_text = res.text
        assert "Paper ID,Title,Year,Venue,Citations" in csv_text
        assert "Attention Is All You Need" in csv_text


@pytest.mark.asyncio
async def test_export_domain_not_found():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/export/non_existent_domain_999.json")
        assert res.status_code == 404
