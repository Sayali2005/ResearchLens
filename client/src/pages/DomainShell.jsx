import React, { useState, useEffect, useRef } from 'react';
import { useParams, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { DomainHeader } from '../components/DomainHeader';
import { SkeletonCard, SkeletonMetric } from '../components/Skeleton';
import { ExportModal } from '../components/ExportModal';
import { api } from '../api/client';
import {
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  Compass,
  TrendingUp,
  Layers,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';

export function DomainShell() {
  const { domainId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [domainOverview, setDomainOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeJob, setActiveJob] = useState(location.state?.initialJob || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [error, setError] = useState(null);

  const pollTimerRef = useRef(null);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startJobPolling = (jobId) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const job = await api.getJobStatus(jobId);
        setActiveJob(job);
        if (job.status === 'completed') {
          stopPolling();
          setActiveJob(null);
          await loadOverview();
        } else if (job.status === 'failed') {
          stopPolling();
          setActiveJob(null);
          setError(job.error || job.message || 'Analysis could not be completed.');
          setIsLoading(false);
        }
      } catch (err) {
        // If poll temporary fails, keep trying unless fatal
        console.warn('Job polling warning:', err);
      }
    }, 1200);
  };

  const loadOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getDomainOverview(domainId);
      if (res && res.data) {
        setDomainOverview(res.data);
        setActiveJob(null);
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      // If 404, check if there is an active job or trigger one
      try {
        const jobRes = await api.getDomainJob(domainId);
        if (jobRes && jobRes.status === 'processing') {
          setActiveJob(jobRes);
          setIsLoading(false);
          startJobPolling(jobRes.job_id);
          return false;
        }

        // If no job was running, launch analysis for this domain
        const readableName = domainId.replace(/-/g, ' ');
        const newJob = await api.startAnalysis(readableName);
        if (newJob && newJob.job_id) {
          setActiveJob(newJob);
          setIsLoading(false);
          startJobPolling(newJob.job_id);
          return false;
        }
      } catch (jobErr) {
        setError(err.message || 'Domain analysis could not be initiated.');
      }
    } finally {
      setIsLoading(false);
    }
    return false;
  };

  useEffect(() => {
    stopPolling();
    setError(null);

    // If an initial job was passed from navigation
    const initialJobId = location.state?.jobId;
    if (initialJobId) {
      api.getJobStatus(initialJobId).then((job) => {
        if (job.status === 'completed') {
          loadOverview();
        } else {
          setActiveJob(job);
          setIsLoading(false);
          startJobPolling(initialJobId);
        }
      }).catch(() => {
        loadOverview();
      });
    } else {
      loadOverview();
    }

    return () => stopPolling();
  }, [domainId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const readableName = domainOverview?.name || domainId.replace(/-/g, ' ');
      const newJob = await api.startAnalysis(readableName);
      if (newJob && newJob.job_id) {
        setActiveJob(newJob);
        startJobPolling(newJob.job_id);
      }
    } catch (err) {
      setError('Refresh failed: ' + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  // 1. In-Progress Analysis Screen
  if (activeJob && activeJob.status === 'processing') {
    const progressVal = Math.min(Math.max(activeJob.progress || 10, 5), 98);
    const domainDisplayName =
      location.state?.domainName ||
      activeJob.domain_id?.replace(/-/g, ' ') ||
      domainId.replace(/-/g, ' ');

    return (
      <div style={{ maxWidth: '820px', margin: '60px auto', padding: '0 24px' }}>
        <div
          className="panel"
          style={{
            padding: '36px 32px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-hover)',
            border: '1px solid var(--accent-indigo-border)',
            backgroundColor: '#FFFFFF',
          }}
        >
          {/* Top Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--accent-indigo-light)',
                color: 'var(--accent-indigo)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.825rem',
                fontWeight: 600,
              }}
            >
              <Sparkles size={16} />
              <span>Deterministic Scholarly Engine</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-indigo)', fontWeight: 700, fontSize: '1.1rem' }}>
              <Loader2 size={18} className="spin" />
              <span>{progressVal}%</span>
            </div>
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: '1.65rem', marginBottom: '8px', textTransform: 'capitalize' }}>
            Analyzing {domainDisplayName}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px' }}>
            ResearchLens is retrieving live ontology records, calculating publication momentum, and cross-referencing sub-area trajectories.
          </p>

          {/* Progress Bar Container */}
          <div
            style={{
              width: '100%',
              height: '10px',
              backgroundColor: '#EEF2FF',
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                width: `${progressVal}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)',
                borderRadius: '999px',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>

          {/* Live Status Message */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              color: 'var(--text-main)',
              marginBottom: '32px',
            }}
          >
            <Loader2 size={16} className="spin" color="var(--accent-indigo)" />
            <span style={{ fontWeight: 500 }}>{activeJob.message || 'Processing scholarly data...'}</span>
          </div>

          {/* 3 Pipeline Stage Milestones */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
            {/* Stage 1 */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${progressVal >= 30 ? 'var(--color-success-border)' : 'var(--accent-indigo-border)'}`,
                backgroundColor: progressVal >= 30 ? 'var(--color-success-bg)' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {progressVal >= 30 ? (
                  <CheckCircle2 size={18} color="var(--color-success)" />
                ) : (
                  <Compass size={18} color="var(--accent-indigo)" />
                )}
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>1. Hierarchy</span>
              </div>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                OpenAlex academic taxonomy resolution
              </p>
            </div>

            {/* Stage 2 */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${progressVal >= 80 ? 'var(--color-success-border)' : progressVal >= 30 ? 'var(--accent-indigo-border)' : 'var(--border-color)'}`,
                backgroundColor: progressVal >= 80 ? 'var(--color-success-bg)' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {progressVal >= 80 ? (
                  <CheckCircle2 size={18} color="var(--color-success)" />
                ) : progressVal >= 30 ? (
                  <TrendingUp size={18} color="var(--accent-indigo)" />
                ) : (
                  <TrendingUp size={18} color="var(--text-muted)" />
                )}
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>2. Trajectories</span>
              </div>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                10-year publication trend calculations
              </p>
            </div>

            {/* Stage 3 */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${progressVal >= 95 ? 'var(--color-success-border)' : 'var(--border-color)'}`,
                backgroundColor: progressVal >= 95 ? 'var(--color-success-bg)' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {progressVal >= 95 ? (
                  <CheckCircle2 size={18} color="var(--color-success)" />
                ) : (
                  <Layers size={18} color="var(--text-muted)" />
                )}
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>3. Synthesis</span>
              </div>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                Gap matrices & candidate roadmaps
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                stopPolling();
                navigate('/');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} />
              <span>Back to Search</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Initial Loading Skeleton
  if (isLoading) {
    return (
      <div className="workspace-layout">
        <aside className="workspace-sidebar" style={{ padding: '20px' }}>
          <SkeletonCard />
        </aside>
        <main className="workspace-content">
          <div style={{ marginBottom: '24px' }}>
            <div className="skeleton" style={{ width: '40%', height: '36px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '60%', height: '18px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </div>
          <SkeletonCard />
        </main>
      </div>
    );
  }

  // 3. Error Fallback
  if (error) {
    return (
      <div style={{ maxWidth: '800px', margin: '60px auto', padding: '0 20px' }}>
        <div
          className="panel"
          style={{
            borderColor: 'var(--color-danger-border)',
            backgroundColor: 'var(--color-danger-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)' }}>
            <AlertCircle size={22} />
            <h3 style={{ color: 'var(--color-danger)' }}>Domain Analysis Incomplete</h3>
          </div>
          <p style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setError(null);
                const readableName = domainId.replace(/-/g, ' ');
                api.startAnalysis(readableName).then((newJob) => {
                  setActiveJob(newJob);
                  startJobPolling(newJob.job_id);
                }).catch((e) => setError(e.message));
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} />
              <span>Retry Analysis</span>
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/')}>
              Back to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Completed Domain Workspace
  return (
    <div className="workspace-layout">
      <Sidebar
        domainName={domainOverview?.name || domainId}
        onExport={handleExport}
      />

      <main className="workspace-content">
        <DomainHeader
          domainName={domainOverview?.name || domainId}
          dataFreshness={domainOverview?.data_freshness}
          sources={domainOverview?.sources || ['OpenAlex', 'Semantic Scholar', 'arXiv']}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          isCached={true}
        />

        {/* Child Views rendered via Outlet */}
        <Outlet context={{ domainOverview, domainId, handleRefresh }} />

        {/* Disclaimer footer on all domain pages */}
        <div className="disclaimer-box">
          <AlertCircle size={18} color="var(--text-muted)" style={{ minWidth: '18px', marginTop: '2px' }} />
          <div>
            <strong>Disclaimer:</strong> Gaps are candidate niches evaluated using observed vs. expected publication frequencies and keyword co-occurrence. A low paper volume can indicate an impractical limitation or unviable direction as well as an open research opportunity. Always verify against primary literature.
          </div>
        </div>

        {/* Export Modal */}
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          domainId={domainId}
          domainName={domainOverview?.name}
        />
      </main>
    </div>
  );
}
