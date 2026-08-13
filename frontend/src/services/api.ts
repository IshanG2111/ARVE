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
} from '../types';

export type {
  User,
  GitHubRepo,
  Branch,
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  TargetWebsite,
  VerificationResult,
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
  if (res.status === 204) {
    return undefined as T;
  }
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

export async function logout() {
  localStorage.removeItem('arve_token');
  try {
    await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch (err) {
    // Ignore network error on logout
  }
}

// ─── GitHub repositories ───────────────────────────────────────────────────
export async function getGitHubRepos(): Promise<GitHubRepo[]> {
  const res = await fetch(`${BASE}/repositories/github/list`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<GitHubRepo[]>(res);
}

export async function getBranches(repoId: string): Promise<Branch[]> {
  const res = await fetch(`${BASE}/repositories/${repoId}/branches`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<Branch[]>(res);
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

// ─── Ingestion ────────────────────────────────────────────────────────────────
export async function triggerIngestion(repoId: string): Promise<any> {
  const res = await fetch(`${BASE}/repositories/${repoId}/ingest`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<any>(res);
}

export async function getAnalysisRuns(repoId: string): Promise<any[]> {
  const res = await fetch(`${BASE}/repositories/${repoId}/analysis-runs`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<any[]>(res);
}

export async function getAnalysisSummary(runId: string): Promise<any> {
  const res = await fetch(`${BASE}/analysis-runs/${runId}/summary`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<any>(res);
}

export async function getAnalysisFiles(runId: string, statusFilter?: string): Promise<any[]> {
  const url = statusFilter 
    ? `${BASE}/analysis-runs/${runId}/files?status_filter=${statusFilter}`
    : `${BASE}/analysis-runs/${runId}/files`;
  const res = await fetch(url, {
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<any[]>(res);
}

Object.assign(api, {
  me: getMe,
  getGitHubRepos,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  logout,
  addTarget,
  getTargets,
  deleteTarget,
  verifyTarget,
  triggerIngestion,
  getAnalysisRuns,
  getAnalysisSummary,
  getAnalysisFiles,
});
