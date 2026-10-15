# ResearchLens Architecture & Design Decisions

This document records architectural choices, data handling decisions, and trade-offs made during the development of ResearchLens.

---

## Decision Log

### 1. Unified Modular FastAPI Architecture
- **Context:** The server initially had leftovers of early scaffolding and multiple experimental frameworks.
- **Decision:** Build upon the existing FastAPI backend (`server/app/`) with clean layered architecture:
  - `app/api/`: REST routing, input validation, and HTTP responses.
  - `app/services/`: Source adapters (OpenAlex, Semantic Scholar, arXiv) and core analysis engines (trends, gaps, methods, challenges).
  - `app/schemas/`: Pydantic v2 models for normalized papers, domain models, and API responses.
  - `app/database/`: MongoDB connection management and collection access.
  - `app/config/`: Pydantic-settings configuration with `.env` loading and clear defaults.
- **Rationale:** Clear separation of concerns, asynchronous I/O with `httpx`, and high testability with `pytest` and `respx`.

### 2. Removal of `agents/` and `graph/` Boilerplate
- **Context:** The original repo had empty `app/agents/` and `app/graph/` directories implying LangGraph/agentic workflows.
- **Decision:** Removed empty `app/agents/` and `app/graph/` directories per project constraints.
- **Rationale:** ResearchLens is strictly a deterministic, rule-based decision-support system. All trend metrics, gap evaluations, keyphrase extractions, and challenge identifications are computed via counting, statistical calculations (growth rates, opportunity scores), TF-IDF/YAKE keyword extraction, and regex/sentence pattern matching. No LLMs or model training are permitted.

### 3. Pydantic-Settings & Configuration Defaults
- **Context:** If a developer or evaluator runs the project without a configured `.env`, unhandled exceptions should not crash the server startup prematurely.
- **Decision:** Adopted `pydantic-settings` with default fallbacks for URLs, database names, and TTL values. Added a 2.5-second timeout on MongoDB ping checks to prevent long hangs when running without a local MongoDB daemon.
- **Rationale:** Enables smooth bootstrapping on new developer machines while logging actionable warnings for missing keys.

### 4. Normalized Scholarly Paper Model
- **Context:** Different scholarly providers (OpenAlex, Semantic Scholar, arXiv) provide divergent data schemas, id formats, and metadata richness.
- **Decision:** Every source adapter must map incoming data to a single unified `Paper` schema containing:
  - `id`, `doi`, `arxiv_id`, `title`, `abstract`, `year`, `publication_date`, `venue`, `venue_type`, `authors`, `citation_count`, `influential_citation_count`, `is_open_access`, `pdf_url`, `landing_url`, `topics`, `type`, `source`, `fetched_at`.
- **Rationale:** Ensures downstream analytics (quality scoring, gap detection, dataset/method extraction, challenge extraction) operate uniformly regardless of the paper's origin.

### 5. Multi-Source Deduplication Strategy
- **Context:** Papers can be simultaneously indexed across OpenAlex, Semantic Scholar, and arXiv.
- **Decision:** Deduplicate sequentially by:
  1. DOI (normalized lowercase without URL prefixes).
  2. arXiv ID (clean canonical ID without version numbers).
  3. Normalized title (alphanumeric lowercase) + publication year.
  Merge metadata keeping the richest fields (e.g. open-access PDF links, highest citation counts, complete author affiliations, inverted-index reconstructed abstracts).
- **Rationale:** Prevents double-counting in topic frequencies, trend analytics, and recommendation lists.

### 6. Rate Limiting, Politeness & Caching Strategy
- **Context:** OpenAlex transitioned to usage-based limits with free API keys; Semantic Scholar enforces rate limits on unauthenticated queries; arXiv requires polite spacing (max 1 request per 3 seconds).
- **Decision:**
  - Route all external HTTP requests through a centralized async client with concurrency limits (max 5 concurrent calls) and exponential backoff retry via `tenacity` on HTTP 429 and 5xx.
  - Include `User-Agent` and `mailto:` contact headers (`CONTACT_EMAIL`) for OpenAlex politeness pool.
  - Enforce a 3.0-second delay between requests to arXiv using `ArxivThrottler`.
  - Persist responses in MongoDB `api_cache` collection with TTL indexing (7-day default for count queries, 24-hour default for paper queries), with in-memory cache fallback if MongoDB is not reachable.
