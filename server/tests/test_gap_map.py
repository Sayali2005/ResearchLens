import pytest
import respx
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.domain import Domain, TopicInfo
from app.services.cache import cache_service
from app.services.domain_service import domain_service
from app.services.gap_service import gap_service


client = TestClient(app)


def test_gap_opportunity_math():
    # Setup test matrix calculation logic
    # Assume 2 rows, 2 cols
    # Row 1 (High pop), Row 2 (Low pop)
    # Col 1 (High pop), Col 2 (Low pop)
    # Observed:
    # R1: C1=10, C2=190 -> row_total = 200
    # R2: C1=90, C2=10 -> row_total = 100
    # col_totals: C1=100, C2=200, grand_total = 300
    # Expected for (R1, C1): 200 * 100 / 300 = 66.67
    # Observed is 10, so ratio = 10 / 66.67 = 0.15
    # R1 and C1 are popular (high percentile), but observed is very low -> strong gap candidate!
    obs = 10
    exp = 200 * 100 / 300
    ratio = obs / exp
    p_row = 1.0  # high pop
    p_col = 0.5
    opp = min(p_row, p_col) * (1.0 - min(1.0, ratio))

    assert ratio < 0.2
    assert opp > 0.4


def test_config_applications_endpoint():
    res = client.get("/api/config/applications")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) >= 10
    app_ids = [a["id"] for a in data]
    assert "healthcare" in app_ids
    assert "agriculture" in app_ids
    assert "finance" in app_ids
    assert "cybersecurity" in app_ids


@pytest.mark.asyncio
@respx.mock
async def test_domain_gaps_endpoint():
    cache_service.clear_memory()
    from app.services.gap_service import LOCAL_CACHE_DIR
    test_cache = LOCAL_CACHE_DIR / "test-ai-domain_gaps_agriculture-healthcare.json"
    if test_cache.exists():
        test_cache.unlink()

    # Register mock domain in domain_service
    domain_id = "test-ai-domain"
    domain_service._memory_domains[domain_id] = Domain(
        domain_id=domain_id,
        name="Test AI Domain",
        topics=[
            TopicInfo(topic_id="T_CV", name="Computer Vision"),
            TopicInfo(topic_id="T_NLP", name="Natural Language Processing"),
        ],
        total_papers=10000,
    )


    # Mock OpenAlex title_and_abstract count calls
    respx.get(url__regex=r"https://api\.openalex\.org/works\?.*T_CV.*healthcare.*").mock(
        return_value=httpx.Response(200, json={"meta": {"count": 150}})
    )
    respx.get(url__regex=r"https://api\.openalex\.org/works\?.*T_CV.*agriculture.*").mock(
        return_value=httpx.Response(200, json={"meta": {"count": 5}})  # Candidate gap!
    )
    respx.get(url__regex=r"https://api\.openalex\.org/works\?.*T_NLP.*healthcare.*").mock(
        return_value=httpx.Response(200, json={"meta": {"count": 80}})
    )
    respx.get(url__regex=r"https://api\.openalex\.org/works\?.*T_NLP.*agriculture.*").mock(
        return_value=httpx.Response(200, json={"meta": {"count": 20}})
    )

    # Default fallback mock for other apps
    respx.get(url__regex=r"https://api\.openalex\.org/works\?.*").mock(
        return_value=httpx.Response(200, json={"meta": {"count": 10}})
    )

    # Call /api/domains/{id}/gaps filtering by healthcare,agriculture
    res = client.get(f"/api/domains/{domain_id}/gaps?apps=healthcare,agriculture")
    assert res.status_code == 200
    payload = res.json()["data"]

    assert payload["domain_id"] == domain_id
    assert len(payload["sub_areas"]) == 2
    assert len(payload["applications"]) == 2
    assert len(payload["cells"]) == 4

    # Check that cells have expected, ratio, opportunity
    sample_cell = payload["cells"][0]
    assert "observed" in sample_cell
    assert "expected" in sample_cell
    assert "ratio" in sample_cell
    assert "opportunity" in sample_cell

    # Candidate gap cell for T_CV + agriculture should have low ratio
    cv_agri = next(c for c in payload["cells"] if c["topic_id"] == "T_CV" and c["application_id"] == "agriculture")
    assert cv_agri["observed"] == 5
    assert cv_agri["ratio"] < 0.5
