import React, { useState, useEffect } from 'react';
import { Bookmark, Trash2, ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export function SavedPage() {
  const [savedTopics, setSavedTopics] = useState([]);
  const [savedPapers, setSavedPapers] = useState([]);

  useEffect(() => {
    try {
      const topics = JSON.parse(localStorage.getItem('researchlens_saved_topics') || '[]');
      const papers = JSON.parse(localStorage.getItem('researchlens_saved_papers') || '[]');
      setSavedTopics(topics);
      setSavedPapers(papers);
    } catch {
      // fallback
    }
  }, []);

  const removeTopic = (id) => {
    const updated = savedTopics.filter((t) => t.id !== id);
    setSavedTopics(updated);
    localStorage.setItem('researchlens_saved_topics', JSON.stringify(updated));
  };

  const removePaper = (id) => {
    const updated = savedPapers.filter((p) => p.id !== id);
    setSavedPapers(updated);
    localStorage.setItem('researchlens_saved_papers', JSON.stringify(updated));
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-indigo)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>
          <Bookmark size={18} />
          <span>Personal Workspace</span>
        </div>
        <h1>Saved Topics & Bookmarks</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '8px' }}>
          Review saved research domains, candidate project directions, and bookmarked milestone papers.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        {/* Saved Topics */}
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Saved Research Topics</h2>
          {savedTopics.length === 0 ? (
            <div className="panel-subtle" style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                No saved topics yet. Analyze a domain and click "Save Topic" to bookmark it here.
              </p>
              <Link to="/" className="btn btn-primary btn-sm">
                Explore Domains
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {savedTopics.map((topic) => (
                <div key={topic.id} className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>{topic.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Saved on {new Date(topic.savedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <Link to={`/domain/${topic.id}/landscape`} className="btn btn-outline btn-sm">
                      <span>Open Landscape</span>
                      <ArrowRight size={14} />
                    </Link>
                    <button
                      className="btn btn-subtle btn-sm"
                      onClick={() => removeTopic(topic.id)}
                      title="Remove from saved"
                    >
                      <Trash2 size={14} color="var(--color-danger)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bookmarked Papers */}
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Bookmarked Papers</h2>
          {savedPapers.length === 0 ? (
            <div className="panel-subtle" style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                No bookmarked papers yet. Use the "Save" button on any paper card to save it for your literature review.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {savedPapers.map((paper) => (
                <div key={paper.id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>{paper.title}</h3>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>{paper.venue || 'Scholarly Venue'}</span>
                      <span>{paper.year}</span>
                      <span>{paper.citation_count} citations</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {paper.landing_url && (
                      <a
                        href={paper.landing_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm"
                        title="View Paper"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      className="btn btn-subtle btn-sm"
                      onClick={() => removePaper(paper.id)}
                      title="Remove bookmark"
                    >
                      <Trash2 size={14} color="var(--color-danger)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
