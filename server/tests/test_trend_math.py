from app.services.trend_service import trend_service


def test_emerging_trend_classification():
    # Rapid growth over last 3 years, last year >= 30
    counts = {
        2020: 50,
        2021: 60,
        2022: 70,
        2023: 100,
        2024: 150,
        2025: 220,
        2026: 90,  # Current partial year should be excluded from growth maths
    }
    trend = trend_service.compute_topic_trend(
        topic_id="T1",
        topic_name="Generative Diffusion Models",
        yearly_counts_raw=counts,
        years_range=5,
        window_size=3,
    )

    assert trend.topic_id == "T1"
    assert trend.label == "Emerging"
    assert trend.gbar >= 0.25
    assert trend.last_complete_year_count == 220


def test_declining_trend_classification():
    # Decreasing papers over last 3 years
    counts = {
        2020: 300,
        2021: 280,
        2022: 250,
        2023: 200,
        2024: 160,
        2025: 120,
        2026: 40,
    }
    trend = trend_service.compute_topic_trend(
        topic_id="T2",
        topic_name="Legacy Feature Engineering",
        yearly_counts_raw=counts,
        years_range=5,
        window_size=3,
    )

    assert trend.topic_id == "T2"
    assert trend.label == "Declining"
    assert trend.gbar <= -0.10


def test_stable_trend_classification():
    # Moderate / plateaued paper growth
    counts = {
        2020: 100,
        2021: 105,
        2022: 102,
        2023: 108,
        2024: 110,
        2025: 112,
        2026: 50,
    }
    trend = trend_service.compute_topic_trend(
        topic_id="T3",
        topic_name="Support Vector Machines",
        yearly_counts_raw=counts,
        years_range=5,
        window_size=3,
    )

    assert trend.topic_id == "T3"
    assert trend.label == "Stable"
    assert -0.10 < trend.gbar < 0.25


def test_low_volume_emerging_stays_stable():
    # High percentage growth but count < 30 (to prevent noise being labeled Emerging)
    counts = {
        2022: 2,
        2023: 4,
        2024: 8,
        2025: 16,
    }
    trend = trend_service.compute_topic_trend(
        topic_id="T4",
        topic_name="Niche Topic",
        yearly_counts_raw=counts,
        years_range=4,
        window_size=3,
    )

    # Even though gbar > 0.5, last count is 16 (< 30), so remains Stable
    assert trend.label == "Stable"
