import React, { useState, useMemo, useEffect } from 'react';
import { useGitHubRepos, useBranchesByName } from '../hooks/useRepositories';
import { useCreateProject } from '../hooks/useProjects';
import type { GitHubRepo } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { ARVELoader } from './ui/ARVELoader';
import { Search, X, Check, GitBranch, ArrowLeft, ArrowRight, Lock, Globe } from 'lucide-react';

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
  const [repoSearch, setRepoSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingPrivateRepo, setPendingPrivateRepo] = useState<GitHubRepo | null>(null);

  const { data: repos = [], isLoading: loadingRepos } = useGitHubRepos();
  const { data: branches = [], isLoading: loadingBranches } = useBranchesByName(
    selectedRepo?.full_name ?? null
  );
  const createProject = useCreateProject();

  // Auto-pick the first public repo
  useEffect(() => {
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
  useEffect(() => {
    if (selectedRepo) {
      setSelectedBranch(selectedRepo.default_branch || 'main');
    }
  }, [selectedRepo]);

  // Keyboard support: Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return repos;
    return repos.filter((r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(repoSearch.toLowerCase()))
    );
  }, [repos, repoSearch]);

  const goNext = () => {
    if (step === 1) {
      if (!selectedRepo) { setError('Please select a repository'); return; }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (!selectedBranch) { setError('Please select a branch'); return; }
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
          setError(err instanceof Error ? err.message : 'Failed to connect repository');
        },
      }
    );
  };

  return (
    <div className="modal-overlay" data-lenis-prevent="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal anim-fade-up" data-lenis-prevent="true">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">Connect Repository Workspace</div>
            <div className="modal-sub">Link a GitHub repository for automated AST analysis & verification</div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            id="close-wizard"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step Progress Bar */}
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

        {/* Error alert */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '14px' }}>
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Repository Selection ── */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="label">Select a GitHub repository</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                {filteredRepos.length} available
              </span>
            </div>

            {/* Quick Repo Search to prevent endless scrolling */}
            <div className="input-wrap" style={{ marginBottom: '10px' }}>
              <span className="input-icon"><Search size={13} /></span>
              <input
                type="text"
                className="input"
                placeholder="Search repository by name…"
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                autoFocus
              />
            </div>

            {loadingRepos ? (
              <div style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
                <ARVELoader size={80} />
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="alert alert-info" style={{ marginBottom: '14px' }}>
                No matching repositories found.
              </div>
            ) : (
              <div className="list-scroll" data-lenis-prevent="true">
                {filteredRepos.map((repo) => {
                  const isSelected = selectedRepo?.id === repo.id;
                  return (
                    <div
                      key={repo.id}
                      className={`list-item${isSelected ? ' selected' : ''}`}
                      onClick={() => selectRepository(repo)}
                      id={`repo-${repo.id}`}
                    >
                      <div className="list-item-title">
                        <span>{repo.full_name}</span>
                        {isSelected && <Check size={14} color="var(--accent)" />}
                      </div>
                      {repo.description && (
                        <div className="list-item-sub">{repo.description}</div>
                      )}
                      <div className="list-item-tags">
                        {repo.language && <span className="list-tag">{repo.language}</span>}
                        <span className="list-tag">{repo.default_branch}</span>
                        {repo.private && (
                          <span className="list-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--warning)' }}>
                            <Lock size={9} /> Private
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-primary" onClick={goNext} id="wizard-next-1">
                Next: Branch <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Branch Selection ── */}
        {step === 2 && (
          <div>
            {selectedRepo && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>Repo:</span>
                <span style={{ fontWeight: 600 }}>{selectedRepo.full_name}</span>
              </div>
            )}

            <div className="label" style={{ marginBottom: '8px' }}>Select target branch</div>

            {loadingBranches ? (
              <div style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
                <ARVELoader size={80} />
              </div>
            ) : (
              <div className="list-scroll" data-lenis-prevent="true" style={{ maxHeight: '200px' }}>
                {branches.map((branch) => {
                  const isSelected = selectedBranch === branch.name;
                  return (
                    <div
                      key={branch.name}
                      className={`list-item${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelectedBranch(branch.name)}
                      id={`branch-${branch.name}`}
                    >
                      <div className="list-item-title">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <GitBranch size={12} color="var(--muted)" />
                          {branch.name}
                        </span>
                        {branch.protected && <span className="badge badge-lock" style={{ fontSize: '9.5px' }}>Protected</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px' }}>
              <button className="btn btn-secondary" onClick={goBack} id="wizard-back-2">
                <ArrowLeft size={13} /> Back
              </button>
              <button className="btn btn-primary" onClick={goNext} id="wizard-next-2">
                Next: Deployment <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Deployment URL ── */}
        {step === 3 && (
          <div>
            {selectedRepo && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedRepo.full_name}</div>
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-code)', fontSize: '11px' }}>
                  Active Branch: {selectedBranch}
                </div>
              </div>
            )}

            <div className="field" style={{ marginBottom: '18px' }}>
              <label className="label" htmlFor="deployment-url-input">
                Deployment Domain / URL <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <div className="input-wrap">
                <span className="input-icon"><Globe size={14} /></span>
                <input
                  id="deployment-url-input"
                  type="url"
                  className="input"
                  placeholder="https://staging.myapp.com (optional)"
                  value={deploymentUrl}
                  onChange={(e) => setDeploymentUrl(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                You can also add or verify domain targets after connecting the repository.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={goBack} id="wizard-back-3">
                <ArrowLeft size={13} /> Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={createProject.isPending}
                id="create-project-submit"
              >
                Connect &amp; Generate AST
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingPrivateRepo && (
        <ConfirmModal
          title="Connect private repository?"
          message={
            <>
              <strong style={{ color: 'var(--primary)' }}>{pendingPrivateRepo.full_name}</strong> is a private GitHub repository.
              ARVE will access its source code AST structure for security analysis.
            </>
          }
          confirmText="Connect Private Repository"
          cancelText="Cancel"
          onConfirm={confirmPrivateRepository}
          onCancel={() => setPendingPrivateRepo(null)}
        />
      )}
    </div>
  );
};
