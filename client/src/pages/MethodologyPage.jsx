import React from 'react';
import { BookOpen, Database, TrendingUp, Grid, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function MethodologyPage() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-indigo)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>
          <BookOpen size={18} />
          <span>Transparency & Principles</span>
        </div>
        <h1>ResearchLens Methodology & Mathematical Foundations</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '8px' }}>
          ResearchLens operates strictly on deterministic statistics, count evaluations, and lexical extraction. No Large Language Models (LLMs) or synthetic generation are utilized in calculating numbers, charts, or scores.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Scholarly Sources */}
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Database size={20} color="var(--accent-indigo)" />
            <h2>1. Scholarly Data Sources & Attribution</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            All paper metadata and publication volumes are queried through official, documented APIs:
          </p>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-main)' }}>
            <li>
              <strong>OpenAlex:</strong> Primary taxonomic hierarchy, topic entity resolution, and historical publication count aggregations.
            </li>
            <li>
              <strong>Semantic Scholar:</strong> Citation graphs, influential citation counts, and venue classifications.
            </li>
            <li>
              <strong>arXiv API:</strong> Fresh preprints and recent algorithmic developments, throttled at polite 3.0-second intervals.
            </li>
          </ul>
        </section>

        {/* Trend Mathematics */}
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <TrendingUp size={20} color="var(--color-success)" />
            <h2>2. Yearly Growth & Trend Classification</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
            For each sub-area $k$ in year $t$, annual publication volume $N(k, t)$ determines growth rate:
          </p>
          <div className="panel-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginBottom: '16px' }}>
            g(k, t) = (N(k, t) - N(k, t-1)) / N(k, t-1)
            <br />
            gbar(k) = mean(g(k, t)) over the last w=3 complete calendar years
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Labels are assigned deterministically:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-emerging">Emerging</span>
              <span style={{ fontSize: '0.875rem' }}>gbar(k) &ge; 25% and previous year count &ge; 30 works</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-declining">Declining</span>
              <span style={{ fontSize: '0.875rem' }}>gbar(k) &le; -10%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-stable">Stable</span>
              <span style={{ fontSize: '0.875rem' }}>All other trajectory ranges</span>
            </div>
          </div>
        </section>

        {/* Gap Matrix Math */}
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Grid size={20} color="var(--color-warning)" />
            <h2>3. Cross-Disciplinary Gap Matrix</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Rows represent sub-areas and columns represent 12 application sectors (Healthcare, Agriculture, Finance, Robotics, etc.).
          </p>
          <div className="panel-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginBottom: '16px' }}>
            expected(i, j) = (row_total_i * col_total_j) / grand_total
            <br />
            ratio(i, j) = observed(i, j) / max(0.1, expected(i, j))
            <br />
            opportunity(i, j) = min(pop_i, pop_j) * (1 - min(1, ratio(i, j)))
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Where pop_i is the percentile popularity rank of the sub-area. A cell must have minimum statistical support to qualify as a candidate gap.
          </p>
        </section>

        {/* Quality Scoring */}
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <ShieldCheck size={20} color="var(--accent-indigo)" />
            <h2>4. Quality Scoring & Fairness Principle</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Papers are scored on a normalized 0 to 1 scale:
          </p>
          <div className="panel-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Standard Papers: quality = 0.35 * venue_tier + 0.25 * institution_group + 0.40 * citations
            <br />
            Recent Papers (&lt;24m): quality = 0.50 * venue_tier + 0.50 * institution_group + recency_boost
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '0.875rem', fontWeight: 500 }}>
            <CheckCircle2 size={16} />
            <span>Fairness Commitment: Unaffiliated and emerging authors are never filtered out by default.</span>
          </div>
        </section>
      </div>
    </div>
  );
}
