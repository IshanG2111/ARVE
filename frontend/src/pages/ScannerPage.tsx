import React, { useEffect, useState } from 'react';
import { useProjects } from '../hooks/useProjects';
import { LiveScanSimulator } from '../components/LiveScanSimulator';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { Cpu, ChevronDown } from 'lucide-react';
import type { AnalysisRun, Project } from '@/types';
import { api } from '../services/api';

function projectDisplayName(p: Project): string {
  if (p.name) return p.name;
  if (p.repository?.name) return p.repository.name;
  if (p.repo_name) return p.repo_name.split('/').pop() || p.repo_name;
  return 'Untitled repository';
}

export const ScannerPage: React.FC = () => {
  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [analysisRun, setAnalysisRun] = useState<AnalysisRun | null>(null);

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  useEffect(() => {
    if (!activeProject?.id) {
      setAnalysisRun(null);
      return;
    }
    let cancelled = false;
    api.getAnalysisRuns(activeProject.id)
      .then((runs) => {
        if (cancelled) return;
        setAnalysisRun(runs.find((run) => run.status === 'COMPLETED') || null);
      })
      .catch(() => {
        if (!cancelled) setAnalysisRun(null);
      });
    return () => { cancelled = true; };
  }, [activeProject?.id]);
  const activeName = activeProject ? projectDisplayName(activeProject) : 'ARVE Core Engine';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 54px)', position: 'relative', zIndex: 1 }}>
      <HalftoneBackground interactive={false} showHero={false} />

      <div className="dashboard anim-fade-up">
        {/* Page Header */}
        <div className="dashboard-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-info" style={{ fontSize: '10.5px' }}>
                <Cpu size={12} /> Scan Orchestration
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                Phase 2 snapshot • Celery • Docker
              </span>
            </div>
            <h1 className="dashboard-title">Repository Scan Orchestrator</h1>
            <p className="dashboard-sub">
              Run the selected commit-pinned Phase 2 snapshot asynchronously through the Phase 3 worker and Docker sandbox.
            </p>
          </div>

          {/* Repository Selector */}
          {projects.length > 0 && (
            <div style={{ minWidth: '220px' }}>
              <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>Target Repository</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="input"
                  style={{
                    fontFamily: 'var(--font-code)',
                    fontSize: '12px',
                    paddingRight: '30px',
                    appearance: 'none',
                    background: 'var(--surface)',
                  }}
                  value={activeProject?.id}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {projectDisplayName(p)} ({p.branch || 'main'})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  color="var(--muted)"
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Real Phase 3 scan orchestration component */}
        <LiveScanSimulator
          projectId={activeProject?.id || ''}
          projectName={activeName}
          analysisRunId={analysisRun?.id}
          analysisRun={analysisRun}
        />
      </div>
    </div>
  );
};
