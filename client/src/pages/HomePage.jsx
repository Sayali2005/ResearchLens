import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Layers, TrendingUp, Compass, ArrowRight, AlertCircle, Loader2, BookOpen, Database, BarChart3 } from 'lucide-react';
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
    <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '50px 24px 80px' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE',
            padding: '5px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.825rem',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          <Sparkles size={14} color="#2563EB" />
          <span>Technical Scholarly Analytics & Deterministic Gap Discovery</span>
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '14px', letterSpacing: '-0.025em' }}>
          Explore Research Landscapes & Spot Literature Gaps
        </h1>

        <p style={{ fontSize: '1.085rem', color: '#475569', maxWidth: '720px', margin: '0 auto', lineHeight: 1.6 }}>
          Analyze 10-year publication trajectories across 250M+ peer-reviewed papers, detect under-explored application intersections with Poisson statistics, and synthesize thesis roadmaps.
        </p>
      </div>

      {/* Large Technical Search Box */}
      <div style={{ position: 'relative', marginBottom: '20px' }} ref={dropdownRef}>
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              border: '2px solid #2563EB',
              borderRadius: 'var(--radius-lg)',
              padding: '8px 10px 8px 18px',
              boxShadow: '0 4px 20px -2px rgba(37, 99, 235, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.2s ease',
            }}
          >
            <Search size={22} color="#2563EB" style={{ marginRight: '14px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Enter a research domain (e.g. Computer Vision, Machine Learning, NLP, Robotics)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '1.05rem',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontWeight: 600,
              }}
              disabled={isSubmitting}
            />
            {isLoadingSuggestions && (
              <Loader2 size={18} className="spin" color="#2563EB" style={{ marginRight: '10px' }} />
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.95rem', borderRadius: 'var(--radius-md)' }}
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
              border: '1px solid #CBD5E1',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 16px 32px rgba(0, 0, 0, 0.12)',
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
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F1F5F9',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.name}</div>
                  <div style={{ fontSize: '0.775rem', color: '#64748B' }}>
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
              backgroundColor: '#FEF2F2',
              color: '#B91C1C',
              border: '1px solid #FECACA',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Popular Domain Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '40px' }}>
        <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
          Popular Domains:
        </span>
        {POPULAR_DOMAINS.map((domain) => (
          <button
            key={domain}
            className="btn btn-outline btn-sm"
            onClick={() => handleSelectDomain(domain)}
            disabled={isSubmitting}
            style={{ borderRadius: 'var(--radius-full)', backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#1E293B' }}
          >
            {domain}
          </button>
        ))}
      </div>

      {/* Hero Knowledge Graph & Discovery Radar Showcase */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '56px', border: '1px solid #CBD5E1', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1E3A8A', marginLeft: '6px' }}>
              ResearchLens Multi-Layer Scholarly Intelligence
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span className="badge badge-indigo">OpenAlex &bull; arXiv &bull; Semantic Scholar</span>
            <span className="badge badge-emerging">Real-Time Radar</span>
          </div>
        </div>
        <img
          src="/images/research_hero_banner.jpg"
          alt="ResearchLens Scholarly Knowledge Graph, Citation Growth, and Research Radar"
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '420px', objectFit: 'cover' }}
        />
      </div>

      {/* Three-step How It Works Strip */}
      <div style={{ marginBottom: '48px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
            How ResearchLens Operates Under the Hood
          </h2>
          <p style={{ fontSize: '0.925rem', color: '#64748B' }}>
            Fully deterministic calculations, rigorous statistical matrix tests, and 1-click access to primary literature.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '3px solid #2563EB' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', color: '#0F172A' }}>1. Macro Trajectory & Taxonomy</h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.55 }}>
              Aggregates 10-year historical distributions across 2M+ publications. Computes 3-year CAGR and maps sub-areas into <em>Emerging Stars</em>, <em>Established Giants</em>, and <em>Niche Opportunities</em>.
            </p>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '3px solid #059669' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', color: '#0F172A' }}>2. Poisson Gap Matrix</h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.55 }}>
              Evaluates sub-areas against 12 real-world application domains. Computes Poisson Z-Scores ($Z &lt; -2.0$) to prove empirical voids with statistical rigor, filtering out random variance.
            </p>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '3px solid #D97706' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#FFFBEB',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', color: '#0F172A' }}>3. Curated Corpus & 1-Click Access</h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.55 }}>
              Harvests top 100–300 deduplicated papers with multi-factor quality scores, direct Open-Access PDF links, canonical DOIs, arXiv preprints, and LaTeX/BibTeX citation generator.
            </p>
          </div>
        </div>
      </div>

      {/* End-to-End Pipeline Schematic Image */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '48px', border: '1px solid #CBD5E1' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} color="#2563EB" />
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1E3A8A' }}>
              TECHNICAL DATA HARVESTING & STATISTICAL ANALYTICS PIPELINE
            </span>
          </div>
          <span className="badge badge-stable" style={{ fontSize: '0.725rem' }}>
            OpenAlex + arXiv + Semantic Scholar
          </span>
        </div>
        <img
          src="/images/pipeline_architecture.jpg"
          alt="ResearchLens Academic Data Extraction & Statistical Pipeline"
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '420px', objectFit: 'contain', background: '#FFFFFF', padding: '12px' }}
        />
      </div>

      {/* Methodological Notice */}
      <div className="disclaimer-box">
        <AlertCircle size={20} color="#2563EB" style={{ minWidth: '20px', marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
            Scientific Methodological Guarantee
          </div>
          <div style={{ lineHeight: 1.55 }}>
            Candidate research gaps and opportunity scores are derived deterministically from publication volume and keyword co-occurrence models across OpenAlex, Semantic Scholar, and arXiv. A low publication count may reflect impractical constraints as well as high-value open niches. Always evaluate linked papers and feasibility before finalizing your thesis or project topic.
          </div>
        </div>
      </div>
    </div>
  );
}
