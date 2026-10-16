import React, { useState } from 'react';
import { X, ExternalLink, Bookmark, Copy, Check, FileText, Award, Shield } from 'lucide-react';

export function PaperDrawer({ paper, isOpen, onClose, onSave }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !paper) return null;

  const quality = paper.quality || {};
  const authorsList = paper.authors || [];
  const authorNames = authorsList.map((a) => (typeof a === 'string' ? a : a.name)).join(', ');

  const generateBibtex = () => {
    const firstAuthor = authorsList[0] ? (typeof authorsList[0] === 'string' ? authorsList[0] : authorsList[0].name).split(' ').pop().toLowerCase() : 'author';
    const year = paper.year || '2024';
    const key = `${firstAuthor}${year}${paper.id ? paper.id.slice(-4) : 'paper'}`;
    return `@article{${key},
  title={${paper.title}},
  author={${authorNames}},
  journal={${paper.venue || 'ResearchLens Corpus'}},
  year={${year}},
  doi={${paper.doi || ''}}
}`;
  };

  const handleCopyBibtex = () => {
    navigator.clipboard.writeText(generateBibtex());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #CBD5E1',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.12)',
          overflowY: 'auto',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {paper.type && <span className="badge badge-stable" style={{ textTransform: 'capitalize' }}>{paper.type}</span>}
              {paper.is_open_access && <span className="badge badge-emerging">Open Access</span>}
              {quality.is_top_venue && (
                <span className="badge badge-indigo">
                  <Award size={12} />
                  <span>Tier 1 Venue</span>
                </span>
              )}
              {quality.is_top_institution && (
                <span className="badge badge-indigo">
                  <Shield size={12} />
                  <span>Top Institution</span>
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.25rem', lineHeight: 1.35, color: 'var(--text-heading)' }}>
              {paper.title}
            </h2>
          </div>
          <button className="btn btn-subtle btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Authors and Affiliations */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Authors
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
            {authorNames || 'Unknown Authors'}
          </div>
        </div>

        {/* Metadata Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div className="panel-subtle" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Venue & Year</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '2px' }}>
              {paper.venue || 'N/A'} ({paper.year || 'N/A'})
            </div>
          </div>
          <div className="panel-subtle" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Citations</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '2px' }}>
              {paper.citation_count?.toLocaleString() || 0} citations
              {paper.influential_citation_count > 0 && ` (${paper.influential_citation_count} influential)`}
            </div>
          </div>
        </div>

        {/* Abstract */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Abstract
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.6, backgroundColor: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
            {paper.abstract || 'No abstract available for this publication.'}
          </div>
        </div>

        {/* Extracted Limitations Callout */}
        {paper.limitation_callout && (
          <div
            style={{
              backgroundColor: 'var(--color-success-bg)',
              border: '1px solid var(--color-success-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: '4px', fontSize: '0.85rem' }}>
              Identified Limitations & Future Work:
            </div>
            <div
              style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: paper.limitation_callout.highlighted_sentence }}
            />
          </div>
        )}

        {/* 1-Click Direct Access & Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: 'auto', paddingTop: '18px', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
          {paper.pdf_url && (
            <a
              href={paper.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pdf"
            >
              <FileText size={14} />
              <span>Read PDF</span>
            </a>
          )}
          {paper.doi && (
            <a
              href={paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-doi"
            >
              <ExternalLink size={14} />
              <span>Publisher DOI</span>
            </a>
          )}
          {paper.arxiv_id && (
            <a
              href={`https://arxiv.org/abs/${paper.arxiv_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-arxiv"
            >
              <span>⚛️ arXiv</span>
            </a>
          )}
          {paper.landing_url && !paper.doi && (
            <a
              href={paper.landing_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              <ExternalLink size={14} />
              <span>Web</span>
            </a>
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={handleCopyBibtex}
            title="Copy BibTeX Citation"
          >
            {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'BibTeX'}</span>
          </button>
          {onSave && (
            <button
              className="btn btn-subtle btn-sm"
              onClick={() => onSave(paper)}
              title="Bookmark to Project Basket"
              style={{ marginLeft: 'auto' }}
            >
              <Bookmark size={15} />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
