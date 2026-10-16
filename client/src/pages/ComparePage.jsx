import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  ArrowLeftRight,
  TrendingUp,
  Database,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';

const COMPARISON_PRESETS = [
  { d1: 'Computer Vision', d2: 'Natural Language Processing' },
  { d1: 'Deep Learning', d2: 'Reinforcement Learning' },
  { d1: 'Machine Learning', d2: 'Cybersecurity' },
  { d1: 'Quantum Machine Learning', d2: 'Neuromorphic Computing' },
];

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const d1Param = searchParams.get('d1') || 'Computer Vision';
  const d2Param = searchParams.get('d2') || 'Natural Language Processing';

  const [domain1, setDomain1] = useState(d1Param);
  const [domain2, setDomain2] = useState(d2Param);
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComparison = async (d1, d2) => {
    if (!d1 || !d2) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.compareDomains(d1, d2);
      if (res) {
        setComparisonData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to compare domains.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison(d1Param, d2Param);
  }, [d1Param, d2Param]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (domain1.trim() && domain2.trim()) {
      setSearchParams({ d1: domain1.trim(), d2: domain2.trim() });
    }
  };

  const handleSelectPreset = (p) => {
    setDomain1(p.d1);
    setDomain2(p.d2);
    setSearchParams({ d1: p.d1, d2: p.d2 });
  };

  const d1Data = comparisonData?.domain_1;
  const d2Data = comparisonData?.domain_2;
  const compMeta = comparisonData?.comparison;

  // ECharts Dual Domain Trajectory Chart
  const getTrajectoryComparisonOption = () => {
    if (!d1Data || !d2Data) return {};

    const yearsSet = new Set();
    (d1Data.yearly_trajectory || []).forEach((y) => yearsSet.add(y.year));
    (d2Data.yearly_trajectory || []).forEach((y) => yearsSet.add(y.year));
    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);

    const map1 = {};
    (d1Data.yearly_trajectory || []).forEach((y) => (map1[y.year] = y.count));
    const map2 = {};
    (d2Data.yearly_trajectory || []).forEach((y) => (map2[y.year] = y.count));

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        textStyle: { color: '#0F172A', fontSize: 12 },
      },
      legend: {
        data: [d1Data.name, d2Data.name],
        bottom: 0,
        textStyle: { color: '#475569', fontSize: 11, fontWeight: 600 },
      },
      grid: {
        top: 25,
        left: '5%',
        right: '4%',
        bottom: 45,
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
        axisLabel: { color: '#475569', fontWeight: 600 },
      },
      series: [
        {
          name: d1Data.name,
          type: 'line',
          smooth: true,
          data: sortedYears.map((y) => map1[y] || 0),
          itemStyle: { color: '#2563EB' },
          lineStyle: { width: 3 },
          symbolSize: 6,
        },
        {
          name: d2Data.name,
          type: 'line',
          smooth: true,
          data: sortedYears.map((y) => map2[y] || 0),
          itemStyle: { color: '#059669' },
          lineStyle: { width: 3 },
          symbolSize: 6,
        },
      ],
    };
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px 80px' }}>
      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE',
            padding: '4px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.825rem',
            fontWeight: 700,
            marginBottom: '14px',
          }}
        >
          <ArrowLeftRight size={14} />
          <span>Domain Comparison Mode ("A vs. B")</span>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: '8px' }}>
          Side-by-Side Research Domain Comparison
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px', margin: '0 auto' }}>
          Evaluate growth momentum, publication volume, benchmark datasets, and method adoption head-to-head.
        </p>
      </div>

      {/* Dual Search Input Bar */}
      <div className="panel" style={{ marginBottom: '28px', padding: '24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '14px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Domain A
            </label>
            <input
              type="text"
              value={domain1}
              onChange={(e) => setDomain1(e.target.value)}
              placeholder="e.g. Computer Vision"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div style={{ paddingTop: '20px', color: 'var(--text-muted)' }}>
            <ArrowLeftRight size={20} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Domain B
            </label>
            <input
              type="text"
              value={domain2}
              onChange={(e) => setDomain2(e.target.value)}
              placeholder="e.g. Natural Language Processing"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div style={{ paddingTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ height: '40px' }}>
              {isLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              <span>Compare</span>
            </button>
          </div>
        </form>

        {/* Preset Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 600 }}>Suggested Pairs:</span>
          {COMPARISON_PRESETS.map((p, idx) => (
            <button
              key={idx}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.775rem', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}
              onClick={() => handleSelectPreset(p)}
            >
              {p.d1} vs. {p.d2}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SkeletonCard />
          <SkeletonTable rows={6} cols={3} />
        </div>
      ) : error ? (
        <div className="panel" style={{ textAlign: 'center', padding: '40px', borderColor: 'var(--color-danger-border)' }}>
          <AlertCircle size={36} color="var(--color-danger)" style={{ margin: '0 auto 12px' }} />
          <h3>Comparison Error</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>{error}</p>
        </div>
      ) : d1Data && d2Data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Executive Comparative Insights Banner */}
          <div
            className="panel"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Faster Growing Domain
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10B981', marginTop: '4px' }}>
                {compMeta?.faster_growing}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Higher Publication Volume
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6366F1', marginTop: '4px' }}>
                {compMeta?.higher_volume}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                More Emerging Sub-Areas
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F59E0B', marginTop: '4px' }}>
                {compMeta?.more_emerging_subareas}
              </div>
            </div>
          </div>

          {/* Side-by-Side Key Metrics Table */}
          <div className="panel">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Head-to-Head Quantitative Breakdown</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Metric</th>
                    <th style={{ width: '35%', color: '#A5B4FC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{d1Data.name}</span>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.725rem', padding: '2px 8px' }}
                          onClick={() => navigate(`/domain/${d1Data.id}/landscape`)}
                        >
                          Explore &rarr;
                        </button>
                      </div>
                    </th>
                    <th style={{ width: '35%', color: '#34D399' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{d2Data.name}</span>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.725rem', padding: '2px 8px' }}
                          onClick={() => navigate(`/domain/${d2Data.id}/landscape`)}
                        >
                          Explore &rarr;
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Total Indexed Publications</strong></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600 }}>
                      {d1Data.total_papers.toLocaleString()}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600 }}>
                      {d2Data.total_papers.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Average 3-Year CAGR</strong></td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: d1Data.cagr_avg > d2Data.cagr_avg ? '#10B981' : 'inherit', fontWeight: 600 }}>
                      {(d1Data.cagr_avg * 100).toFixed(1)}%
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: d2Data.cagr_avg > d1Data.cagr_avg ? '#10B981' : 'inherit', fontWeight: 600 }}>
                      {(d2Data.cagr_avg * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Mean Slope g&#772;(k)</strong></td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{(d1Data.growth_avg * 100).toFixed(1)}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{(d2Data.growth_avg * 100).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td><strong>Sub-Areas Mapped</strong></td>
                    <td>{d1Data.topics_count} sub-areas</td>
                    <td>{d2Data.topics_count} sub-areas</td>
                  </tr>
                  <tr>
                    <td><strong>Trajectory Breakdown</strong></td>
                    <td>
                      <span className="badge badge-emerging" style={{ marginRight: '6px' }}>{d1Data.emerging_count} Emerging</span>
                      <span className="badge badge-stable" style={{ marginRight: '6px' }}>{d1Data.stable_count} Stable</span>
                      <span className="badge badge-declining">{d1Data.declining_count} Declining</span>
                    </td>
                    <td>
                      <span className="badge badge-emerging" style={{ marginRight: '6px' }}>{d2Data.emerging_count} Emerging</span>
                      <span className="badge badge-stable" style={{ marginRight: '6px' }}>{d2Data.stable_count} Stable</span>
                      <span className="badge badge-declining">{d2Data.declining_count} Declining</span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Core Methodologies</strong></td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(d1Data.top_methods || []).map((m, i) => (
                          <span key={i} className="source-chip">{m.name}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(d2Data.top_methods || []).map((m, i) => (
                          <span key={i} className="source-chip">{m.name}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Benchmark Datasets</strong></td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(d1Data.top_datasets || []).map((d, i) => (
                          <span key={i} className="source-chip">{d.name}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(d2Data.top_datasets || []).map((d, i) => (
                          <span key={i} className="source-chip">{d.name}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Historical Trajectory Comparison Chart */}
          <div className="panel">
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={18} color="var(--accent-indigo)" />
              <span>10-Year Annual Output Comparison</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Comparative historical publication volumes for {d1Data.name} vs. {d2Data.name}.
            </p>
            <ReactECharts option={getTrajectoryComparisonOption()} style={{ height: '340px', width: '100%' }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
