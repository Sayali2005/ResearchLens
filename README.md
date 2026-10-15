# ResearchLens

ResearchLens is an academic decision-support platform designed to help students, PhD candidates, and researchers discover high-impact research topics, spot literature gaps, analyze publication trajectories, and formulate project roadmaps.

> **Core Constraint:** ResearchLens operates strictly via deterministic counting, statistical models, TF-IDF keyphrase extraction, and rule-based pattern matching. **No LLMs, no model training, and no web scraping** are used. Every displayed number, chart, and card links directly to real peer-reviewed literature.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       ResearchLens Client (SPA)       |
                      |   React 19 + Vite + Apache ECharts    |
                      +-------------------+-------------------+
                                          |
                                    HTTP / REST
                                          |
                      +-------------------v-------------------+
                      |      FastAPI Backend Engine (Async)   |
                      +-------------------+-------------------+
                                          |
         +--------------------------------+-------------------------------+
         |                                |                               |
+--------v---------+             +--------v---------+            +--------v---------+
| Source Adapters  |             | Analysis Engines |            | Multi-Tier Cache |
| - OpenAlex       |             | - Trend Math     |            | - In-Memory      |
| - Semantic Scholar             | - Gap Matrix     |            | - Local JSON     |
| - arXiv API      |             | - Quality Ranker |            | - MongoDB Atlas  |
+------------------+             | - TF-IDF / YAKE  |            +------------------+
                                 | - Challenge Regex|
                                 +------------------+
```

### System Components
1. **Source Adapters (`server/app/services/`):** Unified async client with concurrency limits (max 5), rate tracking, exponential backoff via `tenacity`, and polite spacing (3.0s arXiv delay). Converts raw responses into the unified `Paper` schema.
2. **Deduplication Engine (`deduplication.py`):** Deduplicates across OpenAlex, Semantic Scholar, and arXiv sequentially by DOI $\rightarrow$ arXiv ID $\rightarrow$ normalized Title + Year, merging the richest metadata.
3. **Trend Math Engine (`trend_service.py`):** Calculates yearly growth $g(k, t)$ and 3-year mean growth $\bar{g}(k)$ over complete calendar years, assigning deterministic labels (*Emerging*, *Stable*, *Declining*).
4. **Gap Matrix Engine (`gap_service.py`):** Cross-references sub-areas with 12 application sectors (Healthcare, Agriculture, Finance, Robotics, etc.), computing observed vs. expected publication frequencies and opportunity scores.
5. **Quality Ranker (`quality_service.py`):** Multi-factor scoring ($0.35\cdot\text{venue} + 0.25\cdot\text{institution} + 0.40\cdot\text{citations}$) with a $<24$-month recency boost.
6. **Insight Engines (`method_service.py`, `challenge_service.py`, `suggestion_service.py`):** Dictionary matching for 22 methods and 20 datasets, TF-IDF keyphrase extraction, pattern-weighted challenge extraction, direction synthesis, and 3-stage reading roadmaps.

---

## Key Features

- **Domain Overview & Taxonomy:** Resolves user search terms into academic topic hierarchies and extracts top sub-areas.
- **Publication Growth Trends:** Interactive ECharts multi-line trajectories and momentum bubble distributions with table-view toggles.
- **Cross-Disciplinary Gap Heatmap:** Color-coded matrix identifying under-explored intersections with click-through to primary literature.
- **Paper Extraction Analysis:** Multi-faceted filtering (venue tiers, institution groups, citations, open access, type) with green limitation callout boxes.
- **Methodology & Dataset Tracking:** Bar charts, temporal adoption lines, and TF-IDF keyphrase clouds.
- **Open Challenges & Bottlenecks:** Categorized limitation statements with inline HTML highlighting and direct source links.
- **Suggested Project Directions:** Structured candidate cards with statistical "Why this?" rationale and ordered 3-stage reading curricula.
- **Multi-Format Export:** Instant JSON research dossier downloads, CSV literature tables, and print-friendly PDF mode.

---

## Quick Start with Docker Compose

The easiest way to run the full stack (FastAPI + React Client + MongoDB) is with Docker Compose:

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/ResearchLens.git
cd ResearchLens

# 2. Copy the environment configuration
cp .env.example .env

# 3. Start all services
docker-compose up --build
```

