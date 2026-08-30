import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Navbar } from '../Navbar';
import { RepositoryProvider } from '../../context/RepositoryContext';

export const AppShell: React.FC = () => {
  const { user } = useAuth();

  return (
    <RepositoryProvider>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <Navbar user={user} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <Outlet />
        </main>
      </div>
    </RepositoryProvider>
  );
};

export default AppShell;
