import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Layers,
  Sparkles,
  TrendingUp,
  Cpu,
  Database,
  AlertCircle,
  Lightbulb,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonCard, SkeletonMetric } from '../../components/Skeleton';
import { PaperDrawer } from '../../components/PaperDrawer';

export function LandscapeView() {
  const { domainOverview, domainId } = useOutletContext();
  const topics = domainOverview?.sub_areas || [];

  const [methodsData, setMethodsData] = useState(null);
  const [challengesData, setChallengesData] = useState(null);
  const [suggestionsData, setSuggestionsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState(null);

  useEffect(() => {
    async function loadLandscapeData() {
      setIsLoading(true);
      try {
        const [methods, challenges, suggestions] = await Promise.all([
          api.getDomainMethods(domainId),
          api.getDomainChallenges(domainId),
          api.getDomainSuggestions(domainId),
        ]);
        setMethodsData(methods);
        setChallengesData(challenges);
        setSuggestionsData(suggestions);
      } catch (err) {
        console.error('Failed to load landscape insights:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadLandscapeData();
  }, [domainId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Overview Intro */}
      <div>
        <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>Research Landscape</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Comprehensive view of sub-areas, core methodologies, recurring limitations, and candidate project directions in {domainOverview?.domain_name || domainId}.
        </p>
      </div>

      {/* Sub-area Chips Strip */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-indigo)" />
            <span>Active Sub-Areas ({topics.length})</span>
          </h3>
          <Link to={`/domain/${domainId}/trends`} style={{ fontSize: '0.825rem', color: 'var(--accent-indigo)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Growth trends</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {topics.map((topic) => {
            let badgeClass = 'badge-stable';
            if (topic.trend_label === 'Emerging') badgeClass = 'badge-emerging';
            else if (topic.trend_label === 'Declining') badgeClass = 'badge-declining';

            return (
              <div
                key={topic.topic_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 12px',
                }}
              >
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{topic.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {topic.works_count ? topic.works_count.toLocaleString() : ''}
                </span>
                <span className={`badge ${badgeClass}`}>{topic.trend_label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {/* Two-Column: Methodologies & Core Datasets + Gap Analysis Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            {/* Panel 1: Methodologies and Core Datasets */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} color="var(--accent-indigo)" />
                  <span>Methodologies & Core Datasets</span>
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Identified techniques and benchmark corpora across top publications.
                </p>
              </div>

              {/* Methods Subsection */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Top Methodologies
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(methodsData?.methods || []).slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.category}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                          {m.percentage}%
                        </span>
                        <span className={`badge ${m.status === 'Trending' ? 'badge-emerging' : 'badge-stable'}`}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Datasets Subsection */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Benchmark Datasets
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(methodsData?.datasets || []).slice(0, 8).map((d) => (
                    <div
                      key={d.id}
                      className="panel-subtle"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.825rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Database size={13} color="var(--color-success)" />
                      <span style={{ fontWeight: 500 }}>{d.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({d.count})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <Link to={`/domain/${domainId}/methods`} className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                  <span>View All Methods & Datasets</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Panel 2: Gap Analysis Panel (Recurring Limitations) */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="var(--color-danger)" />
                  <span>Gap Analysis & Recurring Limitations</span>
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Documented bottlenecks extracted directly from recent surveys and milestone publications.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(challengesData?.challenges || []).slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="panel-subtle"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      borderLeft: '3px solid var(--color-warning)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.725rem' }}>GAP: {c.category}</span>
                      {c.source_paper?.landing_url && (
                        <a
                          href={c.source_paper.landing_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <span>Source ({c.source_paper.year})</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    <div
                      style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.45 }}
                      dangerouslySetInnerHTML={{ __html: c.highlighted_sentence }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <Link to={`/domain/${domainId}/challenges`} className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                  <span>View All Open Challenges ({challengesData?.total_challenges || 0})</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          {/* Suggested Project Directions Cards */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lightbulb size={18} color="var(--color-warning)" />
                  <span>Suggested Project Directions</span>
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  High-opportunity intersection cards backed by real observed vs. expected publication ratios.
                </p>
              </div>
              <Link to={`/domain/${domainId}/suggestions`} className="btn btn-outline btn-sm">
                <span>View Full Roadmap</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {(suggestionsData?.suggestions || []).slice(0, 3).map((card) => (
                <div
                  key={card.id}
                  className="panel-subtle"
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '1rem', color: 'var(--text-heading)' }}>{card.title}</h4>
                    <span className="badge badge-emerging" style={{ fontSize: '0.725rem' }}>
                      Opp: {card.opportunity.toFixed(2)}
                    </span>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Why this? </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{card.why}</span>
                  </div>

                  {/* Keywords */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {card.keywords.slice(0, 4).map((kw, i) => (
                      <span key={i} className="badge badge-stable" style={{ fontSize: '0.725rem' }}>
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Example Baseline Paper */}
                  {card.example_papers?.[0] && (
                    <div style={{ fontSize: '0.8rem', borderTop: '1px solid var(--border-light)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        <strong>Ref:</strong> {card.example_papers[0].title}
                      </span>
                      {card.example_papers[0].landing_url && (
                        <a
                          href={card.example_papers[0].landing_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent-indigo)' }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Synthesis Note at Bottom */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              fontSize: '0.875rem',
              color: 'var(--text-main)',
              lineHeight: 1.5,
            }}
          >
            <strong>Landscape Synthesis:</strong> {domainOverview?.domain_name} shows strong foundational consolidation around deep learning architectures ({methodsData?.methods?.[0]?.name || 'Neural Networks'}) across large benchmarks ({methodsData?.datasets?.[0]?.name || 'Standard Datasets'}). However, application frontiers in real-world deployment and out-of-distribution robustness remain key opportunities with high statistical divergence between general algorithmic volume and domain-specific adoption.
          </div>
        </>
      )}

      {/* Paper Detail Drawer */}
      <PaperDrawer
        paper={selectedPaper}
        isOpen={Boolean(selectedPaper)}
        onClose={() => setSelectedPaper(null)}
      />
    </div>
  );
}
