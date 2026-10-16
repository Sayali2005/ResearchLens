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
  Radio,
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

  const eventSourceRef = useRef(null);
  const pollTimerRef = useRef(null);

  const stopJobTracking = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startJobPolling = (jobId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const job = await api.getJobStatus(jobId);
        setActiveJob(job);
        if (job.status === 'completed') {
          stopJobTracking();
          setActiveJob(null);
          await loadOverview();
        } else if (job.status === 'failed') {
          stopJobTracking();
          setActiveJob(null);
          setError(job.error || job.message || 'Analysis could not be completed.');
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Job polling warning:', err);
      }
    }, 1200);
  };

  const startJobStream = (jobId) => {
    stopJobTracking();

    // Use SSE (Server-Sent Events) live radar stream
    if (typeof EventSource !== 'undefined') {
      try {
        const streamUrl = api.getJobStreamUrl(jobId);
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onmessage = async (event) => {
          try {
            const jobData = JSON.parse(event.data);
            setActiveJob(jobData);

            if (jobData.status === 'completed') {
              stopJobTracking();
              setActiveJob(null);
              await loadOverview();
            } else if (jobData.status === 'failed') {
              stopJobTracking();
              setActiveJob(null);
              setError(jobData.error || jobData.message || 'Analysis could not be completed.');
              setIsLoading(false);
            }
          } catch (err) {
            console.warn('Failed parsing SSE stream payload:', err);
          }
        };

        es.onerror = () => {
          // If SSE disconnects, fall back seamlessly to interval polling
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          startJobPolling(jobId);
        };
        return;
      } catch (err) {
        console.warn('SSE stream error, falling back to polling:', err);
      }
    }

    // Default to interval polling
    startJobPolling(jobId);
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
      try {
        const jobRes = await api.getDomainJob(domainId);
        if (jobRes && jobRes.status === 'processing') {
          setActiveJob(jobRes);
          setIsLoading(false);
          startJobStream(jobRes.job_id);
          return false;
        }

        const readableName = domainId.replace(/-/g, ' ');
        const newJob = await api.startAnalysis(readableName);
        if (newJob && newJob.job_id) {
          setActiveJob(newJob);
          setIsLoading(false);
          startJobStream(newJob.job_id);
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
    stopJobTracking();
    setError(null);

    const initialJobId = location.state?.jobId;
    if (initialJobId) {
      api.getJobStatus(initialJobId).then((job) => {
        if (job.status === 'completed') {
          loadOverview();
        } else {
          setActiveJob(job);
          setIsLoading(false);
          startJobStream(initialJobId);
        }
      }).catch(() => {
        loadOverview();
      });
    } else {
      loadOverview();
    }

    return () => stopJobTracking();
  }, [domainId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const readableName = domainOverview?.name || domainId.replace(/-/g, ' ');
      const newJob = await api.startAnalysis(readableName);
      if (newJob && newJob.job_id) {
        setActiveJob(newJob);
        startJobStream(newJob.job_id);
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

  // 1. In-Progress Analysis Screen with SSE Live Radar Animation
  if (activeJob && activeJob.status === 'processing') {
    const progressVal = Math.min(Math.max(activeJob.progress || 10, 5), 98);
    const domainDisplayName =
      location.state?.domainName ||
      activeJob.domain_id?.replace(/-/g, ' ') ||
      domainId.replace(/-/g, ' ');

    return (
      <div style={{ maxWidth: '860px', margin: '50px auto', padding: '0 24px' }}>
        <div
          className="panel"
          style={{
            padding: '36px 32px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-hover)',
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                border: '1px solid #A7F3D0',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.825rem',
                fontWeight: 700,
              }}
            >
              <Radio size={15} className="spin" color="#059669" />
              <span>Server-Sent Events (SSE) Live Radar Stream</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563EB', fontWeight: 800, fontSize: '1.25rem' }}>
              <Loader2 size={18} className="spin" color="#2563EB" />
              <span>{progressVal}%</span>
            </div>
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', textTransform: 'capitalize', color: '#0F172A' }}>
            Analyzing {domainDisplayName}
          </h2>
          <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '24px' }}>
            ResearchLens is actively mining OpenAlex, arXiv, and Semantic Scholar catalogs &mdash; calculating publication momentum and compound trajectories.
          </p>

          {/* Radar Scanner Animation Graphics */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.03)',
              }}
            >
              {/* Inner concentric ring */}
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: '1px dashed rgba(6, 182, 212, 0.3)',
                  position: 'absolute',
                }}
              />
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  position: 'absolute',
                }}
              />
              {/* Center dot */}
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 10px #10B981',
                  zIndex: 2,
                }}
              />
              {/* Rotating Sweep Arm */}
              <svg
                width="180"
                height="180"
                viewBox="0 0 180 180"
                style={{ position: 'absolute', top: 0, left: 0 }}
                className="radar-sweep-arm"
              >
                <defs>
                  <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.45)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                  </linearGradient>
                </defs>
                <path d="M 90 90 L 180 90 A 90 90 0 0 0 90 0 Z" fill="url(#sweepGrad)" />
              </svg>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                width: `${progressVal}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10B981 0%, #06B6D4 50%, #6366F1 100%)',
                borderRadius: '999px',
                transition: 'width 0.3s ease-out',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)',
              }}
            />
          </div>

          {/* Live Status Message */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              color: 'var(--text-main)',
              marginBottom: '28px',
            }}
          >
            <Loader2 size={16} className="spin" color="#10B981" />
            <span style={{ fontWeight: 500 }}>{activeJob.message || 'Streaming scholarly analysis...'}</span>
          </div>

          {/* 3 Pipeline Stage Milestones */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {/* Stage 1 */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${progressVal >= 30 ? 'var(--color-success-border)' : 'var(--accent-indigo-border)'}`,
                backgroundColor: progressVal >= 30 ? 'var(--color-success-bg)' : 'rgba(255, 255, 255, 0.02)',
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
                backgroundColor: progressVal >= 80 ? 'var(--color-success-bg)' : 'rgba(255, 255, 255, 0.02)',
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
                10-year publication slope & CAGR
              </p>
            </div>

            {/* Stage 3 */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${progressVal >= 95 ? 'var(--color-success-border)' : 'var(--border-color)'}`,
                backgroundColor: progressVal >= 95 ? 'var(--color-success-bg)' : 'rgba(255, 255, 255, 0.02)',
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
                stopJobTracking();
                navigate('/');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} />
              <span>Cancel & Return</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div style={{ maxWidth: '640px', margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div className="panel" style={{ padding: '36px 24px', borderColor: 'var(--color-danger-border)' }}>
          <AlertCircle size={44} color="var(--color-danger)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Analysis Encountered an Issue</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '24px' }}>
            {error}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="btn btn-outline" onClick={() => navigate('/')}>
              <ArrowLeft size={15} />
              <span>Return Home</span>
            </button>
            <button className="btn btn-primary" onClick={handleRefresh}>
              <RotateCcw size={15} />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Initial Loading Skeleton
  if (isLoading && !domainOverview) {
    return (
      <div className="workspace-layout">
        <div className="workspace-sidebar" style={{ padding: '20px' }}>
          <div className="skeleton skeleton-title" style={{ width: '80%', height: '28px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            {[...Array(7)].map((_, i) => (
              <div key={i} className="skeleton skeleton-text" style={{ height: '36px' }} />
            ))}
          </div>
        </div>
        <div className="workspace-content">
          <div className="skeleton skeleton-title" style={{ width: '40%', height: '32px', marginBottom: '16px' }} />
          <div className="skeleton skeleton-text" style={{ width: '60%', height: '16px', marginBottom: '28px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
            {[...Array(4)].map((_, i) => (
              <SkeletonMetric key={i} />
            ))}
          </div>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // 4. Ready Workspace Shell
  return (
    <div className="workspace-layout">
      <Sidebar
        domainName={domainOverview?.name || domainId.replace(/-/g, ' ')}
        onExport={handleExport}
      />

      <main className="workspace-content">
        <DomainHeader
          domain={domainOverview}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onExport={handleExport}
        />

        <Outlet context={{ domainOverview, domainId }} />
      </main>

      {/* Multi-Format Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        domainId={domainId}
        domainName={domainOverview?.name || domainId}
      />
    </div>
  );
}
