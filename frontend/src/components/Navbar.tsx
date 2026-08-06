import React from 'react';
import { ShieldCheck, LogOut, User as UserIcon, Plus } from 'lucide-react';
import type { User } from '../services/api';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onOpenNewProject: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onOpenNewProject }) => {
  return (
    <header style={{
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(7, 11, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #00F0FF 0%, #6366F1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)'
          }}>
            <ShieldCheck size={24} color="#070B14" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ARVE <span style={{ fontSize: '11px', fontWeight: 600, background: 'rgba(0, 240, 255, 0.15)', color: '#00F0FF', border: '1px solid rgba(0, 240, 255, 0.3)', padding: '2px 8px', borderRadius: '12px' }}>Phase 1</span>
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Adaptive Remediation & Verification Engine</p>
          </div>
        </div>

        {/* User Controls */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-primary btn-sm" onClick={onOpenNewProject}>
              <Plus size={16} /> New Project
            </button>

            <div style={{ height: '24px', width: '1px', background: 'var(--border-color)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <UserIcon size={16} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.full_name || user.email.split('@')[0]}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{user.email}</div>
              </div>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={onLogout} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