- **Rationale:** Guarantees compliance with external scholarly terms of service and prevents unnecessary upstream requests.

### 7. OpenAlex Inverted Index Abstract Reconstruction
- **Context:** OpenAlex does not return raw abstract strings in the API; it returns `abstract_inverted_index` (a word-to-positions dictionary) to respect publisher terms.
- **Decision:** Implemented `reconstruct_abstract` in `OpenAlexAdapter` that sorts word tokens by position index to assemble a clean plain-text abstract.
- **Rationale:** Enables full downstream keyphrase extraction (TF-IDF/YAKE) and sentence limitation parsing on OpenAlex abstracts.

### 8. Dev Mock Mode (`DEV_MOCK`)
- **Context:** Fast offline test runs or local UI prototyping should be possible without burning API quotas.
- **Decision:** Included a `DEV_MOCK=false` setting. Mock fixtures are strictly gated behind this flag and never used in production builds. Real API responses or documented computations back all displayed numbers.

### 9. Trend Calculation & Partial Current Year Handling
- **Context:** Section 4.2 and 4.3 require computing $g(k, t) = (N(k,t) - N(k,t-1)) / N(k,t-1)$ and $\bar{g}(k)$ over $w=3$ complete years. Incomplete publication data from the ongoing calendar year could artificially skew trajectory calculations downward.
- **Decision:** Excluded the current ongoing calendar year from growth rate and $\bar{g}$ calculations, using the last 3 complete calendar years (e.g. 2023, 2024, 2025). Thresholds are centralized in `server/config/analysis.json`: $\bar{g} \ge 0.25$ and $N(k, Y-1) \ge 30 \implies$ *Emerging*, $\bar{g} \le -0.10 \implies$ *Declining*, otherwise *Stable*.
- **Rationale:** Ensures statistical reliability and avoids false alarms from partial-year reporting lags.

### 10. Local Cache Tier for Multi-Process Durability
- **Context:** In developer and testing environments without a running MongoDB daemon, in-memory state would not survive separate CLI processes or server reloads.
- **Decision:** Added persistent JSON caching in `server/.cache/domains/` alongside MongoDB storage in `DomainService` and `GapService`.
- **Rationale:** Provides seamless developer workflow without requiring external database dependencies while remaining 100% compatible with production MongoDB Atlas.

### 11. Statistical Opportunity Model & Gap Matrix
- **Context:** Section 4.4 specifies a gap matrix where rows are sub-areas and columns are real-world application areas, evaluating observed vs. expected counts.
- **Decision:**
  - $\text{expected}_{i,j} = \frac{\text{row\_total}_i \times \text{col\_total}_j}{\max(1, \text{grand\_total})}$
  - $\text{ratio}_{i,j} = \frac{\text{observed}_{i,j}}{\max(0.1, \text{expected}_{i,j})}$
  - $\text{opportunity}_{i,j} = \min(\text{pop}_i, \text{pop}_j) \times (1 - \min(1, \text{ratio}_{i,j}))$, where $\text{pop}$ is the percentile rank of the row or column.
  - Candidate gaps require minimum row and column support ($\ge 5$) and $\text{ratio} < 0.85$ to avoid ranking obscure or unstudied noise.
  - Prominent disclaimer text attached to all responses stating that low paper counts can denote unpromising or impractical niches as well as open opportunities.
- **Rationale:** Balances statistical significance against discoverability of under-studied research directions.

### 12. Quality Scoring & Recency Formula
- **Context:** Section 3.4 requires a multi-factor score balancing venue tiers, institution reputation groups, and age-adjusted citations, with special handling for papers from the last 24 months.
- **Decision:**
  - Established editable whitelists: `server/config/institutions.json` (Group A: global elite, Group B: top Indian institutions, Group C: industry AI labs) and `server/config/venues.json` (Tier 1, Tier 2, Tier 3, Preprints).
  - Standard papers: $\text{quality} = 0.35 \times \text{venue} + 0.25 \times \text{institution} + 0.40 \times \text{citations}$.
  - Recent papers (<24 months): $\text{quality} = 0.50 \times \text{venue} + 0.50 \times \text{institution} + \text{recency\_boost}$.
  - Whitelists do not hide other papers by default, preserving equity for emerging and non-affiliated authors.
