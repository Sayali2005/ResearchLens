import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Lightbulb,
  Compass,
  ExternalLink,
  Bookmark,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonCard } from '../../components/Skeleton';
import { PaperDrawer } from '../../components/PaperDrawer';

export function SuggestionsView() {
  const { domainId, domainOverview } = useOutletContext();
  const [suggestionData, setSuggestionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [savedTopicIds, setSavedTopicIds] = useState([]);

  useEffect(() => {
    async function loadSuggestions() {
      setIsLoading(true);
      try {
        const res = await api.getDomainSuggestions(domainId);
        if (res) {
          setSuggestionData(res);
        }
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSuggestions();

    try {
      const saved = JSON.parse(localStorage.getItem('researchlens_saved_topics') || '[]');
      setSavedTopicIds(saved.map((s) => s.id));
    } catch {
      // fallback
    }
  }, [domainId]);

  const handleSaveTopic = (direction) => {
    try {
      const saved = JSON.parse(localStorage.getItem('researchlens_saved_topics') || '[]');
      if (!saved.some((s) => s.id === direction.id)) {
        saved.push({
          id: direction.id,
          name: direction.title,
          subArea: direction.sub_area,
          application: direction.application,
          savedAt: new Date().toISOString(),
        });
        localStorage.setItem('researchlens_saved_topics', JSON.stringify(saved));
        setSavedTopicIds([...savedTopicIds, direction.id]);
        alert(`Saved topic: "${direction.title}"`);
      }
    } catch {
      // fallback
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>Suggested Project Directions & Roadmap</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Actionable research topics synthesized from statistical gap matrix cells, combined with an ordered 3-stage reading curriculum.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {/* Section 1: Candidate Direction Cards */}
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lightbulb size={20} color="var(--color-warning)" />
                <span>Candidate Research Direction Cards ({suggestionData?.suggestions?.length || 0})</span>
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Formulated from cells with low observed-to-expected ratios and high statistical support.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(suggestionData?.suggestions || []).map((card) => {
                const isSaved = savedTopicIds.includes(card.id);

                return (
                  <div
                    key={card.id}
                    className="panel"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      borderLeft: '4px solid var(--accent-indigo)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '1.15rem', color: 'var(--text-heading)' }}>
                          {card.title}
                        </h4>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                          <span className="badge badge-indigo">{card.sub_area}</span>
                          <span className="badge badge-stable">{card.application}</span>
                          <span className="badge badge-emerging">
                            Opportunity Score: {card.opportunity.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <button
                        className={`btn btn-sm ${isSaved ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => handleSaveTopic(card)}
                        disabled={isSaved}
                      >
                        <Bookmark size={14} />
                        <span>{isSaved ? 'Saved Topic' : 'Save Direction'}</span>
                      </button>
                    </div>

                    {/* Why this? Rationale Strip */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        borderLeft: '3px solid var(--color-warning)',
                      }}
                    >
                      <strong style={{ color: 'var(--text-heading)' }}>Why this? </strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{card.why}</span>
                    </div>

                    {/* Matching Keywords */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Keywords:</span>
                      {card.keywords.map((kw, i) => (
                        <span key={i} className="badge badge-stable" style={{ fontSize: '0.75rem' }}>
                          {kw}
                        </span>
                      ))}
                    </div>

                    {/* Related Open Challenges */}
                    {card.related_challenges?.length > 0 && (
                      <div style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--color-warning)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Related Open Challenge Mention:
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                          "{card.related_challenges[0]}"
                        </div>
                      </div>
                    )}

                    {/* Matching Example Baseline Papers */}
                    {card.example_papers?.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Representative Literature ({card.example_papers.length} baseline papers)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {card.example_papers.map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.85rem',
                                padding: '4px 0',
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{p.title}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                  ({p.year} &bull; {p.citation_count} citations)
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-subtle btn-sm"
                                  onClick={() => setSelectedPaper(p)}
                                  style={{ padding: '2px 8px', fontSize: '0.775rem' }}
                                >
                                  Details
                                </button>
                                {p.landing_url && (
                                  <a
                                    href={p.landing_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-subtle btn-sm"
                                    style={{ padding: '2px 6px' }}
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Ordered 3-Stage Reading Roadmap */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={22} color="var(--accent-indigo)" />
                <span>Ordered Literature Reading Curriculum</span>
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Pedagogical roadmap structured from surveys &rarr; foundational works &rarr; contemporary state-of-the-art advances.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(suggestionData?.roadmap || []).map((stage) => (
                <div key={stage.stage} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--accent-indigo)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                      }}
                    >
                      {stage.stage}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', color: 'var(--text-heading)' }}>{stage.title}</h4>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        {stage.description}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '44px' }}>
                    {(stage.papers || []).map((p, idx) => (
                      <div
                        key={p.id}
                        className="panel-subtle"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {idx + 1}. {p.title}
                          </div>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {p.venue || 'Venue'} &bull; {p.year} &bull; {p.citation_count?.toLocaleString()} citations
                            {p.is_open_access && ' &bull; Open Access'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSelectedPaper(p)}
                          >
                            <span>Inspect</span>
                          </button>
                          {p.landing_url && (
                            <a
                              href={p.landing_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm"
                            >
                              <ExternalLink size={13} />
                              <span>Read</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
