import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import ProtectedRoute from '../auth/ProtectedRoute';
import RoleRoute from '../auth/RoleRoute';
import Layout from '../components/layout/Layout';
import LoginPage from '../pages/LoginPage';

// Lazy-load page bundles so each route is code-split and loaded on demand.
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const EquipmentPage = lazy(() => import('../pages/EquipmentPage'));
const ComponentsPage = lazy(() => import('../pages/ComponentsPage'));
const InventoryPage = lazy(() => import('../pages/InventoryPage'));
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'));
const PurchasesPage = lazy(() => import('../pages/PurchasesPage'));
const SuppliersPage = lazy(() => import('../pages/SuppliersPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));

const PageFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
    <CircularProgress />
  </Box>
);

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
        <Route
          path="dashboard"
          element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>}
        />
        <Route
          path="equipment"
          element={<Suspense fallback={<PageFallback />}><EquipmentPage /></Suspense>}
        />
        <Route
          path="components"
          element={<Suspense fallback={<PageFallback />}><ComponentsPage /></Suspense>}
        />
        <Route
          path="projects"
          element={<Suspense fallback={<PageFallback />}><ProjectsPage /></Suspense>}
        />
        <Route
          path="inventory"
          element={<RoleRoute><Suspense fallback={<PageFallback />}><InventoryPage /></Suspense></RoleRoute>}
        />
        <Route
          path="purchases"
          element={<RoleRoute><Suspense fallback={<PageFallback />}><PurchasesPage /></Suspense></RoleRoute>}
        />
        <Route
          path="suppliers"
          element={<RoleRoute><Suspense fallback={<PageFallback />}><SuppliersPage /></Suspense></RoleRoute>}
        />
        <Route
          path="reports"
          element={<RoleRoute><Suspense fallback={<PageFallback />}><ReportsPage /></Suspense></RoleRoute>}
        />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
};

export default AppRoutes;
