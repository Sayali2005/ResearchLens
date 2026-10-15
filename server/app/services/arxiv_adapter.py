import logging
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional
from app.schemas.paper import Author, Paper
from app.services.cache import cache_service
from app.services.http_client import http_client

logger = logging.getLogger("researchlens.arxiv")

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}


class ArxivAdapter:
    """Adapter for querying and normalizing preprints from arXiv API."""

    def __init__(self):
        self.base_url = "https://export.arxiv.org/api/query"

    def _clean_text(self, text: Optional[str]) -> str:
        if not text:
            return ""
        # Remove line breaks and normalize whitespace
        return re.sub(r"\s+", " ", text).strip()

    def _normalize_entry(self, entry: ET.Element) -> Paper:
        id_elem = entry.find("atom:id", ATOM_NS)
        raw_id = self._clean_text(id_elem.text if id_elem is not None else "")
        # e.g., http://arxiv.org/abs/2104.12345v1 -> 2104.12345
        arxiv_id = raw_id.split("/abs/")[-1] if "/abs/" in raw_id else raw_id
        canonical_arxiv_id = re.sub(r"v\d+$", "", arxiv_id)

        title_elem = entry.find("atom:title", ATOM_NS)
        title = self._clean_text(title_elem.text if title_elem is not None else "Untitled")

        summary_elem = entry.find("atom:summary", ATOM_NS)
        abstract = self._clean_text(summary_elem.text if summary_elem is not None else "") or None

        published_elem = entry.find("atom:published", ATOM_NS)
        pub_date = self._clean_text(published_elem.text if published_elem is not None else "")
        year = int(pub_date[:4]) if pub_date and pub_date[:4].isdigit() else None

        # Authors
        authors: List[Author] = []
        for author_elem in entry.findall("atom:author", ATOM_NS):
            name_elem = author_elem.find("atom:name", ATOM_NS)
            if name_elem is not None and name_elem.text:
                authors.append(Author(name=self._clean_text(name_elem.text), institutions=[]))

        # PDF and landing links
        pdf_url = None
        landing_url = raw_id if raw_id.startswith("http") else f"https://arxiv.org/abs/{canonical_arxiv_id}"
        for link in entry.findall("atom:link", ATOM_NS):
            if link.attrib.get("title") == "pdf" or link.attrib.get("type") == "application/pdf":
                pdf_url = link.attrib.get("href")

        if not pdf_url and canonical_arxiv_id:
            pdf_url = f"https://arxiv.org/pdf/{canonical_arxiv_id}.pdf"

        # DOI if available
        doi_elem = entry.find("arxiv:doi", ATOM_NS)
        doi = self._clean_text(doi_elem.text if doi_elem is not None else "") or None

        # Categories / topics
        topics: List[str] = []
        for cat in entry.findall("atom:category", ATOM_NS):
            term = cat.attrib.get("term")
            if term:
                topics.append(term)

        # Primary category
        prim_cat = entry.find("arxiv:primary_category", ATOM_NS)
        venue = f"arXiv ({prim_cat.attrib.get('term')})" if prim_cat is not None and prim_cat.attrib.get("term") else "arXiv"

        return Paper(
            id=f"arxiv:{canonical_arxiv_id}",
            doi=doi,
            arxiv_id=canonical_arxiv_id,
            title=title,
            abstract=abstract,
            year=year,
            publication_date=pub_date,
            venue=venue,
            venue_type="repository",
            authors=authors,
            citation_count=0,
            influential_citation_count=0,
            is_open_access=True,
            pdf_url=pdf_url,
            landing_url=landing_url,
            topics=topics,
            type="preprint",
            source="arxiv",
        )

    async def search_papers(
        self,
        query: str,
        limit: int = 25,
    ) -> List[Paper]:
        """Search preprints from arXiv API."""
        cache_key = {
            "source": "arxiv",
            "query": query,
            "limit": limit,
        }
        cached = await cache_service.get("papers", cache_key)
        if cached is not None:
            return [Paper(**p) for p in cached]

        clean_query = query.replace('"', "")
        search_query = f'all:"{clean_query}"'

        params: Dict[str, Any] = {
            "search_query": search_query,
            "start": 0,
            "max_results": min(limit, 50),
            "sortBy": "relevance",
            "sortOrder": "descending",
        }

        try:
            response = await http_client.get(self.base_url, params=params)
            root = ET.fromstring(response.text)
            entries = root.findall("atom:entry", ATOM_NS)
            papers = [self._normalize_entry(entry) for entry in entries]

            await cache_service.set(
                "papers",
                cache_key,
                [p.model_dump() for p in papers],
            )
            return papers
        except Exception as exc:
            logger.warning("arXiv search failed: %s", exc)
            return []


arxiv_adapter = ArxivAdapter()
