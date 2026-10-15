import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  FileText,
  Filter,
  Award,
  Shield,
  Bookmark,
  ExternalLink,
  Download,
  Copy,
  Check,
  TrendingUp,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonCard, SkeletonMetric } from '../../components/Skeleton';
import { PaperDrawer } from '../../components/PaperDrawer';

export function PapersView() {
  const { domainId, domainOverview } = useOutletContext();

  const [papers, setPapers] = useState([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Filter States
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [minCitations, setMinCitations] = useState(0);
  const [venueTier, setVenueTier] = useState('all');
  const [instGroup, setInstGroup] = useState('all');
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [paperType, setPaperType] = useState('all');
  const [sortOption, setSortOption] = useState('quality');

  // Summary Metrics
  const [summaryMeta, setSummaryMeta] = useState({
    mostUsedMethod: 'Convolutional Neural Networks',
    biggestGap: 'Agriculture & Farming',
    mostCitedPaper: null,
  });

  const loadPapers = async () => {
    setIsLoading(true);
    try {
      const filters = {
        limit: 25,
        sort: sortOption,
        min_citations: minCitations > 0 ? minCitations : undefined,
        venue_tier: venueTier !== 'all' ? venueTier : undefined,
        institution_group: instGroup !== 'all' ? instGroup : undefined,
        open_access: openAccessOnly ? true : undefined,
        type: paperType !== 'all' ? paperType : undefined,
        year_from: yearFrom ? parseInt(yearFrom, 10) : undefined,
        year_to: yearTo ? parseInt(yearTo, 10) : undefined,
      };

      const res = await api.getDomainPapers(domainId, filters);
      const list = res.papers || [];
      setPapers(list);
      setTotalPapers(res.total || list.length);

      if (list.length > 0) {
        const topCited = [...list].sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0))[0];
        setSummaryMeta((prev) => ({
          ...prev,
          mostCitedPaper: topCited,
        }));
      }
    } catch (err) {
      console.error('Failed to load domain papers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, [domainId]);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    loadPapers();
  };

  const handleSavePaper = (paper) => {
    try {
      const existing = JSON.parse(localStorage.getItem('researchlens_saved_papers') || '[]');
      if (!existing.some((p) => p.id === paper.id)) {
        existing.push(paper);
        localStorage.setItem('researchlens_saved_papers', JSON.stringify(existing));
        alert('Paper bookmarked to Saved tab!');
      } else {
        alert('Paper is already bookmarked.');
      }
    } catch {
      // fallback
    }
  };

  const handleExportCitation = (paper) => {
    const authorNames = (paper.authors || []).map((a) => a.name).join(', ') || 'Unknown Authors';
    const bibtex = `@article{${paper.id ? paper.id.slice(-6) : 'cite'},
  title={${paper.title}},
  author={${authorNames}},
  journal={${paper.venue || 'ResearchLens Corpus'}},
  year={${paper.year || '2024'}}
}`;
    navigator.clipboard.writeText(bibtex);
    setCopiedId(paper.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ECharts Scatter of Citations by Year
  const getScatterOption = () => {
    const data = papers.map((p) => [p.year || 2024, p.citation_count || 0, p.title]);
    return {
      tooltip: {
        formatter: (params) => {
          const d = params.value;
          return `<strong>${d[2]}</strong><br/>Year: ${d[0]} &bull; Citations: ${d[1]}`;
        },
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        textStyle: { fontSize: 11, color: '#111827' },
      },
      grid: {
        top: 15,
        left: '12%',
        right: '8%',
        bottom: '18%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        min: 'dataMin',
        max: 'dataMax',
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLabel: { color: '#6B7280', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLabel: { color: '#6B7280', fontSize: 10 },
      },
      series: [
        {
          type: 'scatter',
          data,
          symbolSize: 8,
          itemStyle: { color: '#4F46E5', opacity: 0.75 },
        },
      ],
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>Paper Extraction Analysis</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Quality-ranked literature corpus for {domainOverview?.domain_name || domainId} with limitation extraction and authority stratification.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: '24px', alignItems: 'flex-start' }}>
        {/* Left Filter Panel */}
        <div className="panel" style={{ position: 'sticky', top: '80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Filter size={16} color="var(--accent-indigo)" />
            <h3 style={{ fontSize: '1rem' }}>Filter Papers</h3>
          </div>

          <form onSubmit={handleApplyFilters} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Year Range */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Publication Year Range
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  placeholder="From"
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  style={{ width: '50%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
                />
                <input
                  type="number"
                  placeholder="To"
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  style={{ width: '50%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Min Citations */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Minimum Citations: {minCitations}
              </label>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={minCitations}
                onChange={(e) => setMinCitations(parseInt(e.target.value, 10))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Venue Tier */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Venue Tier
              </label>
              <select
                value={venueTier}
                onChange={(e) => setVenueTier(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
              >
                <option value="all">All Venues</option>
                <option value="tier_1">Tier 1 (Flagship / Trans.)</option>
                <option value="tier_2">Tier 2</option>
                <option value="tier_3">Tier 3</option>
                <option value="preprint">Preprints</option>
              </select>
            </div>

            {/* Institution Group */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Institution Group
              </label>
              <select
                value={instGroup}
                onChange={(e) => setInstGroup(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
              >
                <option value="all">All Institutions</option>
                <option value="group_a">Group A (Global Elite)</option>
                <option value="group_b">Group B (Top Indian Labs)</option>
                <option value="group_c">Group C (Industry AI Labs)</option>
              </select>
            </div>

            {/* Paper Type */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Paper Type
              </label>
              <select
                value={paperType}
                onChange={(e) => setPaperType(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
              >
                <option value="all">All Types</option>
                <option value="article">Journal / Conference Article</option>
                <option value="review">Survey / Review</option>
                <option value="preprint">Preprint</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Sort By
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
              >
                <option value="quality">Quality Score (Recommended)</option>
                <option value="citations">Citations (Highest First)</option>
                <option value="recency">Recency (Newest First)</option>
              </select>
            </div>

            {/* Open Access Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="oa_check"
                checked={openAccessOnly}
                onChange={(e) => setOpenAccessOnly(e.target.checked)}
              />
              <label htmlFor="oa_check" style={{ fontSize: '0.825rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                Open Access Only
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}>
              Apply Changes
            </button>
          </form>
        </div>

        {/* Middle: Papers List Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <span>Showing <strong>{papers.length}</strong> publications</span>
            <span style={{ fontSize: '0.8rem' }}>Fairness whitelist policy active</span>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : papers.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No papers match the specified filter criteria.</p>
            </div>
          ) : (
            papers.map((paper, idx) => {
              const quality = paper.quality || {};
              const authors = (paper.authors || []).slice(0, 3).map((a) => a.name).join(', ');
              const limitation = paper.limitation_callout;
              const instNames = (paper.authors || [])
                .flatMap((a) => (a.institutions || []).map((i) => i.name))
                .filter(Boolean)
                .slice(0, 2)
                .join(', ');

              return (
                <div key={paper.id} className="panel" style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                  {/* Left Number Spine */}
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      paddingRight: '12px',
                      borderRight: '2px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <span>#{idx + 1}</span>
                  </div>

                  {/* Card Content */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Header line with title and badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          {quality.is_top_venue && (
                            <span className="badge badge-indigo">
                              <Award size={12} />
                              <span>Top Venue</span>
                            </span>
                          )}
                          {paper.type === 'review' && (
                            <span className="badge badge-warning">Survey</span>
                          )}
                          {paper.is_open_access && (
                            <span className="badge badge-emerging">Open Access</span>
                          )}
                        </div>
                        <h3 style={{ fontSize: '1.05rem', lineHeight: 1.35, color: 'var(--text-heading)' }}>
                          {paper.title}
                        </h3>
                        <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {authors || 'Unknown Authors'}
                        </div>
                      </div>
                    </div>

                    {/* Meta Strip */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span><strong>Venue:</strong> {paper.venue || 'N/A'}</span>
                      <span><strong>Year:</strong> {paper.year || 'N/A'}</span>
                      <span><strong>Citations:</strong> {paper.citation_count?.toLocaleString() || 0}</span>
                      {instNames && <span><strong>Affiliation:</strong> {instNames}</span>}
                    </div>

                    {/* Detected Limitations Callout */}
                    {limitation && (
                      <div
                        style={{
                          backgroundColor: 'var(--color-success-bg)',
                          border: '1px solid var(--color-success-border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                          fontSize: '0.825rem',
                          color: 'var(--text-main)',
                          marginTop: '4px',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Limitations and Future Scope:</span>
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: limitation.highlighted_sentence }} />
                      </div>
                    )}

                    {/* Card Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedPaper(paper)}
                      >
                        <span>View details</span>
                      </button>
                      <button
                        className="btn btn-subtle btn-sm"
                        onClick={() => handleExportCitation(paper)}
                        title="Copy BibTeX Citation"
                      >
                        {copiedId === paper.id ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                        <span>{copiedId === paper.id ? 'Copied' : 'Export citation'}</span>
                      </button>
                      <button
                        className="btn btn-subtle btn-sm"
                        onClick={() => handleSavePaper(paper)}
                        title="Bookmark paper"
                      >
                        <Bookmark size={13} />
                        <span>Save</span>
                      </button>
                      {paper.landing_url && (
                        <a
                          href={paper.landing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-subtle btn-sm"
                          style={{ marginLeft: 'auto' }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Summary Panel (Light Tokens) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '80px' }}>
          {/* Scatter Chart */}
          <div className="panel" style={{ padding: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-heading)' }}>
              Citations vs. Year Distribution
            </h4>
            <ReactECharts option={getScatterOption()} style={{ height: '160px', width: '100%' }} />
          </div>

          {/* Quick Metrics */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Dominant Methodology
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={15} color="var(--accent-indigo)" />
                <span>Convolutional Networks / ViT</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Highest Opportunity Gap
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="var(--color-warning)" />
                <span>Agriculture & Medicine</span>
              </div>
            </div>

            {summaryMeta.mostCitedPaper && (
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Most-Cited Paper in Corpus
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '2px', lineHeight: 1.3 }}>
                  {summaryMeta.mostCitedPaper.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {summaryMeta.mostCitedPaper.citation_count?.toLocaleString()} citations &bull; {summaryMeta.mostCitedPaper.year}
                </div>
              </div>
            )}

            <button
              className="btn btn-outline btn-sm"
              style={{ width: '100%', marginTop: '4px' }}
              onClick={() => {
                const blob = new Blob([JSON.stringify(papers, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `papers_${domainId}.json`;
                a.click();
              }}
            >
              <Download size={14} />
              <span>Export Topic Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Paper Detail Drawer */}
      <PaperDrawer
        paper={selectedPaper}
        isOpen={Boolean(selectedPaper)}
        onClose={() => setSelectedPaper(null)}
        onSave={handleSavePaper}
      />
    </div>
  );
}
