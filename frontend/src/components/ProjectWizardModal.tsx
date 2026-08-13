import React, { useState } from 'react';
import { useGitHubRepos, useBranchesByName } from '../hooks/useRepositories';
import { useCreateProject } from '../hooks/useProjects';
import type { GitHubRepo } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

type Step = 1 | 2 | 3;

const STEP_LABELS = ['Repository', 'Branch', 'Deployment'];

export const ProjectWizardModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const [step, setStep] = useState<Step>(1);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingPrivateRepo, setPendingPrivateRepo] = useState<GitHubRepo | null>(null);

  const { data: repos = [], isLoading: loadingRepos } = useGitHubRepos();
  const { data: branches = [], isLoading: loadingBranches } = useBranchesByName(
    selectedRepo?.full_name ?? null
  );
  const createProject = useCreateProject();

  // Auto-pick the first public repo. Private repositories require explicit confirmation.
  React.useEffect(() => {
    if (repos.length > 0 && !selectedRepo) {
      const firstPublicRepo = repos.find((repo) => !repo.private);
      if (firstPublicRepo) setSelectedRepo(firstPublicRepo);
    }
  }, [repos, selectedRepo]);

  const selectRepository = (repo: GitHubRepo) => {
    if (repo.private) {
      setPendingPrivateRepo(repo);
      return;
    }
    setSelectedRepo(repo);
  };

  const confirmPrivateRepository = () => {
    if (pendingPrivateRepo) {
      setSelectedRepo(pendingPrivateRepo);
    }
    setPendingPrivateRepo(null);
  };

  // Auto-pick default branch when repo changes
  React.useEffect(() => {
    if (selectedRepo) {
      setSelectedBranch(selectedRepo.default_branch || 'main');
    }
  }, [selectedRepo]);

  const goNext = () => {
    if (step === 1) {
      if (!selectedRepo) { setError('Select a repository'); return; }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (!selectedBranch) { setError('Select a branch'); return; }
      setError(null);
      setStep(3);
    }
  };

  const goBack = () => {
    setError(null);
    setStep((s) => (s - 1) as Step);
  };

  const handleCreate = async () => {
    if (!selectedRepo) { setError('No repository selected'); return; }
    setError(null);

    const trimmedUrl = deploymentUrl.trim();

    createProject.mutate(
      {
        branch: selectedBranch,
        deployment_url: trimmedUrl || undefined,
        name: selectedRepo.name,
        description: selectedRepo.description || undefined,
        repository: {
          github_repo_id: selectedRepo.id,
          owner: selectedRepo.full_name.split('/')[0] || 'unknown',
          name: selectedRepo.name,
          full_name: selectedRepo.full_name,
          html_url: selectedRepo.html_url,
          default_branch: selectedRepo.default_branch,
          language: selectedRepo.language,
          description: selectedRepo.description,
          private: selectedRepo.private,
        },
      },
      {
        onSuccess: () => {
          onCreated();
          onClose();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to create project');
        },
      }
    );
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div className="modal-title">New project</div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '18px', padding: '0 4px', lineHeight: 1, color: 'var(--muted)' }}
            onClick={onClose}
            id="close-wizard"
          >
            ×
          </button>
        </div>
        <div className="modal-sub">Connect a GitHub repository to start security analysis</div>

        {/* Steps */}
        <div className="steps">
          {STEP_LABELS.map((label, idx) => {
            const n = (idx + 1) as Step;
            const state = n < step ? 'done' : n === step ? 'active' : '';
            return (
              <React.Fragment key={n}>
                {idx > 0 && <div className="step-connector" />}
                <div className={`step ${state}`}>
                  <div className="step-num">{n < step ? '✓' : n}</div>
                  <span>{label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        {/* ── Step 1: Repository ── */}
        {step === 1 && (
          <div>
            <div className="label" style={{ marginBottom: '8px' }}>Select a GitHub repository</div>

            {loadingRepos ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: '12px', color: 'var(--dim)' }}>Loading repositories…</p>
              </div>
            ) : repos.length === 0 ? (
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                No repositories found. Make sure your GitHub account has repositories.
              </div>
            ) : (
              <div className="list-scroll">
                {repos.map((repo) => (
                  <div
                    key={repo.id}
                    className={`list-item${selectedRepo?.id === repo.id ? ' selected' : ''}`}
                    onClick={() => selectRepository(repo)}
                    id={`repo-${repo.id}`}
                  >
                    <div className="list-item-title">{repo.full_name}</div>
                    {repo.description && (
                      <div className="list-item-sub">{repo.description}</div>
                    )}
                    <div className="list-item-tags">
                      {repo.language && <span className="list-tag">{repo.language}</span>}
                      <span className="list-tag">{repo.default_branch}</span>
                      {repo.private && <span className="list-tag list-tag-private">Private</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="btn btn-primary" onClick={goNext} id="wizard-next-1">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Branch ── */}
        {step === 2 && (
          <div>
            {/* Selected repo reminder */}
            {selectedRepo && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
                fontSize: '12.5px',
                color: 'var(--secondary)',
                fontWeight: 500,
              }}>
                {selectedRepo.full_name}
              </div>
            )}

            <div className="label" style={{ marginBottom: '8px' }}>Select a branch</div>

            {loadingBranches ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: '12px', color: 'var(--dim)' }}>Loading branches…</p>
              </div>
            ) : (
              <div className="list-scroll" style={{ maxHeight: '200px' }}>
                {branches.map((branch) => (
                  <div
                    key={branch.name}
                    className={`list-item${selectedBranch === branch.name ? ' selected' : ''}`}
                    onClick={() => setSelectedBranch(branch.name)}
                    id={`branch-${branch.name}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="list-item-title">{branch.name}</div>
                      {branch.protected && (
                        <span className="badge badge-lock" style={{ fontSize: '10px' }}>Protected</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={goBack} id="wizard-back-2">
                ← Back
              </button>
              <button className="btn btn-primary" onClick={goNext} id="wizard-next-2">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Deployment URL ── */}
        {step === 3 && (
          <div>
            {/* Summary */}
            {selectedRepo && (
              <div style={{
                padding: '12px 14px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
                fontSize: '12.5px',
                color: 'var(--secondary)',
              }}>
                <div style={{ fontWeight: 600 }}>{selectedRepo.full_name}</div>
                <div style={{ marginTop: '2px', color: 'var(--muted)' }}>Branch: {selectedBranch}</div>
              </div>
            )}

            <div className="field" style={{ marginBottom: '20px' }}>
              <label className="label" htmlFor="deployment-url-input">
                Deployment URL <span style={{ color: 'var(--dim)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="deployment-url-input"
                type="url"
                className="input"
                placeholder="https://my-app.vercel.app (optional)"
                value={deploymentUrl}
                onChange={(e) => setDeploymentUrl(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <span style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '2px' }}>
                The live deployment associated with this repository (optional)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={goBack} id="wizard-back-3">
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={createProject.isPending}
                id="create-project-submit"
              >
                {createProject.isPending ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingPrivateRepo && (
        <ConfirmModal
          title="Private repository"
          message={
            <>
              <strong style={{ color: 'var(--primary)' }}>{pendingPrivateRepo.full_name}</strong> is a private GitHub repository.
              ARVE will need access to its source code for security analysis. Do you want to connect this private repository?
            </>
          }
          confirmText="Connect private repo"
          cancelText="Cancel"
          onConfirm={confirmPrivateRepository}
          onCancel={() => setPendingPrivateRepo(null)}
        />
      )}
    </div>
  );
};