- **Rationale:** Rewards rigor and track record without penalizing groundbreaking recent work that has not yet accumulated citations.

### 13. Method, Dataset & Keyphrase Mining
- **Context:** Section 4.5 requires identifying dominant methodologies and benchmark datasets with usage trends and keyphrase frequency without LLM inference.
- **Decision:**
  - Configured editable dictionaries `server/config/methods.json` and `server/config/datasets.json` with canonical IDs, full names, categories, and alias lists (e.g. CNN, ViT, BERT, YOLO, ImageNet, MS COCO, PlantVillage).
  - Precompiled boundary-aware case-insensitive regex patterns matching against paper titles and abstracts.
  - Tracked yearly usage trajectories per method to detect "Trending" vs. "Widely Used" vs. "Emerging" techniques.
  - Deployed `scikit-learn` `TfidfVectorizer(ngram_range=(1, 2))` with automated filtering of research boilerplate stopwords ("paper", "approach", "proposed", "performance", "task") to extract domain keyphrases.
- **Rationale:** Purely deterministic, high-speed, and reproducible extraction with zero external API dependencies or halluncination risk.

### 14. Pattern-Weighted Challenge Extraction & Semantic Deduplication
- **Context:** Section 4.6 requires surfacing high-priority research bottlenecks and open challenges with direct source attribution.
- **Decision:**
  - Segmented abstract text into sentences and evaluated multi-tiered regex patterns (Tier 1: `open challenge`, `remains challenging`, `underexplored`; Tier 2: `limited by`, `future research should`, `lack of`; Tier 3: `has not been`, `yet to be`).
  - Scored sentences via a composite metric: $\text{score} = (\text{pattern\_tier\_weight} \times 2.5 + \log_{10}(\text{citations} + 1) \times 1.5 + \text{recency\_bonus}) \times \text{survey\_multiplier}$.
  - Applied token-level Jaccard similarity thresholding ($> 0.50$) to prune near-duplicate sentences, retaining the highest-scoring candidate.
  - Categorized challenges into thematic bins ("Scalability & Efficiency", "Generalization & Robustness", "Data Scarcity & Quality", "Interpretability & Trust", "Real-World Deployment", "Methodological Bottlenecks").
  - Linked each challenge directly to its source paper metadata with highlighted inline HTML tags.
- **Rationale:** Prioritizes authoritative, consensus limitations from peer-reviewed surveys while keeping citations clickable.

### 15. Candidate Project Directions & 3-Stage Reading Roadmap
- **Context:** Section 4.7 requires turning the highest-opportunity statistical gap cells into actionable project direction cards and generating an ordered learning pathway.
- **Decision:**
  - Transformed top gap cells into structured suggestion cards: title `<Sub-area> for <Application>`, formatted "Why this?" rationale citing observed count, expected count, ratio, opportunity score, and sub-area trend label.
  - Attached matching candidate papers, keyword intersections, and relevant open-challenge sentences mentioning the topic or application.
  - Built a 3-stage reading roadmap:
    - Stage 1 (Foundational Surveys & Landscape): Broad review and taxonomy papers.
    - Stage 2 (Milestone & Foundational Works): High-impact seminal papers and foundational architectures with peak historical citations.
    - Stage 3 (State-of-the-Art & Recent Advances): Top quality-ranked papers from the last 24 months.
- **Rationale:** Gives researchers an immediate, structured pedagogical ramp and hypothesis springboard backed by empirical data.

