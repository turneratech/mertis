import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import ProjectForm from './components/ProjectForm';
import BugList from './components/BugList';
import BugDetail from './components/BugDetail';
import BugForm from './components/BugForm';
import UserManagement from './components/UserManagement';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ChangePassword from './components/ChangePassword';
import ReportGenerator from './components/ReportGenerator';
import EmailConfig from './components/EmailConfig';
import DeploymentConfig from './components/DeploymentConfig';
import TrelloDashboard from './components/TrelloDashboard';
import SetupWizard from './components/SetupWizard';
import { LicenseProvider } from './contexts/LicenseContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { UpgradePrompt } from './components/common/UpgradePrompt';
import { PUBLIC_BASE } from './config/publicPath';
import { PulseHome, PulseProject, PulseMePage, PulseBriefPage } from './pulse/PulseApp';
import { FeatureGuard } from './components/common/FeatureGuard';

axios.defaults.baseURL = PUBLIC_BASE;

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const applyAuthHeader = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
};

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (!token) return config;
  const value = `Bearer ${token}`;
  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', value);
  } else {
    config.headers.Authorization = value;
  }
  return config;
});

const hasElevatedPrivileges = (user) =>
  user && (user.role === 'godmode' || user.role === 'admin');

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !hasElevatedPrivileges(user)) return <Navigate to="/" />;
  return children;
};

function AppRoutes() {
  const { user, setSession } = useAuth();
  const [setup, setSetup] = useState({ loading: true, needsSetup: false, status: null });

  const refreshSetupStatus = useCallback(() => {
    return axios.get('/api/setup/status')
      .then(res => setSetup({ loading: false, needsSetup: res.data.needsSetup === true, status: res.data }))
      .catch(() => setSetup({ loading: false, needsSetup: false, status: null }));
  }, []);

  useEffect(() => {
    refreshSetupStatus();
  }, [refreshSetupStatus]);

  const handleSetupComplete = (authSession) => {
    if (authSession?.token && authSession?.user) {
      setSession(authSession.token, authSession.user);
    }
    setSetup({ loading: false, needsSetup: false, status: null });
  };

  if (setup.loading) return <div className="loading">Loading…</div>;

  if (setup.needsSetup) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <SetupWizard
              initialStatus={setup.status}
              onComplete={handleSetupComplete}
            />
          }
        />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute needsSetup={setup.needsSetup} />} />
      <Route path="/setup" element={<Navigate to="/" replace />} />

      <Route path="/" element={
        <ProtectedRoute>
          {hasElevatedPrivileges(user) ? <AdminDashboard /> : <Dashboard />}
        </ProtectedRoute>
      } />

      <Route path="/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
      <Route path="/projects/new" element={<ProtectedRoute adminOnly><ProjectForm /></ProtectedRoute>} />
      <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
      <Route path="/projects/:projectId/edit" element={<ProtectedRoute adminOnly><ProjectForm /></ProtectedRoute>} />

      <Route path="/projects/:projectKey/bugs" element={<ProtectedRoute><BugList /></ProtectedRoute>} />
      <Route path="/projects/:projectKey/bugs/new" element={<ProtectedRoute><BugForm /></ProtectedRoute>} />
      <Route path="/projects/:projectKey/bugs/:bugId" element={<ProtectedRoute><BugDetail /></ProtectedRoute>} />
      <Route path="/projects/:projectKey/bugs/:bugId/edit" element={<ProtectedRoute><BugForm /></ProtectedRoute>} />

      <Route path="/my-bugs" element={<ProtectedRoute><BugList showMyBugs /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute adminOnly><ReportGenerator /></ProtectedRoute>} />
      <Route path="/email-config" element={<ProtectedRoute adminOnly><EmailConfig /></ProtectedRoute>} />
      <Route path="/deployment" element={<ProtectedRoute adminOnly><DeploymentConfig /></ProtectedRoute>} />
      <Route path="/integrations/trello" element={<ProtectedRoute><TrelloDashboard /></ProtectedRoute>} />
      <Route path="/pulse/me" element={<ProtectedRoute><FeatureGuard feature="project_management" showUpgradePrompt><PulseMePage /></FeatureGuard></ProtectedRoute>} />
      <Route path="/pulse/:projectKey/brief" element={<ProtectedRoute><FeatureGuard feature="project_management" showUpgradePrompt><PulseBriefPage /></FeatureGuard></ProtectedRoute>} />
      <Route path="/pulse/:projectKey" element={<ProtectedRoute><FeatureGuard feature="project_management" showUpgradePrompt><PulseProject /></FeatureGuard></ProtectedRoute>} />
      <Route path="/pulse" element={<ProtectedRoute><FeatureGuard feature="project_management" showUpgradePrompt><PulseHome /></FeatureGuard></ProtectedRoute>} />
    </Routes>
  );
}

function LoginRoute({ needsSetup }) {
  const { user } = useAuth();
  if (needsSetup) return <Navigate to="/setup" replace />;
  return user ? <Navigate to="/" /> : <Login />;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      applyAuthHeader(token);
      axios.get('/api/auth/me')
        .then(res => { setUser(res.data); setLoading(false); })
        .catch(() => {
          localStorage.removeItem('token');
          applyAuthHeader(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    applyAuthHeader(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const setSession = (token, userData) => {
    localStorage.setItem('token', token);
    applyAuthHeader(token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    applyAuthHeader(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setSession }}>
      <LicenseProvider>
        <BrandingProvider>
        <BrowserRouter basename={PUBLIC_BASE || '/'}>
          <div className="app">
            {user && <Navbar />}
            <main className="main-content">
              <AppRoutes />
            </main>
            {user && <Footer />}
          </div>
          <UpgradePrompt />
        </BrowserRouter>
        </BrandingProvider>
      </LicenseProvider>
    </AuthContext.Provider>
  );
}

export default App;
