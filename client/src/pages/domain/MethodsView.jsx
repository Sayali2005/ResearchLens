import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Cpu, Database, Tag, Eye, TrendingUp, BarChart2 } from 'lucide-react';
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

  // ECharts Horizontal Bar Chart for Methods
  const getMethodsBarOption = () => {
    if (!methodData || !methodData.methods) return {};
    const topMethods = [...methodData.methods].slice(0, 8).reverse();

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
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
        axisLabel: { color: '#6B7280' },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      yAxis: {
        type: 'category',
        data: topMethods.map((m) => m.name),
        axisLabel: {
          color: '#374151',
          fontSize: 11,
          formatter: (val) => (val.length > 20 ? `${val.slice(0, 18)}...` : val),
        },
        axisLine: { lineStyle: { color: '#E5E7EB' } },
      },
      series: [
        {
          type: 'bar',
          data: topMethods.map((m) => m.count),
          itemStyle: {
            color: '#4F46E5',
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
        borderColor: '#E5E7EB',
        formatter: (params) => {
          const item = topDatasets[params[0].dataIndex];
          return `<strong>${item.name}</strong><br/>
            Papers: ${item.count} (${item.percentage}%)<br/>
            Category: ${item.category}`;
        },
      },
      grid: {
        top: 15,
        left: '26%',
        right: '8%',
        bottom: 20,
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#6B7280' },
        splitLine: { lineStyle: { color: '#F1F5F9' } },
      },
      yAxis: {
        type: 'category',
        data: topDatasets.map((d) => d.name),
        axisLabel: {
          color: '#374151',
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: '#E5E7EB' } },
      },
      series: [
        {
          type: 'bar',
          data: topDatasets.map((d) => d.count),
          itemStyle: {
            color: '#16A34A',
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  };

  // ECharts Line Chart for Methods Over Time
  const getTrendsOption = () => {
    if (!methodData || !methodData.trends || methodData.trends.length === 0) return {};

    const yearsSet = new Set();
    methodData.trends.forEach((t) => {
      Object.keys(t.yearly_counts || {}).forEach((yr) => yearsSet.add(yr));
    });
    const sortedYears = Array.from(yearsSet).sort();

    const colors = ['#4F46E5', '#16A34A', '#D97706', '#0284C7', '#9333EA', '#E11D48'];

    const series = methodData.trends.slice(0, 5).map((t, idx) => ({
      name: t.method_name,
      type: 'line',
      smooth: true,
      data: sortedYears.map((y) => t.yearly_counts[y] || 0),
      itemStyle: { color: colors[idx % colors.length] },
      lineStyle: { width: 2 },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
      },
      legend: {
        data: methodData.trends.slice(0, 5).map((t) => t.method_name),
        bottom: 0,
        textStyle: { color: '#6B7280', fontSize: 11 },
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
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { color: '#6B7280' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLabel: { color: '#6B7280' },
      },
      series,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>Methodologies & Benchmark Datasets</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Dictionary co-occurrence, TF-IDF keyphrase extraction, and temporal adoption trends across domain abstracts.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {/* Top Row: Methods and Datasets Bar Charts */}
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
                    padding: '6px 12px',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{k.term}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'var(--bg-hover)',
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
