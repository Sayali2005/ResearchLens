import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Grid3X3, Sparkles, Filter, Eye, Check, X, ExternalLink, Bookmark, FileText, Copy } from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonTable, SkeletonCard } from '../../components/Skeleton';
import { PaperDrawer } from '../../components/PaperDrawer';

export function GapMapView() {
  const { domainId, domainOverview } = useOutletContext();
  const [gapData, setGapData] = useState(null);
  const [allApps, setAllApps] = useState([]);
  const [selectedApps, setSelectedApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' | 'table'
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellPapers, setCellPapers] = useState([]);
  const [isLoadingCellPapers, setIsLoadingCellPapers] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [copiedBibId, setCopiedBibId] = useState(null);
  const [savedGapKeys, setSavedGapKeys] = useState(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('researchlens_saved_gaps') || '[]');
      setSavedGapKeys(new Set(saved.map((g) => g.key)));
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [gaps, apps] = await Promise.all([
          api.getDomainGaps(domainId),
          api.getApplicationsConfig(),
        ]);

        // Normalize rows (sub-areas) and columns (applications)
        const rows = gaps.sub_areas || gaps.rows || [];
        const columns = gaps.applications || gaps.columns || [];
        const cells = gaps.cells || [];

        // Build 2D matrix if needed
        const cellGrid = {};
        cells.forEach((c) => {
          if (!cellGrid[c.topic_id]) cellGrid[c.topic_id] = {};
          cellGrid[c.topic_id][c.application_id] = c;
        });

        const matrix = rows.map((r) => {
          return columns.map((c) => {
            return cellGrid[r.id]?.[c.id] || null;
          });
        });

        setGapData({
          ...gaps,
          rows,
          columns,
          matrix,
          cells,
          top_opportunities: gaps.top_opportunities || [],
        });

        const initialApps = apps || columns || [];
        setAllApps(initialApps);
        setSelectedApps(initialApps.map((a) => a.id));
      } catch (err) {
        console.error('Failed to load gap data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [domainId]);

  const handleToggleApp = (appId) => {
    if (selectedApps.includes(appId)) {
      if (selectedApps.length > 2) {
        setSelectedApps(selectedApps.filter((id) => id !== appId));
      }
    } else {
      setSelectedApps([...selectedApps, appId]);
    }
  };

  const handleCellClick = async (topicId, topicName, appId, appName, cellInfo) => {
    setSelectedCell({ topicId, topicName, appId, appName, ...cellInfo });
    setIsLoadingCellPapers(true);
    try {
      const res = await api.getDomainPapers(domainId, { limit: 15 });
      setCellPapers(res.papers || []);
    } catch (err) {
      console.error('Failed to load cell papers:', err);
    } finally {
      setIsLoadingCellPapers(false);
    }
  };

  const handleSaveGap = (gap) => {
    const key = `${gap.topicId || gap.topic_id}_${gap.appId || gap.application_id}`;
    try {
      const existing = JSON.parse(localStorage.getItem('researchlens_saved_gaps') || '[]');
      if (!existing.some((g) => g.key === key)) {
        const item = {
          key,
          domainId,
          domainName: domainOverview?.name || domainId,
          topicId: gap.topicId || gap.topic_id,
          topicName: gap.topicName || gap.topic_name,
          appId: gap.appId || gap.application_id,
          appName: gap.appName || gap.application_name,
          observed: gap.observed,
          expected: gap.expected,
          ratio: gap.ratio,
          opportunity: gap.opportunity,
          z_score: gap.z_score,
          is_significant_void: gap.is_significant_void,
          savedAt: new Date().toISOString(),
        };
        existing.push(item);
        localStorage.setItem('researchlens_saved_gaps', JSON.stringify(existing));
        setSavedGapKeys(new Set([...savedGapKeys, key]));
      }
    } catch (err) {
      console.error('Failed to save gap:', err);
    }
  };

  const handleCopyBibtex = (paper) => {
    const firstAuthor = paper.authors && paper.authors[0]
      ? (typeof paper.authors[0] === 'string' ? paper.authors[0] : paper.authors[0].name).split(' ').pop().toLowerCase()
      : 'author';
    const year = paper.year || '2024';
    const key = `${firstAuthor}${year}${paper.id ? paper.id.slice(-4) : 'cite'}`;
    const authorNames = (paper.authors || []).map((a) => (typeof a === 'string' ? a : a.name)).join(', ');
    const bibtex = `@article{${key},
  title={${paper.title}},
  author={${authorNames}},
  journal={${paper.venue || 'ResearchLens Corpus'}},
  year={${year}},
  doi={${paper.doi || ''}}
}`;
    navigator.clipboard.writeText(bibtex);
    setCopiedBibId(paper.id);
    setTimeout(() => setCopiedBibId(null), 2000);
  };

  // ECharts Heatmap Configuration - Deep Gray -> Amber -> Emerald
  const getHeatmapOption = () => {
    if (!gapData || !gapData.matrix || !gapData.rows || !gapData.columns) return {};

    const filteredCols = gapData.columns.filter((c) => selectedApps.includes(c.id));
    const colIndices = filteredCols.map((c) => gapData.columns.findIndex((orig) => orig.id === c.id));
    const rowNames = gapData.rows.map((r) => r.name);
    const colNames = filteredCols.map((c) => c.name);

    // Format data as [colIndex, rowIndex, ratio, observed, expected, opp, z_score, is_void]
    const data = [];
    gapData.matrix.forEach((row, rIdx) => {
      colIndices.forEach((cOrigIdx, cNewIdx) => {
        const cell = row[cOrigIdx];
        if (cell) {
          data.push([
            cNewIdx,
            rIdx,
            Number(cell.ratio?.toFixed(2) || 0),
            cell.observed || 0,
            Number(cell.expected?.toFixed(1) || 0),
            Number(cell.opportunity?.toFixed(2) || 0),
            cell.z_score !== undefined ? cell.z_score : 0,
            Boolean(cell.is_significant_void),
          ]);
        }
      });
    });

    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        textStyle: { color: '#0F172A', fontSize: 12 },
        formatter: (params) => {
          const d = params.value;
          const colName = colNames[d[0]];
          const rowName = rowNames[d[1]];
          const ratio = d[2];
          const observed = d[3];
          const expected = d[4];
          const opp = d[5];
          const zScore = d[6];
          const isVoid = d[7];
          return `
            <div style="padding: 4px; font-family: var(--font-sans);">
              <div style="font-weight: 700; color: #0F172A; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">
                ${rowName} &times; ${colName}
              </div>
              <div style="color: #475569; font-size: 11px; line-height: 1.6;">
                Observed: <strong style="color: #0F172A;">${observed} papers</strong><br/>
                Expected: <strong style="color: #0F172A;">${expected} papers</strong><br/>
                Observed/Expected Ratio: <strong style="color: #0F172A;">${ratio}</strong><br/>
                Opportunity Score: <strong style="color: #D97706;">${(opp * 10).toFixed(1)} / 10</strong><br/>
                Poisson Significance Z-Score: <strong style="color: ${isVoid ? '#059669' : '#64748B'};">${zScore}</strong>
                ${isVoid ? '<span style="color: #059669; font-weight: 700; margin-left: 4px;">&bull; Empirical Research Void</span>' : ''}
              </div>
              <div style="margin-top: 8px; font-size: 10px; color: #2563EB; font-weight: 600;">
                Click cell to inspect matching literature &rarr;
              </div>
            </div>
          `;
        },
      },
      grid: {
        top: 20,
        left: '20%',
        right: '4%',
        bottom: '20%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: colNames,
        axisLabel: {
          rotate: 35,
          color: '#334155',
          fontSize: 11,
          fontWeight: 600,
          interval: 0,
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['#FFFFFF', '#F8FAFC'],
          },
        },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
      },
      yAxis: {
        type: 'category',
        data: rowNames,
        axisLabel: {
          color: '#334155',
          fontSize: 11,
          fontWeight: 600,
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['#FFFFFF', '#F8FAFC'],
          },
        },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
      },
      visualMap: {
        min: 0,
        max: 2.2,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          // Color scale: Crisp Gray -> Amber Gap -> Emerald Saturated
          color: ['#E2E8F0', '#FDE68A', '#059669'],
        },
        text: ['Saturated', 'High Opportunity Gap'],
        textStyle: { color: '#475569', fontSize: 11, fontWeight: 600 },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            formatter: (p) => p.value[3], // Show observed count inside cell
            color: '#0F172A',
            fontSize: 10,
            fontWeight: 700,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 14,
              shadowColor: 'rgba(0, 0, 0, 0.6)',
              borderColor: '#6366F1',
              borderWidth: 2,
            },
          },
        },
      ],
    };
  };

  const onChartClick = (params) => {
    if (params.componentType === 'series' && params.data) {
      const d = params.data;
      const filteredCols = gapData.columns.filter((c) => selectedApps.includes(c.id));
      const app = filteredCols[d[0]];
      const topic = gapData.rows[d[1]];
      if (app && topic) {
        handleCellClick(topic.id, topic.name, app.id, app.name, {
          observed: d[3],
          expected: d[4],
          ratio: d[2],
          opportunity: d[5],
          z_score: d[6],
          is_significant_void: d[7],
        });
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Cross-Disciplinary Gap Heatmap</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Statistical cross-matrix of sub-areas vs. 12 real-world application domains. Cells with Poisson significance Z-score &lt; -2.0 identify statistically validated empirical research voids.
        </p>
      </div>

      {isLoading ? (
        <SkeletonTable rows={12} cols={8} />
      ) : (
        <>
          {/* Top Opportunities Carousel Strip */}
          <div className="panel">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--color-warning)" />
              <span>Top Candidate Opportunities</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {(gapData?.top_opportunities || []).slice(0, 4).map((opp, idx) => {
                const key = `${opp.topic_id}_${opp.application_id}`;
                const isSaved = savedGapKeys.has(key);
                return (
                  <div
                    key={idx}
                    className="panel-subtle"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    }}
                    onClick={() =>
                      handleCellClick(opp.topic_id, opp.topic_name, opp.application_id, opp.application_name, {
                        observed: opp.observed,
                        expected: opp.expected,
                        ratio: opp.ratio,
                        opportunity: opp.opportunity,
                        z_score: opp.z_score,
                        is_significant_void: opp.is_significant_void,
                      })
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-indigo)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-heading)' }}>
                        {opp.topic_name}
                      </div>
                      <button
                        className="btn btn-subtle btn-sm"
                        style={{ padding: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveGap(opp);
                        }}
                        title={isSaved ? 'Saved to Dossier' : 'Save to Dossier'}
                      >
                        <Bookmark size={14} color={isSaved ? 'var(--color-warning)' : 'var(--text-muted)'} />
                      </button>
                    </div>

                    <div style={{ fontSize: '0.825rem', color: 'var(--accent-indigo)', fontWeight: 500, marginTop: '2px' }}>
                      in {opp.application_name}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>Observed: <strong style={{ color: '#FFFFFF' }}>{opp.observed}</strong></span>
                      <span>Expected: <strong style={{ color: '#FFFFFF' }}>{opp.expected.toFixed(1)}</strong></span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.725rem' }}>Ratio: {opp.ratio.toFixed(2)}</span>
                      {opp.z_score !== undefined && (
                        <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
                          Z: {opp.z_score}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                        Score: {(opp.opportunity * 10).toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Application Filters & View Mode Bar */}
          <div className="panel" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="var(--text-secondary)" />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Filter Application Domains:</span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setViewMode(viewMode === 'heatmap' ? 'table' : 'heatmap')}
                >
                  <Eye size={14} />
                  <span>{viewMode === 'heatmap' ? 'View as Table' : 'View as Heatmap'}</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {allApps.map((app) => {
                const isSelected = selectedApps.includes(app.id);
                return (
                  <button
                    key={app.id}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '0.8rem', borderRadius: 'var(--radius-full)' }}
                    onClick={() => handleToggleApp(app.id)}
                  >
                    {isSelected && <Check size={12} />}
                    <span>{app.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Heatmap or Table */}
          <div className="panel">
            {viewMode === 'heatmap' ? (
              <div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>ECharts Statistical Heatmap &bull; Color: Deep Gray (Void) &rarr; Amber (Opportunity) &rarr; Emerald (Saturated)</span>
                  <span>Click cell to inspect papers in modal</span>
                </div>
                <ReactECharts
                  option={getHeatmapOption()}
                  style={{ height: '560px', width: '100%' }}
                  onEvents={{ click: onChartClick }}
                />
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, zIndex: 10 }}>Sub-Area</th>
                      {gapData?.columns
                        ?.filter((c) => selectedApps.includes(c.id))
                        .map((col) => (
                          <th key={col.id} style={{ whiteSpace: 'nowrap' }}>{col.name}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gapData?.rows?.map((row, rIdx) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 600, position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'rgba(15, 23, 42, 0.95)' }}>
                          {row.name}
                        </td>
                        {gapData?.columns
                          ?.filter((c) => selectedApps.includes(c.id))
                          .map((col) => {
                            const cOrigIdx = gapData.columns.findIndex((orig) => orig.id === col.id);
                            const cell = gapData.matrix[rIdx]?.[cOrigIdx];
                            return (
                              <td
                                key={col.id}
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  cursor: 'pointer',
                                  backgroundColor: cell && cell.ratio < 0.6 ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                }}
                                onClick={() =>
                                  cell &&
                                  handleCellClick(row.id, row.name, col.id, col.name, {
                                    observed: cell.observed,
                                    expected: cell.expected,
                                    ratio: cell.ratio,
                                    opportunity: cell.opportunity,
                                    z_score: cell.z_score,
                                    is_significant_void: cell.is_significant_void,
                                  })
                                }
                              >
                                {cell ? `${cell.observed} (E:${cell.expected?.toFixed(0)})` : '-'}
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Selected Cell Papers Modal */}
      {selectedCell && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '760px',
              maxHeight: '84vh',
              overflowY: 'auto',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="badge badge-indigo">Intersection Literature</span>
                  {selectedCell.is_significant_void && (
                    <span className="badge badge-emerging">Empirical Void (Z &lt; -2.0)</span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.25rem', color: '#0F172A' }}>
                  {selectedCell.topicName} &times; {selectedCell.appName}
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                  Observed: <strong style={{ color: '#0F172A' }}>{selectedCell.observed}</strong> |
                  Expected: <strong style={{ color: '#0F172A' }}>{selectedCell.expected}</strong> |
                  Ratio: <strong style={{ color: '#0F172A' }}>{selectedCell.ratio}</strong> |
                  Opportunity Score: <strong style={{ color: '#D97706' }}>{(selectedCell.opportunity * 10).toFixed(1)}/10</strong>
                  {selectedCell.z_score !== undefined && (
                    <span> | Poisson Z-Score: <strong style={{ color: '#059669' }}>{selectedCell.z_score}</strong></span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleSaveGap(selectedCell)}
                  title="Bookmark to Project Basket"
                >
                  <Bookmark size={14} color={savedGapKeys.has(`${selectedCell.topicId}_${selectedCell.appId}`) ? 'var(--color-warning)' : 'currentColor'} />
                  <span>{savedGapKeys.has(`${selectedCell.topicId}_${selectedCell.appId}`) ? 'Saved' : 'Save Gap'}</span>
                </button>
                <button className="btn btn-subtle btn-sm" onClick={() => setSelectedCell(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {isLoadingCellPapers ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <SkeletonCard />
              </div>
            ) : cellPapers.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                No papers found in this intersection. This highlights a pure empirical void for new research!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cellPapers.slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    className="panel-subtle"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.925rem', color: '#0F172A' }}>{p.title}</div>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => setSelectedPaper(p)}
                      >
                        Inspect
                      </button>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>{p.venue || 'Corpus'}</span> &bull; <span>{p.year}</span> &bull; <span>{p.citation_count?.toLocaleString() || 0} citations</span>
                    </div>

                    {/* 1-Click Direct Links */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {p.pdf_url && (
                        <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className="btn-pdf">
                          <FileText size={11} />
                          <span>PDF</span>
                        </a>
                      )}
                      {p.doi && (
                        <a href={p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" className="btn-doi">
                          <ExternalLink size={11} />
                          <span>DOI</span>
                        </a>
                      )}
                      {p.arxiv_id && (
                        <a href={`https://arxiv.org/abs/${p.arxiv_id}`} target="_blank" rel="noopener noreferrer" className="btn-arxiv">
                          <span>⚛️ arXiv</span>
                        </a>
                      )}
                      <button
                        className="btn btn-subtle btn-sm"
                        onClick={() => handleCopyBibtex(p)}
                        title="Copy BibTeX Citation"
                      >
                        {copiedBibId === p.id ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                        <span>{copiedBibId === p.id ? 'Copied' : 'BibTeX'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
