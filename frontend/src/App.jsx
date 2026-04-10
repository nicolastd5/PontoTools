import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider }         from './contexts/ToastContext';

// Páginas
import LoginPage               from './pages/LoginPage';
import AdminDashboardPage      from './pages/admin/AdminDashboardPage';
import AdminEmployeesPage      from './pages/admin/AdminEmployeesPage';
import AdminClocksPage         from './pages/admin/AdminClocksPage';
import AdminBlockedPage        from './pages/admin/AdminBlockedPage';
import AdminUnitsPage          from './pages/admin/AdminUnitsPage';
import AdminContractsPage     from './pages/admin/AdminContractsPage';
import AdminExportPage         from './pages/admin/AdminExportPage';
import EmployeeDashboardPage   from './pages/employee/EmployeeDashboardPage';
import EmployeeHistoryPage     from './pages/employee/EmployeeHistoryPage';

// Componentes de layout
import AdminLayout    from './components/shared/AdminLayout';
import EmployeeLayout from './components/shared/EmployeeLayout';

// Guarda de rota com verificação de role
function PrivateRoute({ children, role, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: '#64748b' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const allowed = roles ? roles.includes(user.role) : (role ? user.role === role : true);
  if (!allowed) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'gestor') return <Navigate to="/admin/employees" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      {/* Login — redireciona se já autenticado */}
      <Route
        path="/login"
        element={
          user
            ? <Navigate to={user.role === 'employee' ? '/dashboard' : user.role === 'admin' ? '/admin/dashboard' : '/admin/employees'} replace />
            : <LoginPage />
        }
      />

      {/* Rotas do Portal Admin */}
      <Route path="/admin" element={
        <PrivateRoute roles={['admin','gestor']}><AdminLayout /></PrivateRoute>
      }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard"  element={<AdminDashboardPage />} />
        <Route path="employees"  element={<AdminEmployeesPage />} />
        <Route path="clocks"     element={<AdminClocksPage />} />
        <Route path="blocked"    element={<AdminBlockedPage />} />
        <Route path="units"      element={<AdminUnitsPage />} />
        <Route path="contracts"  element={<AdminContractsPage />} />
        <Route path="export"     element={<AdminExportPage />} />
      </Route>

      {/* Rotas do App do Funcionário */}
      <Route path="/" element={
        <PrivateRoute role="employee"><EmployeeLayout /></PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<EmployeeDashboardPage />} />
        <Route path="history"   element={<EmployeeHistoryPage />} />
      </Route>

      {/* Redirect raiz */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
