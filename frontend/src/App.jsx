import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EquipmentPage from './pages/EquipmentPage';
import EquipmentDetailPage from './pages/EquipmentDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import { AlertLogsPage, UsersPage } from './pages/AlertLogsPage';
import ProfilePage from './pages/ProfilePage';
import ImportPage from './pages/ImportPage';
import CertificatesPage from './pages/CertificatesPage';
import { Spinner } from './components/UI';

// ── Protected route wrapper ───────────────────────────────────
function Protected({ children, adminOnly = false, representativeOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (representativeOnly && user.role === 'viewer') return <Navigate to="/" replace />;
  return children;
}

// ── Layout wrapper (Navbar + page content) ────────────────────
function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      {children}
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────
function AppShell() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <LoginPage />
      } />

      {/* Protected routes */}
      <Route path="/" element={
        <Protected><Layout><DashboardPage /></Layout></Protected>
      } />
      <Route path="/equipment" element={
        <Protected><Layout><EquipmentPage /></Layout></Protected>
      } />
      <Route path="/equipment/:id" element={
        <Protected><Layout><EquipmentDetailPage /></Layout></Protected>
      } />
      <Route path="/categories" element={
        <Protected adminOnly><Layout><CategoriesPage /></Layout></Protected>
      } />
      <Route path="/alerts" element={
        <Protected adminOnly><Layout><AlertLogsPage /></Layout></Protected>
      } />
      <Route path="/profile" element={
        <Protected><Layout><ProfilePage /></Layout></Protected>
      } />
      <Route path="/import" element={
        <Protected adminOnly={false} representativeOnly={true}><Layout><ImportPage /></Layout></Protected>
      } />
      <Route path="/certificates" element={
        <Protected><Layout><CertificatesPage /></Layout></Protected>
      } />

      {/* Admin only */}
      <Route path="/users" element={
        <Protected adminOnly><Layout><UsersPage /></Layout></Protected>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
