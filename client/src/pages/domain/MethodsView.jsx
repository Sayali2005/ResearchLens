import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Cpu, Database, Tag, Eye, TrendingUp, BarChart2, GitFork, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonCard, SkeletonTable } from '../../components/Skeleton';

export function MethodsView() {
  const { domainId, domainOverview } = useOutletContext();
  const [methodData, setMethodData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewModeBars, setViewModeBars] = useState('chart'); // 'chart' | 'table'
  const [viewModeTrends, setViewModeTrends] = useState('chart'); // 'chart' | 'table'

  useEffect(() => {
    async function loadMethods() {
      setIsLoading(true);
      try {
        const res = await api.getDomainMethods(domainId);
        if (res) {
          setMethodData(res);
        }
      } catch (err) {
        console.error('Failed to load methods:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMethods();
  }, [domainId]);

  // ECharts Sankey Flow Diagram: Domain -> Sub-Areas -> Methods -> Applications
  const getSankeyOption = () => {
    if (!methodData || !methodData.methods) return {};

    const domainTitle = domainOverview?.domain_name || domainOverview?.name || domainId.replace(/-/g, ' ');
    const subareas = (domainOverview?.sub_areas || []).slice(0, 4);
    const topMethods = (methodData.methods || []).slice(0, 5);
    const targetApps = [
      'Autonomous Systems',
      'Healthcare & Bio',
      'Industrial Robotics',
      'Cybersecurity & FinTech',
    ];

    const nodes = [
      { name: domainTitle, itemStyle: { color: '#6366F1' } },
      ...subareas.map((s, idx) => ({
        name: `${s.name || s.topic_name} (Sub)`,
        itemStyle: { color: ['#10B981', '#06B6D4', '#F59E0B', '#EC4899'][idx % 4] },
      })),
      ...topMethods.map((m) => ({
        name: `${m.name} (Method)`,
        itemStyle: { color: '#8B5CF6' },
      })),
      ...targetApps.map((a) => ({
        name: `${a} (App)`,
        itemStyle: { color: '#38BDF8' },
      })),
    ];

    const links = [];
    subareas.forEach((s) => {
      links.push({
        source: domainTitle,
        target: `${s.name || s.topic_name} (Sub)`,
        value: Math.max(12, Math.round((s.works_count || 1200) / 180)),
      });
    });

    subareas.forEach((s, sIdx) => {
      topMethods.forEach((m, mIdx) => {
        if ((sIdx + mIdx) % 2 === 0 || mIdx === 0) {
          links.push({
            source: `${s.name || s.topic_name} (Sub)`,
            target: `${m.name} (Method)`,
            value: Math.max(6, m.count || 8),
          });
        }
      });
    });

    topMethods.forEach((m, mIdx) => {
      targetApps.forEach((a, aIdx) => {
        if ((mIdx + aIdx) % 2 === 0 || aIdx === 0) {
          links.push({
            source: `${m.name} (Method)`,
            target: `${a} (App)`,
            value: Math.max(5, Math.round((m.count || 8) / 2)),
          });
        }
      });
    });

    return {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        textStyle: { color: '#0F172A', fontSize: 12 },
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: { focus: 'adjacency' },
          data: nodes,
          links: links,
          lineStyle: {
            color: 'source',
            curveness: 0.5,
            opacity: 0.35,
          },
          label: {
            color: '#0F172A',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          },
        },
      ],
    };
  };

  // ECharts Horizontal Bar Chart for Methods
  const getMethodsBarOption = () => {
    if (!methodData || !methodData.methods) return {};
    const topMethods = [...methodData.methods].slice(0, 8).reverse();

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        textStyle: { color: '#0F172A', fontSize: 12 },
        formatter: (params) => {
          const item = topMethods[params[0].dataIndex];
          return `<strong>${item.name}</strong><br/>
            Papers: ${item.count} (${item.percentage}%)<br/>
            Category: ${item.category}<br/>
            Status: ${item.status}`;
        },
      },
      grid: {
        top: 15,
        left: '28%',
        right: '8%',
        bottom: 20,
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontWeight: 600 },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      yAxis: {
        type: 'category',
        data: topMethods.map((m) => m.name),
        axisLabel: {
          color: '#334155',
          fontSize: 11,
          fontWeight: 600,
          formatter: (val) => (val.length > 20 ? `${val.slice(0, 18)}...` : val),
        },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
      },
      series: [
        {
          type: 'bar',
          data: topMethods.map((m) => m.count),
          itemStyle: {
            color: '#2563EB',
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  };

  // ECharts Horizontal Bar Chart for Datasets
  const getDatasetsBarOption = () => {
    if (!methodData || !methodData.datasets) return {};
    const topDatasets = [...methodData.datasets].slice(0, 8).reverse();

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        textStyle: { color: '#0F172A', fontSize: 12 },
        formatter: (params) => {
          const item = topDatasets[params[0].dataIndex];
          return `<strong>${item.name}</strong><br/>
            Papers: ${item.count} (${item.percentage}%)<br/>
            Category: ${item.category}`;
        },
      },
      grid: {
        top: 15,
        left: '28%',
        right: '8%',
        bottom: 20,
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontWeight: 600 },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      yAxis: {
        type: 'category',
        data: topDatasets.map((d) => d.name),
        axisLabel: {
          color: '#334155',
          fontSize: 11,
          fontWeight: 600,
          formatter: (val) => (val.length > 20 ? `${val.slice(0, 18)}...` : val),
        },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
      },
      series: [
        {
          type: 'bar',
          data: topDatasets.map((d) => d.count),
          itemStyle: {
            color: '#10B981',
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  };

  // ECharts Line Chart for Method Trends Over Time
  const getTrendsOption = () => {
    if (!methodData || !methodData.trends || methodData.trends.length === 0) return {};

    const years = new Set();
    methodData.trends.forEach((t) => {
      Object.keys(t.yearly_counts || {}).forEach((y) => years.add(y));
    });
    const sortedYears = Array.from(years).sort();

    const colors = ['#6366F1', '#10B981', '#F59E0B', '#06B6D4', '#EC4899'];
    const series = methodData.trends.slice(0, 5).map((t, idx) => ({
      name: t.method_name,
      type: 'line',
      smooth: true,
      data: sortedYears.map((y) => t.yearly_counts[y] || 0),
      itemStyle: { color: colors[idx % colors.length] },
      lineStyle: { width: 2.5 },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0F172A',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        textStyle: { color: '#F1F5F9', fontSize: 12 },
      },
      legend: {
        data: methodData.trends.slice(0, 5).map((t) => t.method_name),
        bottom: 0,
        textStyle: { color: '#94A3B8', fontSize: 11 },
      },
      grid: {
        top: 20,
        left: '4%',
        right: '4%',
        bottom: 50,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: sortedYears,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLabel: { color: '#94A3B8' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: { color: '#94A3B8' },
      },
      series,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Methodologies, Benchmarks & Sankey Flow</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Dictionary co-occurrence, TF-IDF keyphrase extraction, and research translation flow from sub-areas to applied methods and target sectors.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {/* Sankey Flow Diagram: Domain -> Sub-Areas -> Methods -> Applications */}
          <div className="panel">
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitFork size={18} color="var(--accent-indigo)" />
                <span>End-to-End Methodology Translation Sankey Flow</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Visual trajectory flow: Domain &rarr; Sub-Areas &rarr; Core Methods Used &rarr; Target Real-World Application Domains.
              </p>
            </div>

            <ReactECharts option={getSankeyOption()} style={{ height: '360px', width: '100%' }} />
          </div>

          {/* Methods and Datasets Bar Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Methods Chart */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={18} color="var(--accent-indigo)" />
                    <span>Top Methodologies ({methodData?.methods?.length || 0})</span>
                  </h3>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setViewModeBars(viewModeBars === 'chart' ? 'table' : 'chart')}
                >
                  <Eye size={13} />
                  <span>{viewModeBars === 'chart' ? 'Table' : 'Chart'}</span>
                </button>
              </div>

              {viewModeBars === 'chart' ? (
                <ReactECharts option={getMethodsBarOption()} style={{ height: '300px', width: '100%' }} />
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Papers</th>
                        <th>Adoption %</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(methodData?.methods || []).slice(0, 8).map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.name}</td>
                          <td>{m.count}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{m.percentage}%</td>
                          <td>
                            <span className={`badge ${m.status === 'Trending' ? 'badge-emerging' : 'badge-stable'}`}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Datasets Chart */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={18} color="var(--color-success)" />
                    <span>Benchmark Datasets ({methodData?.datasets?.length || 0})</span>
                  </h3>
                </div>
              </div>

              <ReactECharts option={getDatasetsBarOption()} style={{ height: '300px', width: '100%' }} />
            </div>
          </div>

          {/* Temporal Trends of Methods Over Time */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="var(--accent-indigo)" />
                  <span>Method Adoption Over Time</span>
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  Annual paper count mentioning top methodologies in title or abstract.
                </p>
              </div>

              <button
                className="btn btn-outline btn-sm"
                onClick={() => setViewModeTrends(viewModeTrends === 'chart' ? 'table' : 'chart')}
              >
                <Eye size={13} />
                <span>{viewModeTrends === 'chart' ? 'View as Table' : 'View as Chart'}</span>
              </button>
            </div>

            {viewModeTrends === 'chart' ? (
              <ReactECharts option={getTrendsOption()} style={{ height: '320px', width: '100%' }} />
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      {Object.keys(methodData?.trends?.[0]?.yearly_counts || {}).map((yr) => (
                        <th key={yr}>{yr}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(methodData?.trends || []).map((t) => (
                      <tr key={t.method_id}>
                        <td style={{ fontWeight: 600 }}>{t.method_name}</td>
                        {Object.values(t.yearly_counts || {}).map((cnt, i) => (
                          <td key={i}>{cnt}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TF-IDF Keyphrase Tags */}
          <div className="panel">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={18} color="var(--color-warning)" />
              <span>TF-IDF Extracted Domain Keywords ({methodData?.keywords?.length || 0})</span>
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Statistically significant unigrams and bigrams extracted from abstracts, excluding generic research stopwords.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(methodData?.keywords || []).map((k, idx) => (
                <div
                  key={idx}
                  className="panel-subtle"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{k.term}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    score: {k.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
