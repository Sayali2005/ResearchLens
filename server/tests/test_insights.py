import json
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.domain import Domain, TopicInfo
from app.schemas.paper import Paper
from app.services.challenge_service import challenge_service
from app.services.domain_service import domain_service
from app.services.gap_service import gap_service
from app.services.method_service import method_service
from app.services.suggestion_service import suggestion_service


@pytest.fixture
def mock_insight_domain(tmp_path, monkeypatch):
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

    domain_id = "test_vision"
    domain = Domain(
        domain_id=domain_id,
        name="Computer Vision",
        field_or_subfield_id="fields/17",
        topic_ids=["T_OD", "T_IS"],
        topics=[
            TopicInfo(
                topic_id="T_OD",
                name="Object Detection",
                works_count=45000,
            ),
            TopicInfo(
                topic_id="T_IS",
                name="Image Segmentation",
                works_count=32000,
            ),
        ],
        updated_at="2026-10-13T10:00:00Z",
    )
    domain_service._memory_domains[domain_id] = domain

    # Create synthetic papers
    papers = [
        Paper(
            id="p_survey",
            title="A Comprehensive Survey on Deep Learning for Object Detection",
            abstract=(
                "Object detection has witnessed unprecedented progress with deep learning. "
                "In this survey, we review Convolutional Neural Network architectures and Vision Transformer advances. "
                "We benchmark on ImageNet and MS COCO datasets. "
                "A major open challenge in this field remains scaling to real-world edge devices with low latency. "
                "Furthermore, future research should explore robustness under out-of-distribution adversarial conditions."
            ),
            year=2024,
            venue="IEEE Transactions on Pattern Analysis and Machine Intelligence",
            citation_count=450,
            type="review",
            is_open_access=True,
            landing_url="https://doi.org/10.1109/tpami.survey",
        ),
        Paper(
            id="p_yolo_agri",
            title="Real-Time Crop Disease Detection Using YOLOv8 in Agriculture",
            abstract=(
                "Detecting crop diseases early is critical for food security and agriculture. "
                "We present a modified YOLOv8 model evaluated on the PlantVillage dataset. "
                "The proposed framework uses attention mechanisms and achieves high precision. "
                "However, the system is limited by lack of standardized real-world field annotations under varying weather."
            ),
            year=2024,
            venue="Computers and Electronics in Agriculture",
            citation_count=85,
            type="article",
            is_open_access=True,
            landing_url="https://doi.org/10.1016/j.compag.2024",
        ),
        Paper(
            id="p_resnet_seminal",
            title="Deep Residual Learning for Image Recognition",
            abstract=(
                "Deeper neural networks are more difficult to train. We present a residual learning framework "
                "using ResNet skip connections. Evaluated extensively on the ImageNet classification benchmark. "
                "Future work involves applying residual representations to other vision tasks."
            ),
            year=2016,
            venue="CVPR",
            citation_count=120000,
            type="article",
            is_open_access=True,
            landing_url="https://doi.org/10.1109/cvpr.2016",
        ),
        Paper(
            id="p_bert_nlp",
            title="Pre-training of Deep Bidirectional Transformers for Language Understanding",
            abstract=(
                "We introduce BERT, which obtains state-of-the-art results on eleven natural language tasks. "
                "BERT relies on the Transformer architecture. Evaluated on GLUE and SQuAD benchmarks."
            ),
            year=2019,
            venue="NAACL",
            citation_count=85000,
            type="article",
            is_open_access=True,
            landing_url="https://doi.org/10.18653/v1/n19-1423",
        ),
    ]

    papers_file = test_cache_dir / f"{domain_id}_papers.json"
    with open(papers_file, "w", encoding="utf-8") as f:
        json.dump([p.model_dump() for p in papers], f, default=str)

    return domain_id


