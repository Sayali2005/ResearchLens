import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, Table, BarChart2, Circle, ArrowUpDown, Eye, Compass, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonTable } from '../../components/Skeleton';

export function TrendsView() {
  const { domainId, domainOverview } = useOutletContext();
  const [trends, setTrends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewModeLine, setViewModeLine] = useState('chart'); // 'chart' | 'table'
  const [viewModeBubble, setViewModeBubble] = useState('chart'); // 'chart' | 'table'
  const [sortField, setSortField] = useState('gbar');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    async function loadTrends() {
      setIsLoading(true);
      try {
        const res = await api.getDomainTrends(domainId);
        if (res && res.trends) {
          setTrends(res.trends);
        }
      } catch (err) {
        console.error('Failed to load trends:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTrends();
  }, [domainId]);

  // Sort handling
  const sortedTrends = [...trends].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // ECharts Multi-Line Yearly Volume Chart
  const getLineChartOption = () => {
    if (!trends || trends.length === 0) return {};

    const yearsSet = new Set();
    trends.forEach((t) => {
      (t.yearly_counts || []).forEach((y) => yearsSet.add(y.year));
    });
    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);

    const topSubareas = [...trends]
      .sort((a, b) => (b.last_complete_year_count || b.last_year_count || 0) - (a.last_complete_year_count || a.last_year_count || 0))
      .slice(0, 6);

    const colors = ['#6366F1', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#8B5CF6'];

    const series = topSubareas.map((t, idx) => {
      const yearCountMap = {};
      (t.yearly_counts || []).forEach((y) => {
        yearCountMap[y.year] = y.count;
      });
      const data = sortedYears.map((yr) => yearCountMap[yr] || 0);

      return {
        name: t.name || t.topic_name,
        type: 'line',
        smooth: true,
        data,
        itemStyle: { color: colors[idx % colors.length] },
        lineStyle: { width: 2.5 },
        symbolSize: 6,
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        textStyle: { color: '#0F172A', fontSize: 12 },
      },
      legend: {
        data: topSubareas.map((t) => t.name || t.topic_name),
        bottom: 0,
        textStyle: { color: '#475569', fontSize: 11, fontWeight: 600 },
      },
      grid: {
        top: 25,
        left: '5%',
        right: '4%',
        bottom: 50,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: sortedYears,
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#475569', fontWeight: 600 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLine: { show: false },
        axisLabel: { color: '#475569', fontWeight: 600 },
      },
      series,
    };
  };

  // Trajectory Momentum Scatter Plot: Log Volume vs. CAGR (4 Quadrants)
  const getMomentumScatterOption = () => {
    if (!trends || trends.length === 0) return {};

    const scatterData = trends.map((t) => {
      const growthPct = Number(((t.cagr !== undefined && t.cagr !== null ? t.cagr : t.gbar) * 100).toFixed(1));
      const volume = Math.max(t.total_count || t.last_complete_year_count || 10, 10);
      const quad = t.quadrant || (growthPct >= 15 ? (volume >= 2000 ? 'Emerging Stars' : 'Niche Opportunities') : (growthPct <= -5 ? 'Fading Areas' : 'Established Giants'));
      return [
        volume,
        growthPct,
        t.name || t.topic_name,
        quad,
        t.last_complete_year_count || t.last_year_count || 0,
        Number((t.gbar * 100).toFixed(1)),
        Number(((t.cagr || t.gbar) * 100).toFixed(1)),
      ];
    });

    return {
      tooltip: {
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        textStyle: { color: '#0F172A', fontSize: 12 },
        formatter: (params) => {
          const d = params.value;
          return `
            <div style="font-family: var(--font-sans); padding: 2px;">
              <div style="font-weight: 700; color: #0F172A; font-size: 13px; margin-bottom: 4px;">
                ${d[2]}
              </div>
              <div style="color: #475569; font-size: 11px; line-height: 1.6;">
                Quadrant: <strong style="color: #2563EB;">${d[3]}</strong><br/>
                3-Year CAGR: <strong style="color: #059669;">${d[6]}%</strong><br/>
                Compound Slope g&#772;(k): <strong>${d[5]}%</strong><br/>
                Total Publication Volume: <strong>${d[0].toLocaleString()} papers</strong><br/>
                Recent Annual Output: <strong>${d[4].toLocaleString()} papers</strong>
              </div>
            </div>
          `;
        },
      },
      grid: {
        top: 35,
        left: '6%',
        right: '6%',
        bottom: 50,
        containLabel: true,
      },
      xAxis: {
        name: 'Publication Volume (Log Scale)',
        nameLocation: 'middle',
        nameGap: 30,
        type: 'log',
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#475569', fontWeight: 600 },
        nameTextStyle: { color: '#334155', fontSize: 11, fontWeight: 600 },
      },
      yAxis: {
        name: '3-Year Growth Rate / CAGR (%)',
        nameLocation: 'middle',
        nameGap: 40,
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#475569', fontWeight: 600 },
        nameTextStyle: { color: '#334155', fontSize: 11, fontWeight: 600 },
      },
      series: [
        {
          type: 'scatter',
          data: scatterData,
          symbolSize: (val) => Math.max(14, Math.min(42, Math.sqrt(val[0]) * 0.45 + 8)),
          itemStyle: {
            color: (params) => {
              const quad = params.value[3];
              if (quad === 'Emerging Stars') return '#059669';
              if (quad === 'Niche Opportunities') return '#D97706';
              if (quad === 'Fading Areas') return '#DC2626';
              return '#2563EB';
            },
            borderColor: '#FFFFFF',
            borderWidth: 1.5,
            shadowBlur: 6,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
          },
          markLine: {
            silent: true,
            lineStyle: {
              type: 'dashed',
              color: '#94A3B8',
            },
            data: [
              { yAxis: 15, name: 'Growth Threshold (+15%)' },
              { xAxis: 2000, name: 'Volume Threshold (2k)' },
            ],
          },
        },
      ],
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Publication Growth Trends & Trajectory Momentum</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Exact 10-year publication slope g&#772;(k), 3-year Compound Annual Growth Rate (CAGR), and 4-quadrant momentum mapping across millions of papers.
        </p>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
        <>
          {/* Chart 1: Trajectory Momentum Scatter Plot (4 Quadrants) */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass size={18} color="var(--accent-indigo)" />
                  <span>Trajectory Momentum Scatter Matrix</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  X-axis: Total volume (logarithmic) &bull; Y-axis: 3-Year CAGR &bull; Quadrants: Emerging Stars, Established Giants, Niche Opportunities, Fading Areas.
                </p>
              </div>

              {/* Quadrant Legend Chips */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="badge badge-emerging" style={{ fontSize: '0.75rem' }}>★ Emerging Stars</span>
                <span className="badge badge-indigo" style={{ fontSize: '0.75rem' }}>■ Established Giants</span>
                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>▲ Niche Opportunities</span>
                <span className="badge badge-declining" style={{ fontSize: '0.75rem' }}>▼ Fading Areas</span>
              </div>
            </div>

            <ReactECharts option={getMomentumScatterOption()} style={{ height: '360px', width: '100%' }} />
          </div>

          {/* Chart 2: Multi-Line Annual Trajectories */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="var(--accent-emerald)" />
                  <span>Annual Publication Trajectories (Top Sub-Areas)</span>
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Historical annual paper distributions over 10 years across the largest sub-domains.
                </p>
              </div>

              <button
                className="btn btn-outline btn-sm"
                onClick={() => setViewModeLine(viewModeLine === 'chart' ? 'table' : 'chart')}
              >
                <Eye size={14} />
                <span>{viewModeLine === 'chart' ? 'View as Table' : 'View as Chart'}</span>
              </button>
            </div>

            {viewModeLine === 'chart' ? (
              <ReactECharts option={getLineChartOption()} style={{ height: '320px', width: '100%' }} />
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Sub-Area</th>
                      <th>Recent Annual Output</th>
                      <th>Compound Slope g&#772;(k)</th>
                      <th>3-Year CAGR</th>
                      <th>Momentum Quadrant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.slice(0, 10).map((t) => (
                      <tr key={t.topic_id}>
                        <td style={{ fontWeight: 600 }}>{t.name || t.topic_name}</td>
                        <td>{(t.last_complete_year_count || t.last_year_count)?.toLocaleString() || 'N/A'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{(t.gbar * 100).toFixed(1)}%</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#10B981', fontWeight: 600 }}>
                          {t.cagr !== undefined && t.cagr !== null ? `${(t.cagr * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td>
                          <span className={`badge ${t.quadrant === 'Emerging Stars' ? 'badge-emerging' : t.quadrant === 'Fading Areas' ? 'badge-declining' : t.quadrant === 'Niche Opportunities' ? 'badge-warning' : 'badge-indigo'}`}>
                            {t.quadrant || t.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sortable Full Metrics Table */}
          <div className="panel">
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Table size={18} />
                <span>Deterministic Trend Classifications ({trends.length})</span>
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Deterministic CAGR and annual growth rates. Click headers to sort.
              </p>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Sub-Area</span>
                        <ArrowUpDown size={13} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('cagr')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>3-Year CAGR</span>
                        <ArrowUpDown size={13} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('gbar')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Slope g&#772;(k)</span>
                        <ArrowUpDown size={13} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('quadrant')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Quadrant</span>
                        <ArrowUpDown size={13} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('total_count')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Total Volume</span>
                        <ArrowUpDown size={13} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrends.map((t) => {
                    const quad = t.quadrant || (t.label === 'Emerging' ? 'Emerging Stars' : t.label === 'Declining' ? 'Fading Areas' : 'Established Giants');
                    let badge = 'badge-indigo';
                    if (quad === 'Emerging Stars') badge = 'badge-emerging';
                    else if (quad === 'Niche Opportunities') badge = 'badge-warning';
                    else if (quad === 'Fading Areas') badge = 'badge-declining';

                    return (
                      <tr key={t.topic_id}>
                        <td style={{ fontWeight: 600 }}>{t.name || t.topic_name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#34D399', fontWeight: 600 }}>
                          {t.cagr !== undefined && t.cagr !== null ? `${(t.cagr * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {(t.gbar * 100).toFixed(1)}%
                        </td>
                        <td>
                          <span className={`badge ${badge}`}>{quad}</span>
                        </td>
                        <td>{t.total_count ? t.total_count.toLocaleString() : (t.last_complete_year_count || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
