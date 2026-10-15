import React from 'react';

export function Skeleton({ width = '100%', height = '16px', radius = 'var(--radius-sm)', style = {} }) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton width="40%" height="22px" />
      <Skeleton width="90%" height="14px" />
      <Skeleton width="75%" height="14px" />
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <Skeleton width="60px" height="22px" radius="999px" />
        <Skeleton width="80px" height="22px" radius="999px" />
        <Skeleton width="70px" height="22px" radius="999px" />
      </div>
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Skeleton width="50%" height="14px" />
      <Skeleton width="70%" height="32px" />
      <Skeleton width="40%" height="12px" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="table-container" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height="18px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${100 / cols}%`} height="16px" />
          ))}
        </div>
      ))}
    </div>
  );
}
