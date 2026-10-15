import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Response

from app.services.challenge_service import challenge_service
from app.services.domain_service import domain_service
from app.services.gap_service import gap_service
from app.services.method_service import method_service
from app.services.paper_service import paper_service
from app.services.suggestion_service import suggestion_service

router = APIRouter(
    prefix="/api/export",
    tags=["Export"],
)


@router.get("/{id}.json")
async def export_domain_json(id: str):
    """Generates a complete, comprehensive research dossier for a domain in JSON format."""
    domain = domain_service.get_domain(id)
    if not domain:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )

    overview = domain_service.get_domain_overview(id)
    trends = domain_service.get_domain_trends(id)
    gap_matrix = await gap_service.compute_gap_matrix(id)
    methods = method_service.analyze_domain_methods(id)
    challenges = challenge_service.extract_domain_challenges(id)
    suggestions = await suggestion_service.generate_suggestions_and_roadmap(id)
    papers_data = await paper_service.get_domain_papers(id, limit=100)

    dossier = {
        "export_metadata": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "generator": "ResearchLens Decision-Support Engine v1.0",
            "domain_id": id,
            "domain_name": domain.name,
            "disclaimer": (
                "Candidate research gaps and scores are computed deterministically from publication counts "
                "and keyword co-occurrence models across OpenAlex, Semantic Scholar, and arXiv. "
                "Verify findings against primary literature before topic finalization."
            ),
        },
        "overview": overview.model_dump() if overview else None,
        "trends": [t.model_dump() for t in trends] if trends else [],
        "gap_matrix": gap_matrix.model_dump() if gap_matrix else None,
        "methods_and_datasets": methods.model_dump() if methods else None,
        "open_challenges": challenges.model_dump() if challenges else None,
        "suggested_directions": suggestions.model_dump() if suggestions else None,
        "indexed_papers_count": len(papers_data.get("papers", [])),
        "sample_papers": papers_data.get("papers", [])[:50],
    }

    json_str = json.dumps(dossier, indent=2, default=str)
    filename = f"researchlens_{id}_dossier.json"

    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{id}.csv")
async def export_domain_csv(id: str):
    """Generates a tabular CSV export of papers, citations, quality scores, and detected limitations."""
    domain = domain_service.get_domain(id)
    if not domain:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )

    papers_data = await paper_service.get_domain_papers(id, limit=200)
    papers = papers_data.get("papers", [])

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Header Row
    writer.writerow([
        "Paper ID",
        "Title",
        "Year",
        "Venue",
        "Citations",
        "Authors",
        "Quality Score",
        "Venue Tier",
        "Institution Group",
        "Open Access",
        "Type",
        "DOI",
        "Detected Limitation / Future Work",
        "Landing URL",
    ])

    for p in papers:
        quality = p.get("quality", {})
        limitation = p.get("limitation_callout", {})
        authors = ", ".join([a.get("name", "") for a in p.get("authors", [])])

        writer.writerow([
            p.get("id", ""),
            p.get("title", ""),
            p.get("year", ""),
            p.get("venue", ""),
            p.get("citation_count", 0),
            authors,
            quality.get("quality_score", ""),
            quality.get("venue_tier", ""),
            quality.get("institution_group", ""),
            "Yes" if p.get("is_open_access") else "No",
            p.get("type", ""),
            p.get("doi", ""),
            limitation.get("sentence", "") if limitation else "",
            p.get("landing_url", ""),
        ])

    csv_str = output.getvalue()
    filename = f"researchlens_{id}_papers.csv"

    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
