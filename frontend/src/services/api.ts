const API_BASE_URL = 'http://localhost:8000/api';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  github_login?: string;
  github_avatar?: string;
  is_active: boolean;
  created_at: string;
}

export interface GitHubRepo {
  id: string;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
  language?: string;
  description?: string;
}

export interface TargetWebsite {
  id: string;
  project_id: string;
  domain: string;
  verification_token: string;
  is_verified: boolean;
  verified_at?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  repo_name?: string;
  repo_url?: string;
  repo_id?: string;
  default_branch?: string;
  created_at: string;
  targets: TargetWebsite[];
}

export interface VerificationResult {
  target_id: string;
  domain: string;
  is_verified: boolean;
  message: string;
  checked_url: string;
  verified_at?: string;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('arve_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async register(email: string, password: string, fullName?: string): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  async login(email: string, password: string): Promise<{ access_token: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/login/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data = await res.json();
    localStorage.setItem('arve_token', data.access_token);
    return data;
  },

  async githubCallback(code: string, isMock: boolean = false): Promise<{ access_token: string }> {
    const res = await fetch(`${API_BASE_URL}/github/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, is_mock: isMock }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'GitHub authentication failed' }));
      throw new Error(err.detail || 'GitHub authentication failed');
    }
    const data = await res.json();
    localStorage.setItem('arve_token', data.access_token);
    return data;
  },

  async getGitHubRepos(): Promise<GitHubRepo[]> {
    const res = await fetch(`${API_BASE_URL}/github/repos`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch GitHub repositories');
    return res.json();
  },

  async me(): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE_URL}/projects`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async createProject(data: {
    name: string;
    description?: string;
    repo_name?: string;
    repo_url?: string;
    repo_id?: string;
    default_branch?: string;
    target_domain?: string;
  }): Promise<Project> {
    const res = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create project' }));
      throw new Error(err.detail || 'Failed to create project');
    }
    return res.json();
  },

  async deleteProject(projectId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  async addTarget(projectId: string, domain: string): Promise<TargetWebsite> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/targets`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ domain }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to add target website' }));
      throw new Error(err.detail || 'Failed to add target website');
    }
    return res.json();
  },

  async verifyTarget(targetId: string): Promise<VerificationResult> {
    const res = await fetch(`${API_BASE_URL}/targets/${targetId}/verify`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Verification request failed' }));
      throw new Error(err.detail || 'Verification request failed');
    }
    return res.json();
  },

  async deleteTarget(targetId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/targets/${targetId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete target');
  },

  logout() {
    localStorage.removeItem('arve_token');
  }
};