- **Frontend:** [http://localhost](http://localhost) (or [http://localhost:5173](http://localhost:5173))
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Local Development Setup

### Prerequisites
- **Python:** 3.11+ (Python 3.13 supported)
- **Node.js:** 20.x or 22.x
- **MongoDB:** (Optional for local development; system gracefully falls back to local disk cache)

### Backend (FastAPI)
```bash
cd server

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --port 8000
```

### Frontend (React 19 + Vite)
```bash
cd client

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

---

## REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, database status, and configuration |
| `GET` | `/api/domains/suggest?q=` | Autocomplete domain suggestions from OpenAlex taxonomy |
| `POST`| `/api/domains/analyze` | Initiates domain analysis job, returns `job_id` |
| `GET` | `/api/jobs/{job_id}` | Polls progress and status for in-flight analysis jobs |
| `GET` | `/api/domains/{id}/overview` | Sub-areas, works counts, and trajectory labels |
| `GET` | `/api/domains/{id}/trends` | Multi-year yearly paper counts and growth rates |
| `GET` | `/api/domains/{id}/gaps?apps=` | Observed vs. expected heatmap matrix and top opportunities |
| `GET` | `/api/domains/{id}/papers` | Filtered, quality-scored papers with limitation callouts |
| `GET` | `/api/domains/{id}/methods` | Detected methods, datasets, TF-IDF keywords, and trends |
| `GET` | `/api/domains/{id}/challenges`| Prioritized limitation and future work statements |
| `GET` | `/api/domains/{id}/suggestions`| Candidate project direction cards and 3-stage reading roadmap |
| `GET` | `/api/export/{id}.json` | Complete research dossier snapshot download |
| `GET` | `/api/export/{id}.csv` | Tabular literature records CSV spreadsheet download |
| `GET` | `/api/config/applications` | Active application areas configuration |

---

## Running Automated Tests

All algorithms, deduplication rules, quality scores, and API endpoints are validated via `pytest`:

```bash
cd server
pytest -v
```

All 32 unit and API tests pass in under 20 seconds.

---

## Deployment Guide (Free-Tier Production)

### 1. Frontend (Vercel or Netlify)
- **Framework Preset:** Vite
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:** Set `VITE_API_URL` to your production backend URL.

### 2. Backend (Render or Railway)
- **Build Command:** `pip install -r server/requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Root Directory:** `server`
- **Environment Variables:**
  - `FRONTEND_URL`: Production URL of your Vercel/Netlify frontend.
  - `MONGODB_URI`: Connection string from MongoDB Atlas M0 cluster.
  - `OPENALEX_API_KEY`: Free OpenAlex API key.
  - `CONTACT_EMAIL`: Your academic contact email (for polite pool access).

### 3. Database (MongoDB Atlas)
- Create a free **M0 Sandbox cluster** on MongoDB Atlas.
- Add network access `0.0.0.0/0` (or your backend provider's IP range).
- Obtain the `mongodb+srv://...` connection string.

---

## Known Limitations & Design Trade-offs

1. **Deterministic Lexical Matching:** Methods, datasets, and limitation sentences are extracted via curated dictionaries and regex patterns rather than generative LLMs. While this prevents hallucinations, novel terminology not in the dictionaries will appear under the TF-IDF keyphrase section rather than method chips.
2. **Partial Calendar Year Lag:** Growth calculations deliberately exclude the ongoing calendar year to prevent partial-year reporting lags from skewing trajectories downward.
3. **Candidate Gaps vs. Guaranteed Viability:** A low paper count in the gap matrix identifies statistical under-representation. In certain niche intersections, low volume may reflect physical or commercial impracticality rather than an overlooked opportunity.
4. **Scholarly Rate Limits:** Unauthenticated Semantic Scholar queries are subject to upstream rate limits; the system gracefully falls back to OpenAlex and arXiv without crashing.

---

## Architecture Decision Log

All design choices, algorithm definitions, and architectural trade-offs are logged in [docs/DECISIONS.md](docs/DECISIONS.md).

---

## License

MIT License. Designed and built for academic research and educational decision support.
