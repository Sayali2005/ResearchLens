from fastapi.testclient import TestClient
from app.main import app
from app.config.settings import settings

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "ResearchLens" in data["message"]

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["healthy", "unhealthy"]

def test_settings_loaded():
    assert settings.APP_NAME == "ResearchLens AI"
    assert settings.FRONTEND_URL.startswith("http")
    assert settings.CACHE_TTL_COUNTS_DAYS >= 1
