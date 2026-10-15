import asyncio
import pytest
import respx
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.services.cache import cache_service

client = TestClient(app)

MOCK_TOPICS_SEARCH = {
    "results": [
        {
            "id": "https://openalex.org/T10001",
            "display_name": "Machine Learning and Neural Networks",
            "works_count": 50000,
            "subfield": {
                "id": "https://openalex.org/subfields/1702",
                "display_name": "Artificial Intelligence",
            },
            "field": {
                "id": "https://openalex.org/fields/17",
                "display_name": "Computer Science",
            },
        }
    ]
}

MOCK_SUBFIELD_TOPICS = {
    "results": [
        {
            "id": "https://openalex.org/T10001",
            "display_name": "Deep Learning and Neural Architectures",
            "works_count": 25000,
            "subfield": {
                "id": "https://openalex.org/subfields/1702",
                "display_name": "Artificial Intelligence",
            },
            "field": {
                "id": "https://openalex.org/fields/17",
                "display_name": "Computer Science",
            },
        },
        {
            "id": "https://openalex.org/T10002",
            "display_name": "Reinforcement Learning & Robotics",
            "works_count": 18000,
            "subfield": {
                "id": "https://openalex.org/subfields/1702",
                "display_name": "Artificial Intelligence",
            },
            "field": {
                "id": "https://openalex.org/fields/17",
                "display_name": "Computer Science",
            },
        },
    ]
}

MOCK_YEARLY_COUNTS_T1 = {
    "meta": {"count": 25000},
    "group_by": [
        {"key": "2021", "count": 1200},
        {"key": "2022", "count": 1500},
        {"key": "2023", "count": 2100},
        {"key": "2024", "count": 3000},
        {"key": "2025", "count": 4200},
        {"key": "2026", "count": 1800},
    ],
}

# Distinctly declining by >15% each year in the 3-year window
MOCK_YEARLY_COUNTS_T2 = {
    "meta": {"count": 18000},
    "group_by": [
        {"key": "2021", "count": 1500},
        {"key": "2022", "count": 1300},
        {"key": "2023", "count": 1000},
        {"key": "2024", "count": 800},
        {"key": "2025", "count": 600},
        {"key": "2026", "count": 200},
    ],
}


@pytest.mark.asyncio
@respx.mock
async def test_domain_analysis_job_and_endpoints():
    cache_service.clear_memory()

    # Mock OpenAlex topics endpoints
    respx.get(url__regex=r"https://api\.openalex\.org/topics\?search=.*").mock(
        return_value=httpx.Response(200, json=MOCK_TOPICS_SEARCH)
    )
    respx.get(url__regex=r"https://api\.openalex\.org/topics\?filter=subfield.*").mock(
        return_value=httpx.Response(200, json=MOCK_SUBFIELD_TOPICS)
    )
    respx.get(url__regex=r"https://api\.openalex\.org/works\?.*T10001.*").mock(
        return_value=httpx.Response(200, json=MOCK_YEARLY_COUNTS_T1)
    )
    respx.get(url__regex=r"https://api\.openalex\.org/works\?.*T10002.*").mock(
        return_value=httpx.Response(200, json=MOCK_YEARLY_COUNTS_T2)
    )
    respx.get(url__regex=r"https://api\.openalex\.org/works.*").mock(
        return_value=httpx.Response(200, json={"meta": {"count": 0}, "results": []})
    )
    respx.get(url__regex=r"https://api\.semanticscholar\.org/.*").mock(
        return_value=httpx.Response(200, json={"data": []})
    )
    respx.get(url__regex=r"https://export\.arxiv\.org/.*").mock(
        return_value=httpx.Response(200, text="<feed></feed>")
    )

    # 1. Test suggest endpoint
    sug_res = client.get("/api/domains/suggest?q=Machine")
    assert sug_res.status_code == 200
    sug_data = sug_res.json()
    assert sug_data["success"] is True
    assert len(sug_data["data"]) >= 1

    # 2. Trigger analysis
    start_res = client.post("/api/domains/analyze", json={"domain": "Machine Learning"})
    assert start_res.status_code == 200
    job_info = start_res.json()["data"]
    job_id = job_info["job_id"]
    domain_id = job_info["domain_id"]
    assert domain_id == "machine-learning"

    # 3. Poll job until completion (wait max 5 seconds)
    for _ in range(35):
        await asyncio.sleep(0.1)
        poll_res = client.get(f"/api/jobs/{job_id}")
        assert poll_res.status_code == 200
        poll_data = poll_res.json()["data"]
        if poll_data["status"] == "completed":
            break
    assert poll_data["status"] == "completed"
    assert poll_data["progress"] == 100

    # 4. Check domain overview
    overview_res = client.get(f"/api/domains/{domain_id}/overview")
    assert overview_res.status_code == 200
    ov_data = overview_res.json()["data"]
    assert ov_data["domain_id"] == "machine-learning"
    assert ov_data["total_papers"] > 0
    assert len(ov_data["sub_areas"]) >= 2

    # T10001 had rapid growth -> Emerging
    t1_area = next(s for s in ov_data["sub_areas"] if s["topic_id"] == "T10001")
    assert t1_area["label"] == "Emerging"
    assert t1_area["gbar"] >= 0.25

    # T10002 had declining growth -> Declining
    t2_area = next(s for s in ov_data["sub_areas"] if s["topic_id"] == "T10002")
    assert t2_area["label"] == "Declining"
    assert t2_area["gbar"] <= -0.10

    # 5. Check domain trends
    trends_res = client.get(f"/api/domains/{domain_id}/trends")
    assert trends_res.status_code == 200
    trends_data = trends_res.json()["data"]["trends"]
    assert len(trends_data) >= 2
    assert trends_data[0]["yearly_counts"]
