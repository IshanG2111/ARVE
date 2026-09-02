import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingAnimation } from './ui/LoadingAnimation';

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingAnimation fullScreen={true} text="Initializing Workspace..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute;
