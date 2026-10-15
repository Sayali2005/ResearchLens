import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertCircle, ExternalLink, Bookmark, Filter, Search, Award, CheckCircle } from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonCard } from '../../components/Skeleton';
import { PaperDrawer } from '../../components/PaperDrawer';

const CATEGORIES = [
  'All',
  'Scalability & Efficiency',
  'Generalization & Robustness',
  'Data Scarcity & Quality',
  'Interpretability & Trust',
  'Real-World Deployment',
  'Methodological Bottlenecks',
];

export function ChallengesView() {
  const { domainId, domainOverview } = useOutletContext();
  const [challenges, setChallenges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaper, setSelectedPaper] = useState(null);

  useEffect(() => {
    async function loadChallenges() {
      setIsLoading(true);
      try {
        const res = await api.getDomainChallenges(domainId);
        if (res && res.challenges) {
          setChallenges(res.challenges);
        }
      } catch (err) {
        console.error('Failed to load challenges:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadChallenges();
  }, [domainId]);

  // Filter challenges by category and search
  const filteredChallenges = challenges.filter((c) => {
    const matchesCat = selectedCategory === 'All' || c.category === selectedCategory;
    const matchesQuery =
      !searchQuery ||
      c.sentence.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.source_paper?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>Open Research Challenges & Bottlenecks</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Extracted explicit limitation and future work statements from recent surveys and milestone publications, ranked by pattern weight and citation authority.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search challenges by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 34px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
              }}
            />
          </div>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredChallenges.length}</strong> of <strong>{challenges.length}</strong> challenges
          </span>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.775rem', borderRadius: 'var(--radius-full)', padding: '3px 10px' }}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Challenges List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No challenges match the active filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredChallenges.map((item) => {
            const paper = item.source_paper;
            return (
              <div
                key={item.id}
                className="panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderLeft: '4px solid var(--accent-indigo)',
                }}
              >
                {/* Meta Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-indigo">{item.category}</span>
                    <span className="badge badge-warning" style={{ fontSize: '0.725rem' }}>
                      Pattern: {item.pattern}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Rigor Score: {item.score.toFixed(1)}
                  </span>
                </div>

                {/* Highlighted Sentence */}
                <div
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1.55,
                    color: 'var(--text-heading)',
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                  }}
                  dangerouslySetInnerHTML={{ __html: item.highlighted_sentence }}
                />

                {/* Source Paper Strip */}
                {paper && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingTop: '6px',
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {paper.title}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                        {paper.venue || 'Scholarly Venue'} &bull; {paper.year} &bull; {paper.citation_count} citations
                        {paper.is_review && ' (Survey Paper)'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedPaper(paper)}
                      >
                        <span>Paper Details</span>
                      </button>
                      {paper.landing_url && (
                        <a
                          href={paper.landing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-subtle btn-sm"
                          style={{ padding: '4px 8px' }}
                        >
                          <ExternalLink size={13} />
                          <span>Publisher</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paper Details Drawer */}
      <PaperDrawer
        paper={selectedPaper}
        isOpen={Boolean(selectedPaper)}
        onClose={() => setSelectedPaper(null)}
      />
    </div>
  );
}
