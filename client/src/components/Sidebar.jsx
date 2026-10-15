import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  Layers,
  TrendingUp,
  Grid3X3,
  FileText,
  Cpu,
  AlertCircle,
  Lightbulb,
  Download,
  ExternalLink,
} from 'lucide-react';

export function Sidebar({ domainName, onExport }) {
  const { domainId } = useParams();

  const navItems = [
    { to: `/domain/${domainId}/landscape`, label: 'Landscape', icon: Layers },
    { to: `/domain/${domainId}/trends`, label: 'Trends', icon: TrendingUp },
    { to: `/domain/${domainId}/gap-map`, label: 'Gap Map', icon: Grid3X3 },
    { to: `/domain/${domainId}/papers`, label: 'Papers', icon: FileText },
    { to: `/domain/${domainId}/methods`, label: 'Methods & Datasets', icon: Cpu },
    { to: `/domain/${domainId}/challenges`, label: 'Open Challenges', icon: AlertCircle },
    { to: `/domain/${domainId}/suggestions`, label: 'Suggested Topics', icon: Lightbulb },
  ];

  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-domain-badge">Active Domain</div>
        <div className="sidebar-domain-title" title={domainName || domainId}>
          {domainName || domainId}
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          className="btn btn-outline"
          style={{ width: '100%', fontSize: '0.85rem' }}
          onClick={onExport}
        >
          <Download size={15} />
          <span>Export Report</span>
        </button>
      </div>
    </aside>
  );
}
