// ─── User ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
  github_login?: string;
  avatar_url?: string;
  github_avatar?: string;
  is_active: boolean;
  created_at: string;
}

// ─── GitHub raw list (wizard passthrough) ─────────────────────────────────
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

// ─── Repository (stored) ───────────────────────────────────────────────────
export interface Repository {
  id: string;
  github_repo_id: string;
  owner: string;
  name: string;
  full_name: string;
  html_url?: string;
  default_branch: string;
  language?: string;
  frameworks?: string;
  package_manager?: string;
  description?: string;
  private: boolean;
  created_at: string;
}

// ─── Branch ────────────────────────────────────────────────────────────────
export interface Branch {
  name: string;
  protected: boolean;
}

// ─── Project ───────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  user_id?: string;
  owner_id?: string;
  repository_id?: string;
  branch?: string;
  deployment_url?: string;
  verified: boolean;
  created_at: string;

  // legacy / display fields
  name?: string;
  description?: string;
  repo_name?: string;
  repo_url?: string;
  repo_id?: string;
  default_branch?: string;
  targets?: TargetWebsite[];
  repository?: Repository;
}

// ─── Scan (future) ────────────────────────────────────────────────────────
export interface Scan {
  id: string;
  project_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
}

// ─── Target Website (retained for backend compat) ─────────────────────────
export interface TargetWebsite {
  id: string;
  project_id: string;
  domain: string;
  verification_token: string;
  is_verified: boolean;
  verified_at?: string;
  created_at: string;
}

export interface VerificationResult {
  target_id: string;
  domain: string;
  is_verified: boolean;
  message: string;
  checked_url: string;
  verified_at?: string;
}

// ─── Create payloads ────────────────────────────────────────────────────────
export interface CreateProjectPayload {
  // Sprint 1 canonical
  branch?: string;
  deployment_url?: string;
  repository_id?: string;

  // Wizard passthrough
  name?: string;
  description?: string;
  repo_name?: string;
  repo_url?: string;
  repo_id?: string;
  default_branch?: string;
}
