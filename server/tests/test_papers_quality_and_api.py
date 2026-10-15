import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.paper import Author, Institution, Paper
from app.services.paper_service import extract_limitation_callout, paper_service
from app.services.quality_service import quality_service

client = TestClient(app)


def test_quality_scoring_tier1_group_a():
    paper = Paper(
        id="test_p1",
        title="Attention Mechanisms in Deep Neural Nets",
        venue="NeurIPS (Neural Information Processing Systems)",
        year=2021,
        citation_count=120,
        authors=[
            Author(
                name="John Doe",
                institutions=[
                    Institution(name="Stanford University", ror="https://ror.org/00cvxb145")
                ],
            )
        ],
        source="test",
    )

    eval_data = quality_service.evaluate_paper(paper)
    assert eval_data["venue_tier"] == "tier_1"
    assert eval_data["venue_score"] == 1.0
    assert eval_data["institution_group"] == "group_a"
    assert eval_data["institution_score"] == 1.0
    assert eval_data["citation_score"] > 0.5
    assert eval_data["quality_score"] > 0.75
    assert eval_data["is_top_venue"] is True
    assert eval_data["is_top_institution"] is True


def test_quality_scoring_recent_paper_recency_boost():
    # Paper from 2025/2026 should use recent formulation with recency boost
    paper = Paper(
        id="test_recent",
        title="Novel Generative Architectures",
        venue="ICLR",
        year=2025,
        citation_count=2,  # Few citations because it is very new
        authors=[
            Author(
                name="DeepMind Researcher",
                institutions=[Institution(name="Google DeepMind")],
            )
        ],
        source="test",
    )

    eval_data = quality_service.evaluate_paper(paper)
    assert eval_data["is_recent"] is True
    assert eval_data["institution_group"] == "group_c"
    # Even with only 2 citations, quality score remains high due to top venue + top lab + recency boost
    assert eval_data["quality_score"] > 0.85


def test_quality_scoring_group_b_indian_institutions():
    paper = Paper(
        id="test_iit",
        title="Efficient Deep Architectures",
        venue="Pattern Recognition",
        year=2022,
        citation_count=40,
        authors=[
            Author(
                name="Rajesh Sharma",
                institutions=[Institution(name="IIT Bombay")],
            )
        ],
        source="test",
    )

    eval_data = quality_service.evaluate_paper(paper)
    assert eval_data["institution_group"] == "group_b"
    assert eval_data["institution_score"] == 0.90
    assert eval_data["is_top_institution"] is True


def test_extract_limitation_callout():
    abstract = (
        "We introduce a new framework for federated learning. "
        "However, our approach remains challenging in heterogeneous network environments. "
        "Future work will investigate scalability."
    )
    callout = extract_limitation_callout(abstract)
    assert callout is not None
    assert "remains challenging" in callout["matched_phrase"].lower()
    assert "<strong>" in callout["highlighted_sentence"]


@pytest.mark.asyncio
async def test_domain_papers_and_detail_endpoints():
    # Add mock papers to paper_service
    p1 = Paper(
        id="p_high_qual",
        title="High Quality Deep Learning Paper",
        abstract="While effective, this method is limited by computational requirements.",
        venue="CVPR",
        year=2023,
        citation_count=300,
        authors=[Author(name="Alice", institutions=[Institution(name="MIT")])],
        is_open_access=True,
        type="article",
        source="test",
    )
    p2 = Paper(
        id="p_preprint",
        title="Preprint on Neural Search",
        abstract="A preliminary study on neural graph search.",
        venue="arXiv",
        year=2024,
        citation_count=5,
        authors=[Author(name="Bob", institutions=[])],
        is_open_access=True,
        type="preprint",
        source="arxiv",
    )

    from app.services.domain_service import domain_service
    from app.schemas.domain import Domain, TopicInfo
    domain_id = "test-paper-domain"
    domain_service._memory_domains[domain_id] = Domain(
        domain_id=domain_id,
        name="Test Paper Domain",
        topics=[TopicInfo(topic_id="T1", name="AI")],
    )

    # Save directly into paper cache file for this domain
    from app.services.paper_service import LOCAL_CACHE_DIR
    import json
    LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOCAL_CACHE_DIR / f"{domain_id}_papers.json", "w", encoding="utf-8") as f:
        json.dump([p1.model_dump(), p2.model_dump()], f, default=str)

    # 1. Fetch domain papers
    res = client.get(f"/api/domains/{domain_id}/papers?sort=quality")
    assert res.status_code == 200
    papers_data = res.json()["data"]["papers"]
    assert len(papers_data) == 2
    assert papers_data[0]["id"] == "p_high_qual"
    assert papers_data[0]["quality"]["quality_score"] > papers_data[1]["quality"]["quality_score"]
    assert papers_data[0]["limitation_callout"] is not None

    # 2. Test filter by venue_tier
    res_tier = client.get(f"/api/domains/{domain_id}/papers?venue_tier=tier_1")
    assert res_tier.status_code == 200
    assert len(res_tier.json()["data"]["papers"]) == 1
    assert res_tier.json()["data"]["papers"][0]["id"] == "p_high_qual"

    # 3. Test filter by paper type
    res_type = client.get(f"/api/domains/{domain_id}/papers?type=preprint")
    assert res_type.status_code == 200
    assert len(res_type.json()["data"]["papers"]) == 1
    assert res_type.json()["data"]["papers"][0]["id"] == "p_preprint"

    # 4. Test paper detail endpoint
    res_detail = client.get("/api/papers/p_high_qual")
    assert res_detail.status_code == 200
    detail = res_detail.json()["data"]
    assert detail["title"] == "High Quality Deep Learning Paper"
    assert detail["quality"]["venue_tier"] == "tier_1"
    assert detail["limitation_callout"]["matched_phrase"] == "limited by"
