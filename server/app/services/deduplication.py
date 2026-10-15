import re
from typing import Dict, List, Optional, Tuple
from app.schemas.paper import Author, Institution, Paper


def normalize_doi(doi: Optional[str]) -> Optional[str]:
    if not doi:
        return None
    d = doi.strip().lower()
    d = re.sub(r"^https?://(dx\.)?doi\.org/", "", d)
    d = re.sub(r"^doi:\s*", "", d)
    return d.strip() or None


def normalize_arxiv_id(arxiv_id: Optional[str]) -> Optional[str]:
    if not arxiv_id:
        return None
    a = arxiv_id.strip().lower()
    a = re.sub(r"^https?://arxiv\.org/(abs|pdf)/", "", a)
    a = re.sub(r"^arxiv:\s*", "", a)
    # Strip trailing version e.g. v1, v2
    a = re.sub(r"v\d+$", "", a)
    return a.strip() or None


def normalize_title(title: Optional[str]) -> str:
    if not title:
        return ""
    t = title.lower()
    # Remove non-alphanumeric chars
    t = re.sub(r"[^a-z0-9\s]", "", t)
    # Collapse consecutive spaces
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _merge_authors(base_authors: List[Author], incoming_authors: List[Author]) -> List[Author]:
    merged_by_name: Dict[str, Author] = {}

    for a in base_authors:
        name_key = normalize_title(a.name)
        merged_by_name[name_key] = a

    for a in incoming_authors:
        name_key = normalize_title(a.name)
        if name_key in merged_by_name:
            existing = merged_by_name[name_key]
            # Merge institutions
            if a.institutions and not existing.institutions:
                existing.institutions = a.institutions
            elif a.institutions and existing.institutions:
                existing_rors = {inst.ror for inst in existing.institutions if inst.ror}
                for inst in a.institutions:
                    if not inst.ror or inst.ror not in existing_rors:
                        existing.institutions.append(inst)
            if not existing.id and a.id:
                existing.id = a.id
        else:
            merged_by_name[name_key] = a

    return list(merged_by_name.values())


def merge_paper(base: Paper, incoming: Paper) -> Paper:
    """Merge two paper instances, retaining the richest metadata."""
    # Preferred DOI & arXiv ID
    doi = normalize_doi(base.doi) or normalize_doi(incoming.doi)
    arxiv_id = normalize_arxiv_id(base.arxiv_id) or normalize_arxiv_id(incoming.arxiv_id)

    # Title: pick longer/cleaner if sensible
    title = base.title
    if (len(incoming.title) > len(base.title) and len(base.title) < 20) or not title:
        title = incoming.title

    # Abstract: pick richest
    abstract = base.abstract
    if not abstract or (incoming.abstract and len(incoming.abstract) > len(abstract)):
        abstract = incoming.abstract

    # Year & Publication date
    year = base.year or incoming.year
    pub_date = base.publication_date or incoming.publication_date
    if incoming.publication_date and len(incoming.publication_date) > len(str(base.publication_date or "")):
        pub_date = incoming.publication_date

    # Venue & Venue Type
    venue = base.venue or incoming.venue
    venue_type = base.venue_type or incoming.venue_type

    # Authors
    merged_authors = _merge_authors(base.authors, incoming.authors)

    # Citations
    citation_count = max(base.citation_count, incoming.citation_count)
    influential_count = max(base.influential_citation_count, incoming.influential_citation_count)

    # Open Access & Links
    is_open_access = base.is_open_access or incoming.is_open_access
    pdf_url = base.pdf_url or incoming.pdf_url
    landing_url = base.landing_url or incoming.landing_url

    # Topics
    topics = list(dict.fromkeys(base.topics + incoming.topics))

    # Paper Type: review takes precedence
    paper_type = base.type
    if "review" in [base.type.lower(), incoming.type.lower()]:
        paper_type = "review"
    elif base.type == "preprint" and incoming.type == "article":
        paper_type = "article"

    # Sources: combine without duplicate
    sources = set(filter(None, base.source.split(",") + incoming.source.split(",")))
    source_str = ",".join(sorted(sources))

    return Paper(
        id=base.id,
        doi=doi,
        arxiv_id=arxiv_id,
        title=title,
        abstract=abstract,
        year=year,
        publication_date=pub_date,
        venue=venue,
        venue_type=venue_type,
        authors=merged_authors,
        citation_count=citation_count,
        influential_citation_count=influential_count,
        is_open_access=is_open_access,
        pdf_url=pdf_url,
        landing_url=landing_url,
        topics=topics,
        type=paper_type,
        source=source_str,
        fetched_at=base.fetched_at,
    )


def deduplicate_papers(papers: List[Paper]) -> List[Paper]:
    """Deduplicates a list of papers by DOI, then arXiv ID, then normalized title + year."""
    doi_map: Dict[str, Paper] = {}
    arxiv_map: Dict[str, Paper] = {}
    title_year_map: Dict[Tuple[str, Optional[int]], Paper] = {}

    distinct_papers: List[Paper] = []

    for paper in papers:
        doi = normalize_doi(paper.doi)
        arxiv_id = normalize_arxiv_id(paper.arxiv_id)
        norm_title = normalize_title(paper.title)

        matched_paper: Optional[Paper] = None

        # 1. Match by DOI
        if doi and doi in doi_map:
            matched_paper = doi_map[doi]

        # 2. Match by arXiv ID
        elif arxiv_id and arxiv_id in arxiv_map:
            matched_paper = arxiv_map[arxiv_id]

        # 3. Match by normalized title + year (or title alone if year is close/none)
        elif norm_title and len(norm_title) > 10:
            if (norm_title, paper.year) in title_year_map:
                matched_paper = title_year_map[(norm_title, paper.year)]
            elif (norm_title, None) in title_year_map:
                matched_paper = title_year_map[(norm_title, None)]

        if matched_paper:
            # Merge fields into the existing paper in-place
            merged = merge_paper(matched_paper, paper)
            # Update index pointers
            idx = distinct_papers.index(matched_paper)
            distinct_papers[idx] = merged

            # Update mappings to point to merged version
            if merged.doi:
                doi_map[normalize_doi(merged.doi)] = merged
            if merged.arxiv_id:
                arxiv_map[normalize_arxiv_id(merged.arxiv_id)] = merged
            if norm_title:
                title_year_map[(norm_title, merged.year)] = merged
        else:
            # New distinct paper
            distinct_papers.append(paper)
            if doi:
                doi_map[doi] = paper
            if arxiv_id:
                arxiv_map[arxiv_id] = paper
            if norm_title:
                title_year_map[(norm_title, paper.year)] = paper

    return distinct_papers
