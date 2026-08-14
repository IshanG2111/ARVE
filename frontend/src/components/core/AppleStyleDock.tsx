import React from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import {
  Home,
  GitBranch,
  Network,
  ScanLine,
  Crosshair,
  Activity,
} from 'lucide-react';
import { Dock, DockIcon, DockItem, DockLabel } from '@/components/core/dock';

export const AppleStyleDock: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: projects = [] } = useProjects();

  const currentRepoParam = searchParams.get('repo');
  const activeProject = projects.find((p) => p.id === currentRepoParam) || projects[0] || null;
  const activeRepoId = activeProject?.id;

  const currentPath = location.pathname;

  const data = [
    {
      id: 'home',
      title: 'Home — overview',
      shortTitle: 'Home',
      icon: <Home size={16} strokeWidth={1.75} />,
      isActive: currentPath === '/dashboard',
      action: () => navigate(activeRepoId ? `/dashboard?repo=${activeRepoId}` : '/dashboard'),
    },
    {
      id: 'repository',
      title: 'Repository — repo/files',
      shortTitle: 'Repository',
      icon: <GitBranch size={16} strokeWidth={1.75} />,
      isActive: currentPath.startsWith('/projects'),
      action: () => {
        if (activeRepoId) {
          navigate(`/projects/${activeRepoId}`);
        } else {
          navigate('/dashboard');
        }
      },
    },
    {
      id: 'graph',
      title: 'Graph — AST/code graph',
      shortTitle: 'Graph',
      icon: <Network size={16} strokeWidth={1.75} />,
      isActive: currentPath === '/workbench',
      action: () => navigate('/workbench'),
    },
    {
      id: 'scan',
      title: 'Scan — security analysis',
      shortTitle: 'Scan',
      icon: <ScanLine size={16} strokeWidth={1.75} />,
      isActive: currentPath === '/scans',
      action: () => navigate('/scans'),
    },
    {
      id: 'findings',
      title: 'Findings — vulnerabilities',
      shortTitle: 'Findings',
      icon: <Crosshair size={16} strokeWidth={1.75} />,
      isActive: currentPath === '/workbench',
      action: () => navigate('/workbench'),
    },
    {
      id: 'activity',
      title: 'Activity — history/events',
      shortTitle: 'Activity',
      icon: <Activity size={16} strokeWidth={1.75} />,
      isActive: false,
      action: () => {
        if (currentPath === '/dashboard') {
          const el = document.getElementById('workspace-activity-card');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
        navigate('/scans');
      },
    },
  ];

  return (
    <div className="fixed bottom-3 left-1/2 max-w-full -translate-x-1/2 z-50 pointer-events-auto">
      <Dock className="items-center">
        {data.map((item) => {
          const isItemActive = item.isActive;
          return (
            <DockItem
              key={item.id}
              onClick={item.action}
              className="aspect-square rounded-full transition-all duration-150 relative"
              style={{
                background: isItemActive ? 'var(--elevated-2)' : 'var(--elevated)',
                border: isItemActive ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                color: isItemActive ? 'var(--accent)' : 'var(--secondary)',
                boxShadow: isItemActive ? '0 0 12px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
              }}
            >
              <DockLabel>{item.title}</DockLabel>
              <DockIcon>{item.icon}</DockIcon>

              {isItemActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
              )}
            </DockItem>
          );
        })}
      </Dock>
    </div>
  );
};

export default AppleStyleDock;
