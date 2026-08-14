import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScannerPage } from './pages/ScannerPage';
import { WorkbenchPage } from './pages/WorkbenchPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ToastProvider } from './components/ui/ToastProvider';
import { SmoothScrollProvider } from './hooks/useSmoothScroll';
import { LoadingAnimation } from './components/ui/LoadingAnimation';

/** Guard: redirect authenticated users away from landing */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="screen-center" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingAnimation fullScreen={false} />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <ToastProvider>
      <SmoothScrollProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar user={user} />
          <main style={{ flex: 1 }}>
            <Routes>
              <Route
                path="/"
                element={
                  <PublicOnly>
                    <LandingPage />
                  </PublicOnly>
                }
              />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/scans" element={<ScannerPage />} />
                <Route path="/workbench" element={<WorkbenchPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
              </Route>
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          {user && <Footer />}
        </div>
      </SmoothScrollProvider>
    </ToastProvider>
  );
};

export default App;
