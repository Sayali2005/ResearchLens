import React from 'react';
import { X, FileText, Database, Printer, Download, CheckCircle2 } from 'lucide-react';

export function ExportModal({ isOpen, onClose, domainId, domainName }) {
  if (!isOpen) return null;

  const handleDownloadJson = () => {
    window.open(`/api/export/${encodeURIComponent(domainId)}.json`, '_blank');
  };

  const handleDownloadCsv = () => {
    window.open(`/api/export/${encodeURIComponent(domainId)}.csv`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div>
            <div className="badge badge-indigo" style={{ marginBottom: '6px' }}>
              Export Center
            </div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)' }}>
              Export Research Dossier: {domainName || domainId}
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Choose your preferred format for thesis submission, grant proposal, or data analysis.
            </p>
          </div>
          <button className="btn btn-subtle btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Export Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* JSON Full Dossier */}
          <div
            className="panel-subtle"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'border-color 0.15s ease' }}
            onClick={handleDownloadJson}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-indigo)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-indigo-light)',
                  color: 'var(--accent-indigo)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Database size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Complete Research Dossier (JSON)
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Full snapshot: sub-area trends, gap matrix, methods, challenges, and reading roadmap.
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm">
              <Download size={14} />
              <span>JSON</span>
            </button>
          </div>

          {/* CSV Papers & Metrics */}
          <div
            className="panel-subtle"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'border-color 0.15s ease' }}
            onClick={handleDownloadCsv}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-indigo)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Literature & Quality Metrics (CSV)
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Tabular spreadsheet: titles, venues, citations, quality scores, and limitation callouts.
                </div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm">
              <Download size={14} />
              <span>CSV</span>
            </button>
          </div>

          {/* Printable Report View */}
          <div
            className="panel-subtle"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'border-color 0.15s ease' }}
            onClick={handlePrint}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-indigo)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-warning-bg)',
                  color: 'var(--color-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Printer size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Printable Summary / PDF Report
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Clean, print-optimized document view formatted for thesis committees and advisors.
                </div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm">
              <Printer size={14} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          All exported files include scholarly attribution and verification disclaimers.
        </div>
      </div>
    </div>
  );
}
