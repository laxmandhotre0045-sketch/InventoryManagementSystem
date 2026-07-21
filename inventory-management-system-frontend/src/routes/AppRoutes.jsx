import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ProtectedRoute from '../auth/ProtectedRoute';
import RoleRoute from '../auth/RoleRoute';
import Layout from '../components/layout/Layout';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import EquipmentPage from '../pages/EquipmentPage';
import ComponentsPage from '../pages/ComponentsPage';
import InventoryPage from '../pages/InventoryPage';
import ProjectsPage from '../pages/ProjectsPage';
import PurchasesPage from '../pages/PurchasesPage';
import SuppliersPage from '../pages/SuppliersPage';
import ReportsPage from '../pages/ReportsPage';

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="components" element={<ComponentsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route
          path="inventory"
          element={
            <RoleRoute>
              <InventoryPage />
            </RoleRoute>
          }
        />
        <Route
          path="purchases"
          element={
            <RoleRoute>
              <PurchasesPage />
            </RoleRoute>
          }
        />
        <Route
          path="suppliers"
          element={
            <RoleRoute>
              <SuppliersPage />
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute>
              <ReportsPage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
};

export default AppRoutes;
