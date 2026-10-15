import React from 'react';
import { RefreshCw, Database, Clock, Layers } from 'lucide-react';

export function DomainHeader({
  domainName,
  dataFreshness,
  sources = ['OpenAlex', 'Semantic Scholar', 'arXiv'],
  onRefresh,
  isRefreshing = false,
  isCached = true,
}) {
  const formattedDate = dataFreshness
    ? new Date(dataFreshness).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recent snapshot';

  return (
    <div className="domain-header">
      <div className="domain-header-top">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Analysis for:
            </span>
            {isCached && (
              <span className="badge badge-stable" style={{ fontSize: '0.7rem' }}>
                Cached
              </span>
            )}
          </div>
          <h1 style={{ marginTop: '2px' }}>{domainName}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh domain analysis and recalculate trends"
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="domain-meta-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} color="var(--text-muted)" />
          <span>Data as of {formattedDate}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Database size={14} color="var(--text-muted)" />
          <span>Sources:</span>
          <div className="source-chips">
            {sources.map((src) => (
              <span key={src} className="source-chip">
                {src}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
