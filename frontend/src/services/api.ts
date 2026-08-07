import axios from "axios";
import type { User, GitHubRepo, Branch, Project, CreateProjectPayload, TargetWebsite, VerificationResult } from '../types';

export type { User, GitHubRepo, Branch, Project, CreateProjectPayload, TargetWebsite, VerificationResult };

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE = `${API_URL}/api`;

export const api: any = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends/receives the httpOnly cookie
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
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function getMe(): Promise<User> {
  const res = await fetch(`${API_URL}/me`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) {
    const fallbackRes = await fetch(`${BASE}/auth/me`, { headers: authHeaders(), credentials: 'include' });
    return handleResponse<User>(fallbackRes);
  }
  return handleResponse<User>(res);
}

export async function getGitHubAuthUrl(): Promise<{ auth_url: string; is_configured: boolean }> {
  const res = await fetch(`${BASE}/github/auth-url`, { credentials: 'include' });
  return handleResponse(res);
}

export async function githubCallback(code: string, isMock = false): Promise<{ access_token: string }> {
  const res = await fetch(`${BASE}/github/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code, is_mock: isMock }),
  });
  const data = await handleResponse<{ access_token: string }>(res);
  if (data.access_token) {
    localStorage.setItem('arve_token', data.access_token);
  }
  return data;
}

export async function logout() {
  localStorage.removeItem('arve_token');
  try {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch (err) {
    // Ignore network error on logout
  }
}

// ─── GitHub Repos (wizard list) ───────────────────────────────────────────────
export async function getGitHubRepos(): Promise<GitHubRepo[]> {
  const res = await fetch(`${BASE}/repositories/github/list`, { headers: authHeaders(), credentials: 'include' });
  return handleResponse<GitHubRepo[]>(res);
}

// ─── Branches ─────────────────────────────────────────────────────────────────
export async function getBranches(repoId: string): Promise<Branch[]> {
  const res = await fetch(`${BASE}/repositories/${repoId}/branches`, { headers: authHeaders(), credentials: 'include' });
  return handleResponse<Branch[]>(res);
}

// Fetch branches from GitHub using full_name (for wizard before repo is saved)
export async function getBranchesByFullName(fullName: string): Promise<Branch[]> {
  const res = await fetch(`${BASE}/github/branches?full_name=${encodeURIComponent(fullName)}`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    return [
      { name: 'main', protected: true },
      { name: 'develop', protected: false },
    ];
  }
  return handleResponse<Branch[]>(res);
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/projects`, { headers: authHeaders(), credentials: 'include' });
  return handleResponse<Project[]>(res);
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${BASE}/projects/${id}`, { headers: authHeaders(), credentials: 'include' });
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

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${BASE}/projects/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Delete failed' }));
    throw new Error(err.detail || 'Delete failed');
  }
}

// ─── Targets ──────────────────────────────────────────────────────────────────
export async function addTarget(projectId: string, domain: string): Promise<TargetWebsite> {
  const res = await fetch(`${BASE}/targets/projects/${projectId}`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ domain }),
  });
  return handleResponse<TargetWebsite>(res);
}

export async function deleteTarget(targetId: string): Promise<void> {
  const res = await fetch(`${BASE}/targets/${targetId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Target delete failed' }));
    throw new Error(err.detail || 'Target delete failed');
  }
}

export async function verifyTarget(targetId: string): Promise<VerificationResult> {
  const res = await fetch(`${BASE}/targets/${targetId}/verify`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  });
  return handleResponse<VerificationResult>(res);
}

Object.assign(api, {
  me: getMe,
  getGitHubRepos,
  getProjects,
  getProject,
  createProject,
  deleteProject,
  githubCallback,
  logout,
  addTarget,
  deleteTarget,
  verifyTarget,
});
