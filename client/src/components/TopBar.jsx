import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Bookmark, BookOpen, Search, Sparkles } from 'lucide-react';

export function TopBar() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Link to="/" className="top-bar-brand">
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-indigo)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Compass size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ lineHeight: 1.1 }}>ResearchLens</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
              Decision Support for Research
            </span>
          </div>
        </Link>
      </div>

      <nav className="top-bar-nav">
        <Link
          to="/"
          className={`nav-link ${isActive('/') && !location.pathname.startsWith('/domain') && !location.pathname.startsWith('/saved') && !location.pathname.startsWith('/methodology') ? 'active' : ''}`}
        >
          <Search size={16} />
          <span>New Search</span>
        </Link>
        <Link
          to="/saved"
          className={`nav-link ${isActive('/saved') ? 'active' : ''}`}
        >
          <Bookmark size={16} />
          <span>Saved</span>
        </Link>
        <Link
          to="/methodology"
          className={`nav-link ${isActive('/methodology') ? 'active' : ''}`}
        >
          <BookOpen size={16} />
          <span>Methodology</span>
        </Link>
      </nav>
    </header>
  );
}
