import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Navbar } from '../Navbar';
import { RepositoryProvider, useRepository } from '../../context/RepositoryContext';
import { DotField } from '../ui/DotField';

const AppShellContent: React.FC = () => {
  const { user } = useAuth();
  const { isProjectLoading } = useRepository();

  return (
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
      {/* Top Transition Progress Bar when switching projects */}
      {isProjectLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '2.5px',
            zIndex: 99999,
            background: 'linear-gradient(90deg, #0052FF, #60A5FA, #0052FF)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.2s infinite linear',
          }}
        />
      )}

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
  );
};

export const AppShell: React.FC = () => {
  return (
    <RepositoryProvider>
      <AppShellContent />
    </RepositoryProvider>
  );
};

export default AppShell;

