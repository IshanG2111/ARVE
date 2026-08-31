import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Navbar } from '../Navbar';
import { RepositoryProvider } from '../../context/RepositoryContext';
import { DotField } from '../ui/DotField';

export const AppShell: React.FC = () => {
  const { user } = useAuth();

  return (
    <RepositoryProvider>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          position: 'relative',
          isolation: 'isolate',
        }}
      >
        {/* Global ambient DotField interactive background */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            opacity: 0.9,
          }}
          aria-hidden="true"
        >
          <DotField
            dotRadius={1.5}
            dotSpacing={16}
            bulgeStrength={55}
            glowRadius={170}
            sparkle={true}
          />
        </div>

        <Navbar user={user} />
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Outlet />
        </main>
      </div>
    </RepositoryProvider>
  );
};

export default AppShell;

