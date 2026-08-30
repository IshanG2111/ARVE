import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type TargetWebsite } from '../services/api';
import { useProjects } from '../hooks/useProjects';
import type { Project, AnalysisRun, Scan, SecurityFinding } from '@/types';

interface RepositoryContextType {
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;
  isLoading: boolean;
  selectProject: (projectId: string) => void;
  refreshProjects: () => void;
  runs: AnalysisRun[];
  latestRun: AnalysisRun | null;
  scans: Scan[];
  latestScan: Scan | null;
  isScanActive: boolean;
  refreshRuns: () => void;
  refreshScans: () => void;
  findings: SecurityFinding[];
  setFindings: React.Dispatch<React.SetStateAction<SecurityFinding[]>>;
  targets: TargetWebsite[];
  displayName: string;
  repoLabel: string;
  defaultBranch: string;
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

export function projectDisplayName(p?: Project | null): string {
  if (!p) return 'Repository Workspace';
  if (p.name) return p.name;
  if (p.repository?.name) return p.repository.name;
  if (p.repo_name) return p.repo_name.split('/').pop() || p.repo_name;
  return 'Untitled repository';
}

export function projectRepoLabel(p?: Project | null): string {
  if (!p) return '';
  if (p.repository?.full_name) return p.repository.full_name;
  if (p.repo_name) return p.repo_name;
  return '';
}

export const RepositoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useProjects();

  // Extract repo ID from URL search param or URL path (/projects/:id)
  const pathProjectId = location.pathname.startsWith('/projects/') ? location.pathname.split('/')[2] : null;
  const repoParam = searchParams.get('repo') || pathProjectId;

  // Selected project resolution
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (repoParam && projects.some(p => p.id === repoParam)) {
      setSelectedId(repoParam);
    } else if (projects.length > 0 && (!selectedId || !projects.some(p => p.id === selectedId))) {
      setSelectedId(projects[0].id);
    }
  }, [repoParam, projects, selectedId]);

  const currentProject = useMemo(() => {
    if (!projects.length) return null;
    return projects.find((p) => p.id === selectedId) || projects[0] || null;
  }, [projects, selectedId]);

  const currentProjectId = currentProject?.id || null;

  // Query analysis runs for the active project
  const { data: runs = [], refetch: refreshRuns } = useQuery({
    queryKey: ['analysis-runs', currentProjectId],
    queryFn: () => (currentProjectId ? api.getAnalysisRuns(currentProjectId) : Promise.resolve([])),
    enabled: !!currentProjectId,
  });

  // Query scans for the active project (polls when active)
  const { data: scans = [], refetch: refreshScans } = useQuery({
    queryKey: ['scans', currentProjectId],
    queryFn: () => (currentProjectId ? api.getProjectScans(currentProjectId) : Promise.resolve([])),
    enabled: !!currentProjectId,
    refetchInterval: (query) => {
      const latest = query.state.data?.[0];
      return latest && ['QUEUED', 'INGESTING', 'SCANNING', 'NORMALIZING'].includes(latest.status) ? 2000 : false;
    },
  });

  const latestRun = runs.length > 0 ? runs[0] : null;
  const latestScan = scans.length > 0 ? scans[0] : null;
  const isScanActive = Boolean(
    latestScan && ['QUEUED', 'INGESTING', 'SCANNING', 'NORMALIZING'].includes(latestScan.status)
  );

  // In-memory or persisted normalized findings state
  const [findings, setFindings] = useState<SecurityFinding[]>([]);

  const selectProject = useCallback(
    (projectId: string) => {
      setSelectedId(projectId);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('repo', projectId);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const refreshProjects = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    if (currentProjectId) {
      queryClient.invalidateQueries({ queryKey: ['analysis-runs', currentProjectId] });
      queryClient.invalidateQueries({ queryKey: ['scans', currentProjectId] });
    }
  }, [queryClient, currentProjectId]);
  const value = useMemo(
    () => ({
      projects,
      currentProject,
      currentProjectId,
      isLoading,
      selectProject,
      refreshProjects,
      runs,
      latestRun,
      scans,
      latestScan,
      isScanActive,
      refreshRuns,
      refreshScans,
      findings,
      setFindings,
      targets: currentProject?.targets || [],
      displayName: projectDisplayName(currentProject),
      repoLabel: projectRepoLabel(currentProject),
      defaultBranch: currentProject?.branch || currentProject?.default_branch || 'main',
    }),
    [
      projects,
      currentProject,
      currentProjectId,
      isLoading,
      selectProject,
      refreshProjects,
      runs,
      latestRun,
      scans,
      latestScan,
      isScanActive,
      refreshRuns,
      refreshScans,
      findings,
    ]
  );

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
};

export function useRepository(): RepositoryContextType {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRepository must be used within a RepositoryProvider');
  }
  return context;
}
