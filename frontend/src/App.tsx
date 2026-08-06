import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { ProjectWizardModal } from './components/ProjectWizardModal';
import { api, type User, type Project } from './services/api';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchUserAndProjects = async () => {
    try {
      const currentUser = await api.me();
      setUser(currentUser);
      const projs = await api.getProjects();
      setProjects(projs);
    } catch (err) {
      setUser(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserAndProjects();
  }, []);

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setProjects([]);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--primary)',
        fontSize: '16px',
        fontWeight: 600
      }}>
        Loading ARVE Security Engine...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenNewProject={() => setShowCreateModal(true)}
      />

      <main style={{ flex: 1 }}>
        {!user ? (
          <AuthView onAuthSuccess={() => fetchUserAndProjects()} />
        ) : (
          <Dashboard
            projects={projects}
            onRefresh={fetchUserAndProjects}
            onOpenNewProject={() => setShowCreateModal(true)}
          />
        )}
      </main>

      {showCreateModal && (
        <ProjectWizardModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={() => fetchUserAndProjects()}
        />
      )}
    </div>
  );
};

export default App;
