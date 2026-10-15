import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { HomePage } from './pages/HomePage';
import { SavedPage } from './pages/SavedPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { DomainShell } from './pages/DomainShell';
import { LandscapeView } from './pages/domain/LandscapeView';
import { TrendsView } from './pages/domain/TrendsView';
import { GapMapView } from './pages/domain/GapMapView';
import { PapersView } from './pages/domain/PapersView';
import { MethodsView } from './pages/domain/MethodsView';
import { ChallengesView } from './pages/domain/ChallengesView';
import { SuggestionsView } from './pages/domain/SuggestionsView';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
        <TopBar />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />

            {/* Domain Analysis Shell with 7 sub-views */}
            <Route path="/domain/:domainId" element={<DomainShell />}>
              <Route index element={<Navigate to="landscape" replace />} />
              <Route path="landscape" element={<LandscapeView />} />
              <Route path="trends" element={<TrendsView />} />
              <Route path="gap-map" element={<GapMapView />} />
              <Route path="papers" element={<PapersView />} />
              <Route path="methods" element={<MethodsView />} />
              <Route path="challenges" element={<ChallengesView />} />
              <Route path="suggestions" element={<SuggestionsView />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
