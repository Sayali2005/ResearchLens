import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Layers, TrendingUp, Compass, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api/client';

const POPULAR_DOMAINS = [
  'Machine Learning',
  'Deep Learning',
  'Natural Language Processing',
  'Computer Vision',
  'Cybersecurity',
  'Internet of Things',
  'Data Science',
];

export function HomePage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Debounced suggestion fetch
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await api.suggestDomains(query);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        // silently ignore suggestion errors
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDomain = async (domainName) => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const job = await api.startAnalysis(domainName);
      if (job && job.domain_id) {
        navigate(`/domain/${encodeURIComponent(job.domain_id)}/landscape`, {
          state: { jobId: job.job_id, domainName: domainName, initialJob: job },
        });
      } else {
        setErrorMsg('Failed to initialize domain analysis. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error starting domain analysis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      handleSelectDomain(query.trim());
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '60px 24px 80px' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--accent-indigo-light)',
            color: 'var(--accent-indigo)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.825rem',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          <Sparkles size={14} />
          <span>Deterministic Research Analytics & Gap Discovery</span>
        </div>

        <h1 style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '14px', letterSpacing: '-0.02em' }}>
          Explore Research Landscapes & Spot Open Literature Gaps
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto' }}>
          Evaluate sub-area publication trajectories, detect under-explored application intersections, and synthesize project directions backed by real scholarly databases.
        </p>
      </div>

      {/* Large Search Box */}
      <div style={{ position: 'relative', marginBottom: '24px' }} ref={dropdownRef}>
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '6px 8px 6px 16px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'border-color 0.15s ease',
            }}
          >
            <Search size={22} color="var(--text-secondary)" style={{ marginRight: '12px' }} />
            <input
              type="text"
              placeholder="Enter a research domain (e.g. Computer Vision, Machine Learning, NLP)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '1.05rem',
                color: 'var(--text-main)',
              }}
              disabled={isSubmitting}
            />
            {isLoadingSuggestions && (
              <Loader2 size={18} className="spin" color="var(--text-muted)" style={{ marginRight: '10px' }} />
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.95rem' }}
              disabled={isSubmitting || !query.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Analyze Domain</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Autocomplete Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-hover)',
              marginTop: '6px',
              zIndex: 50,
              maxHeight: '280px',
              overflowY: 'auto',
            }}
          >
            {suggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setQuery(item.name);
                  setShowDropdown(false);
                  handleSelectDomain(item.name);
                }}
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-light)',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.name}</div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {item.field_name || item.subfield_name || 'Academic Field'}
                  </div>
                </div>
                <span className="badge badge-stable" style={{ fontSize: '0.75rem' }}>
                  {item.works_count ? `${item.works_count.toLocaleString()} papers` : 'Topic'}
                </span>
              </div>
            ))}
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Popular Domain Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '56px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Popular Domains:
        </span>
        {POPULAR_DOMAINS.map((domain) => (
          <button
            key={domain}
            className="btn btn-subtle btn-sm"
            onClick={() => handleSelectDomain(domain)}
            disabled={isSubmitting}
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            {domain}
          </button>
        ))}
      </div>

      {/* Three-step How It Works Strip */}
      <div style={{ marginBottom: '56px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', textAlign: 'center' }}>
          How ResearchLens Works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-indigo-light)',
                color: 'var(--accent-indigo)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={20} />
            </div>
            <h3 style={{ fontSize: '1.05rem' }}>1. Choose a Research Field</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Resolve your topic against open academic ontologies to extract top sub-areas, yearly publication counts, and multi-year trajectory labels.
            </p>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={20} />
            </div>
            <h3 style={{ fontSize: '1.05rem' }}>2. Detect Statistical Gaps</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Cross-reference sub-areas with 12 real-world application domains in an observed vs. expected matrix to surface under-studied research opportunities.
            </p>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-warning-bg)',
                color: 'var(--color-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={20} />
            </div>
            <h3 style={{ fontSize: '1.05rem' }}>3. Formulate & Plan Projects</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Access vetted quality-scored papers, extract documented limitation sentences from recent surveys, and follow an ordered 3-stage reading roadmap.
            </p>
          </div>
        </div>
      </div>

      {/* Honest Disclaimer Box */}
      <div className="disclaimer-box">
        <AlertCircle size={20} color="var(--text-muted)" style={{ minWidth: '20px', marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '2px' }}>
            Methodological Notice
          </div>
          <div>
            Candidate research gaps and opportunity scores are derived deterministically from publication volume and keyword co-occurrence models across OpenAlex, Semantic Scholar, and arXiv. A low publication count may reflect impractical constraints as well as high-value open niches. Always evaluate linked papers and feasibility before finalizing your thesis or project topic.
          </div>
        </div>
      </div>
    </div>
  );
}
