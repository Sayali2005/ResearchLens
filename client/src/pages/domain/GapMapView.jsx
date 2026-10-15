import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Grid3X3, Sparkles, Filter, Eye, Check, X, ExternalLink, Bookmark } from 'lucide-react';
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

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [gaps, apps] = await Promise.all([
          api.getDomainGaps(domainId),
          api.getApplicationsConfig(),
        ]);
        setGapData(gaps);
        setAllApps(apps || []);
        setSelectedApps((apps || []).map((a) => a.id));
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
      // Find papers for domain matching this topic and app
      const res = await api.getDomainPapers(domainId, { limit: 15 });
      setCellPapers(res.papers || []);
    } catch (err) {
      console.error('Failed to load cell papers:', err);
    } finally {
      setIsLoadingCellPapers(false);
    }
  };

  // ECharts Heatmap Configuration
  const getHeatmapOption = () => {
    if (!gapData || !gapData.matrix || !gapData.rows || !gapData.columns) return {};

    const filteredCols = gapData.columns.filter((c) => selectedApps.includes(c.id));
    const colIndices = filteredCols.map((c) => gapData.columns.findIndex((orig) => orig.id === c.id));
    const rowNames = gapData.rows.map((r) => r.name);
    const colNames = filteredCols.map((c) => c.name);

    // Format data as [colIndex, rowIndex, ratio, observed, expected, opp]
    const data = [];
    gapData.matrix.forEach((row, rIdx) => {
      colIndices.forEach((cOrigIdx, cNewIdx) => {
        const cell = row[cOrigIdx];
        if (cell) {
          data.push([
            cNewIdx,
            rIdx,
            Number(cell.ratio.toFixed(2)),
            cell.observed,
            Number(cell.expected.toFixed(1)),
            Number(cell.opportunity.toFixed(2)),
          ]);
        }
      });
    });

    return {
      tooltip: {
        position: 'top',
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        formatter: (params) => {
          const d = params.value;
          const colName = colNames[d[0]];
          const rowName = rowNames[d[1]];
          return `<strong>${rowName} &times; ${colName}</strong><br/>
            Observed publications: <strong>${d[3]}</strong><br/>
            Expected volume: <strong>${d[4]}</strong><br/>
            Observed/Expected ratio: <strong>${d[2]}</strong><br/>
            Opportunity score: <strong>${d[5]}</strong><br/>
            <span style="font-size: 11px; color: #4F46E5;">Click cell to view papers</span>`;
        },
      },
      grid: {
        top: 20,
        left: '20%',
        right: '4%',
        bottom: '22%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: colNames,
        axisLabel: {
          rotate: 35,
          color: '#4B5563',
          fontSize: 11,
          interval: 0,
        },
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: rowNames,
        axisLabel: {
          color: '#374151',
          fontSize: 11,
        },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: 2.0,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#DCFCE7', '#FEF08A', '#FEE2E2'], // Green (Low ratio/gap) -> Yellow -> Red (Saturated)
        },
        text: ['Saturated', 'High Gap'],
        textStyle: { color: '#6B7280', fontSize: 11 },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            formatter: (p) => p.value[3], // Show observed count inside cell
            color: '#1F2937',
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.25)',
              borderColor: '#4F46E5',
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
        });
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>Cross-Disciplinary Gap Heatmap</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Statistical cross-matrix of sub-areas vs. 12 real-world application domains. Cells with low observed-to-expected ratios and high statistical support indicate candidate literature gaps.
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {(gapData?.top_opportunities || []).slice(0, 4).map((opp, idx) => (
                <div
                  key={idx}
                  className="panel-subtle"
                  style={{ cursor: 'pointer', transition: 'border-color 0.15s ease' }}
                  onClick={() =>
                    handleCellClick(opp.topic_id, opp.topic_name, opp.application_id, opp.application_name, {
                      observed: opp.observed,
                      expected: opp.expected,
                      ratio: opp.ratio,
                      opportunity: opp.opportunity,
                    })
                  }
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-indigo)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-heading)' }}>
                    {opp.topic_name}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--accent-indigo)', fontWeight: 500, marginTop: '2px' }}>
                    in {opp.application_name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Observed: <strong>{opp.observed}</strong></span>
                    <span>Expected: <strong>{opp.expected.toFixed(1)}</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span className="badge badge-warning" style={{ fontSize: '0.725rem' }}>Ratio: {opp.ratio.toFixed(2)}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                      Score: {opp.opportunity.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
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
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'right' }}>
                  Numbers indicate observed publication count. Click cell to open papers.
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
                      <th style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-subtle)', zIndex: 10 }}>Sub-Area</th>
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
                        <td style={{ fontWeight: 600, position: 'sticky', left: 0, backgroundColor: '#FFFFFF', zIndex: 5 }}>
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
                                  backgroundColor: cell && cell.ratio < 0.6 ? '#ECFDF5' : 'transparent',
                                }}
                                onClick={() =>
                                  cell &&
                                  handleCellClick(row.id, row.name, col.id, col.name, {
                                    observed: cell.observed,
                                    expected: cell.expected,
                                    ratio: cell.ratio,
                                    opportunity: cell.opportunity,
                                  })
                                }
                              >
                                {cell ? `${cell.observed} (E:${cell.expected.toFixed(0)})` : '-'}
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

      {/* Selected Cell Papers Modal / Drawer */}
      {selectedCell && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
              maxWidth: '720px',
              maxHeight: '80vh',
              overflowY: 'auto',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-indigo" style={{ marginBottom: '6px' }}>Cell Papers Explorer</span>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-heading)' }}>
                  {selectedCell.topicName} &times; {selectedCell.appName}
                </h3>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Observed: <strong>{selectedCell.observed}</strong> | Expected: <strong>{selectedCell.expected}</strong> | Ratio: <strong>{selectedCell.ratio}</strong> | Opp: <strong>{selectedCell.opportunity}</strong>
                </div>
              </div>
              <button className="btn btn-subtle btn-sm" onClick={() => setSelectedCell(null)}>
                <X size={18} />
              </button>
            </div>

            {isLoadingCellPapers ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <SkeletonCard />
              </div>
            ) : cellPapers.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No literature indexed for this specific cell in the local cache.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cellPapers.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className="panel-subtle"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.title}</div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        {p.venue} &bull; {p.year} &bull; {p.citation_count} citations
                      </div>
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setSelectedPaper(p)}
                    >
                      <span>Details</span>
                    </button>
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
