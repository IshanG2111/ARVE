import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { FindingsPage } from './pages/FindingsPage';
import { CodeIntelligencePage } from './pages/CodeIntelligencePage';
import { TargetsPage } from './pages/TargetsPage';
import { RepositoryPage } from './pages/RepositoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { ToastProvider } from './components/ui/ToastProvider';
import { SmoothScrollProvider } from './hooks/useSmoothScroll';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <SmoothScrollProvider>
        <Routes>
          {/* Landing Page (Open to all; shows dynamic CTA when logged in) */}
          <Route path="/" element={<LandingPage />} />

          {/* Protected Application Workspace Routes wrapped in AppShell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/overview" element={<DashboardPage />} />
              <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/scans" element={<Navigate to="/analysis" replace />} />
              <Route path="/findings" element={<FindingsPage />} />
              <Route path="/code" element={<CodeIntelligencePage />} />
              <Route path="/code-intelligence" element={<Navigate to="/code" replace />} />
              <Route path="/targets" element={<TargetsPage />} />
              <Route path="/repository" element={<RepositoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/projects/:id" element={<Navigate to="/overview" replace />} />
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SmoothScrollProvider>
    </ToastProvider>
  );
};

export default App;
