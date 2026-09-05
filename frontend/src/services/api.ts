import axios from 'axios';
import type {
  User,
  GitHubRepo,
  Branch,
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  TargetWebsite,
  VerificationResult,
  AnalysisRun,
  AnalysisSummary,
  RepositoryFile,
  Scan,
  ScanStatusResponse,
  SecurityFinding,
} from '@/types';

export type {
  User,
  GitHubRepo,
  Branch,
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  TargetWebsite,
  VerificationResult,
  AnalysisRun,
  AnalysisSummary,
  RepositoryFile,
  Scan,
  ScanStatusResponse,
  SecurityFinding,
};

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE = `${API_URL}/api`;

export const api: any = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('arve_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Auth ───────────────────────────────────────────────────────────────────
export async function getMe(): Promise<User> {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<User>(res);
}

export async function loginWithFirebase(
  idToken: string,
  githubAccessToken?: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`${BASE}/auth/firebase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id_token: idToken, github_access_token: githubAccessToken }),
  });
  const data = await handleResponse<{ access_token: string }>(res);
  if (data.access_token) localStorage.setItem('arve_token', data.access_token);
  return data;
}

// ─── GitHub repository discovery ────────────────────────────────────────────
export async function getGitHubRepos(): Promise<GitHubRepo[]> {
  const res = await fetch(`${BASE}/repositories/github/list`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<GitHubRepo[]>(res);
}

export async function getBranchesByFullName(fullName: string): Promise<Branch[]> {
  const res = await fetch(`${BASE}/github/branches?full_name=${encodeURIComponent(fullName)}`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<Branch[]>(res);
}

// ─── Projects ──────────────────────────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/projects`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<Project[]>(res);
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${BASE}/projects/${id}`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<Project>(res);
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return handleResponse<Project>(res);
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  const res = await fetch(`${BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return handleResponse<Project>(res);
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${BASE}/projects/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  await handleResponse<void>(res);
}

// ─── Targets ────────────────────────────────────────────────────────────────
export async function addTarget(projectId: string, domain: string): Promise<TargetWebsite> {
  const res = await fetch(`${BASE}/projects/${projectId}/targets`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ domain }),
  });
  return handleResponse<TargetWebsite>(res);
}

export async function getTargets(projectId: string): Promise<TargetWebsite[]> {
  const res = await fetch(`${BASE}/projects/${projectId}/targets`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<TargetWebsite[]>(res);
}

export async function deleteTarget(targetId: string): Promise<void> {
  const res = await fetch(`${BASE}/targets/${targetId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  await handleResponse<void>(res);
}

export async function verifyTarget(targetId: string): Promise<VerificationResult> {
  const res = await fetch(`${BASE}/targets/${targetId}/verify`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<VerificationResult>(res);
}

// ─── Phase 2: Repository ingestion ─────────────────────────────────────────
export async function triggerIngestion(projectId: string): Promise<AnalysisRun> {
  const res = await fetch(`${BASE}/projects/${projectId}/ingest`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({}),
  });
  return handleResponse<AnalysisRun>(res);
}

export async function getAnalysisRuns(projectId: string): Promise<AnalysisRun[]> {
  const res = await fetch(`${BASE}/projects/${projectId}/analysis-runs`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<AnalysisRun[]>(res);
}

export async function waitForIngestionRun(
  projectId: string,
  runId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AnalysisRun> {
  const intervalMs = options.intervalMs ?? 1500;
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const runs = await getAnalysisRuns(projectId);
    const run = runs.find((candidate) => candidate.id === runId);
    if (!run) throw new Error('Ingestion run could not be found.');
    const status = run.status?.toUpperCase();
    if (status === 'COMPLETED') return run;
    if (['FAILED', 'CANCELLED', 'PARTIAL'].includes(status)) {
      throw new Error(run.error_message || `Ingestion ${status.toLowerCase()}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for repository ingestion to complete.');
}

export async function getAnalysisSummary(runId: string): Promise<AnalysisSummary> {
  const res = await fetch(`${BASE}/analysis-runs/${runId}/summary`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<AnalysisSummary>(res);
}

export async function getAnalysisFiles(runId: string, statusFilter?: string): Promise<RepositoryFile[]> {
  const query = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
  const res = await fetch(`${BASE}/analysis-runs/${runId}/files${query}`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<RepositoryFile[]>(res);
}

// ─── Phase 3: scan orchestration ───────────────────────────────────────────
export async function createScan(projectId: string, analysisRunId?: string): Promise<Scan> {
  const res = await fetch(`${BASE}/projects/${projectId}/scan`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(analysisRunId ? { analysis_run_id: analysisRunId } : {}),
  });
  return handleResponse<Scan>(res);
}

export async function getScanStatus(scanId: string): Promise<ScanStatusResponse> {
  const res = await fetch(`${BASE}/scans/${scanId}/status`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<ScanStatusResponse>(res);
}

export async function cancelScan(scanId: string): Promise<Scan> {
  const res = await fetch(`${BASE}/scans/${scanId}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<Scan>(res);
}

export async function getProjectScans(projectId: string): Promise<Scan[]> {
  const res = await fetch(`${BASE}/projects/${projectId}/scans`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<Scan[]>(res);
}

// ─── Phase 4: Security Findings ───────────────────────────────────────────
export async function getProjectFindings(projectId: string): Promise<SecurityFinding[]> {
  const res = await fetch(`${BASE}/projects/${projectId}/findings`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<SecurityFinding[]>(res);
}

export async function getScanFindings(scanId: string): Promise<SecurityFinding[]> {
  const res = await fetch(`${BASE}/scans/${scanId}/findings`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<SecurityFinding[]>(res);
}

export async function updateFindingStatus(
  findingId: string,
  payload: {
    status: string;
    suppression_reason?: string;
    suppression_justification?: string;
    suppression_expires_at?: string;
  },
): Promise<SecurityFinding> {
  const res = await fetch(`${BASE}/findings/${findingId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return handleResponse<SecurityFinding>(res);
}

export async function getEngineArtifact(scanId: string, engineName: string = 'osv'): Promise<any> {
  const res = await fetch(`${BASE}/scans/${scanId}/engines/${engineName}/artifact`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<any>(res);
}

Object.assign(api, {
  me: getMe,
  getGitHubRepos,
  getBranchesByFullName,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addTarget,
  getTargets,
  deleteTarget,
  verifyTarget,
  triggerIngestion,
  getAnalysisRuns,
  getAnalysisSummary,
  getAnalysisFiles,
  createScan,
  getScanStatus,
  cancelScan,
  getProjectScans,
  getProjectFindings,
  getScanFindings,
  updateFindingStatus,
  getEngineArtifact,
});