### 16. Frontend Architecture, Design Tokens & Shell Navigation
- **Context:** Section 8 dictates a clean white background, calm professional design tokens, persistent top bar, collapsible left navigation sidebar, and instant loading skeletons.
- **Decision:**
  - Standardized design tokens in `client/src/index.css`: Page background `#FFFFFF`, panels `#FFFFFF` with `1px #E5E7EB` border and `8px` radius, subtle headers `#F8FAFC`, headings `#14213D`, text `#111827`, secondary `#6B7280`, accent `#4F46E5`.
  - Configured `client/vite.config.js` with dev proxy `/api` pointing to `http://localhost:8000`.
  - Designed persistent `TopBar` (Brand, New Search, Saved, Methodology), `Sidebar` (7 domain views + Export Report CTA), `DomainHeader` (Data as of timestamp + OpenAlex, Semantic Scholar, arXiv source chips), and `Skeleton` loaders.
  - Implemented client-side routing via React Router with full route tree (`/`, `/saved`, `/methodology`, `/domain/:domainId/*`).
- **Rationale:** Guarantees zero latency on route transitions, responsive navigation across devices, and strict fidelity to the specified design system without complex CSS compiler overhead.

### 17. Interactive Analytics Views & ECharts Integration
- **Context:** Section 8 requires high-fidelity, interactive visualizations (multi-line trends, momentum bubble chart, gap heatmap, citations scatter, method bar charts) with table-view toggles and paper details drawers.
- **Decision:**
  - Integrated Apache ECharts (`echarts` and `echarts-for-react`) using a cohesive design palette matching our color tokens (Indigo `#4F46E5`, Green `#16A34A`, Amber `#D97706`).
  - Implemented dual-mode view toggles ("View as Chart" / "View as Table") across all charts to ensure full accessibility and tabular inspection.
  - Connected interactive heatmap cell click events to open live paper inspector modals for each sub-area &times; application intersection.
  - Implemented slide-out `PaperDrawer` providing full abstract inspection with highlighted limitation sentences, author affiliations, and instant one-click BibTeX citation generation.
- **Rationale:** Delivers executive-grade decision support with deep exploratory drill-downs while keeping all numbers grounded in verified scholarly records.

### 18. Multi-Format Export, Accessibility & Print Architecture
- **Context:** Section 8 and Section 10 require exporting complete research dossiers (JSON), tabular literature extracts (CSV), and supporting print/PDF exports for committee evaluation, alongside WCAG AA accessibility.
- **Decision:**
  - Implemented `GET /api/export/{id}.json` generating an end-to-end dossier (metadata, sub-area trajectories, gap matrix, methods, prioritized challenges, suggestions, and roadmap).
  - Implemented `GET /api/export/{id}.csv` outputting structured publication records (paper ID, title, year, venue, citations, authors, quality score, venue tier, institution group, open access, and limitation callout).
  - Built `ExportModal` in the frontend giving researchers immediate access to JSON, CSV, and Print triggers.
  - Formulated print stylesheets (`@media print`) stripping out UI chrome (navigation, buttons, modals), expanding tables, and enforcing clean page-break rules.
  - Implemented WCAG AA keyboard focus indicators (`:focus-visible`) and reduced-motion user preferences.
- **Rationale:** Empowers researchers, thesis advisors, and students to take findings outside the web interface for writing, publication, and grant applications.

### 19. Multi-Container Orchestration, CI Pipeline & Zero-Cost Cloud Deployment
- **Context:** Section 5, 10, and 11 require containerization (`Dockerfile` per service, `docker-compose.yml`), a CI workflow, and a practical deployment guide on free tiers.
- **Decision:**
  - Structured `server/Dockerfile` using `python:3.11-slim` with healthcheck endpoint at `/api/health`.
  - Structured `client/Dockerfile` as a multi-stage build: `node:22-alpine` compiling static assets, transferred to `nginx:alpine` configured for SPA routing (`try_files $uri $uri/ /index.html`) and `/api` reverse proxying.
  - Implemented `docker-compose.yml` linking `client`, `server`, and `mongo:7.0` with persistent volume management and health dependencies.
  - Configured GitHub Actions `.github/workflows/ci.yml` running parallel backend `pytest` suite and frontend production build on pushes and PRs.
  - Outlined free deployment configuration targeting Vercel/Netlify for the static frontend, Render/Railway for the async FastAPI backend, and MongoDB Atlas M0 Sandbox for persistent cross-session caching.
- **Rationale:** Guarantees 100% reproducible environments for evaluators and students, zero startup friction, and free hosting viability.