def test_methods_and_datasets_extraction(mock_insight_domain):
    domain_id = mock_insight_domain
    resp = method_service.analyze_domain_methods(domain_id)

    assert resp is not None
    assert resp.domain_id == domain_id
    assert resp.total_papers_analyzed == 4

    # Check detected methods
    method_ids = {m.id for m in resp.methods}
    assert "cnn" in method_ids or "vit" in method_ids
    assert "yolo" in method_ids
    assert "resnet" in method_ids

    yolo_item = next(m for m in resp.methods if m.id == "yolo")
    assert yolo_item.count == 1
    assert "p_yolo_agri" in yolo_item.example_paper_ids

    # Check detected datasets
    dataset_ids = {d.id for d in resp.datasets}
    assert "imagenet" in dataset_ids
    assert "coco" in dataset_ids
    assert "plantvillage" in dataset_ids

    pv_item = next(d for d in resp.datasets if d.id == "plantvillage")
    assert pv_item.count == 1
    assert "p_yolo_agri" in pv_item.example_paper_ids

    # Check TF-IDF keywords
    assert len(resp.keywords) > 0
    keyword_terms = [k.term.lower() for k in resp.keywords]
    assert any("object detection" in t or "detection" in t or "disease" in t for t in keyword_terms)

    # Check yearly trends
    assert len(resp.trends) > 0


def test_challenges_extraction_and_ranking(mock_insight_domain):
    domain_id = mock_insight_domain
    resp = challenge_service.extract_domain_challenges(domain_id)

    assert resp is not None
    assert resp.domain_id == domain_id
    assert resp.total_challenges >= 2

    # Verify that challenge sentences are properly matched and highlighted
    found_edge_challenge = False
    found_agri_limitation = False

    for item in resp.challenges:
        assert "<strong>" in item.highlighted_sentence
        assert item.source_paper is not None
        assert item.score > 0

        if "edge devices" in item.sentence:
            found_edge_challenge = True
            assert item.source_paper.is_review is True
            assert item.category in ("Real-World Deployment", "Scalability & Efficiency")

        if "limited by lack of" in item.sentence or "PlantVillage" in item.sentence:
            found_agri_limitation = True
            assert item.category == "Data Scarcity & Quality"

    assert found_edge_challenge, "Edge device challenge should be detected"
    assert found_agri_limitation, "Agricultural limitation should be detected"


@pytest.mark.asyncio
async def test_suggestions_and_roadmap(mock_insight_domain):
    domain_id = mock_insight_domain
    resp = await suggestion_service.generate_suggestions_and_roadmap(domain_id)

    assert resp is not None
    assert resp.domain_id == domain_id
    assert "Gaps are candidates" in resp.disclaimer

    # Verify roadmap structure (3 stages)
    assert len(resp.roadmap) == 3
    stage_titles = [s.title for s in resp.roadmap]
    assert "Foundational Surveys & Landscape" in stage_titles[0]
    assert "Milestone & Foundational Works" in stage_titles[1]
    assert "State-of-the-Art & Recent Advances" in stage_titles[2]

    # Check Stage 1 has the survey paper
    stage_1 = resp.roadmap[0]
    assert any(p.id == "p_survey" for p in stage_1.papers)

    # Check Stage 2 has the seminal paper (ResNet)
    stage_2 = resp.roadmap[1]
    assert any(p.id == "p_resnet_seminal" for p in stage_2.papers)


@pytest.mark.asyncio
async def test_insights_api_endpoints(mock_insight_domain):
    domain_id = mock_insight_domain
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test /methods
        res_m = await client.get(f"/api/domains/{domain_id}/methods")
        assert res_m.status_code == 200
        json_m = res_m.json()
        assert json_m["success"] is True
        assert "methods" in json_m["data"]
        assert "datasets" in json_m["data"]
        assert "keywords" in json_m["data"]

        # 2. Test /challenges
        res_c = await client.get(f"/api/domains/{domain_id}/challenges")
        assert res_c.status_code == 200
        json_c = res_c.json()
        assert json_c["success"] is True
        assert "challenges" in json_c["data"]
        assert json_c["data"]["total_challenges"] > 0

        # 3. Test /suggestions
        res_s = await client.get(f"/api/domains/{domain_id}/suggestions")
        assert res_s.status_code == 200
        json_s = res_s.json()
        assert json_s["success"] is True
        assert "suggestions" in json_s["data"]
        assert "roadmap" in json_s["data"]
        assert len(json_s["data"]["roadmap"]) == 3
