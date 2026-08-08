import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import ProtectedRoute from '../auth/ProtectedRoute';
import RoleRoute from '../auth/RoleRoute';
import Layout from '../components/layout/Layout';
import ScrollToTop from '../components/common/ScrollToTop';
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
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));

// Module selection (post-login landing).
const ModuleSelectionPage = lazy(() => import('../pages/ModuleSelectionPage'));

// Book Management module — its own layout + pages, fully separate from Inventory.
const LibraryLayout = lazy(() => import('../components/library/LibraryLayout'));
const LibraryDashboardPage = lazy(() => import('../pages/library/LibraryDashboardPage'));
const BooksPage = lazy(() => import('../pages/library/BooksPage'));
const IssueBookPage = lazy(() => import('../pages/library/IssueBookPage'));
const ReturnBookPage = lazy(() => import('../pages/library/ReturnBookPage'));
const IssuedBooksPage = lazy(() => import('../pages/library/IssuedBooksPage'));
const BookHistoryPage = lazy(() => import('../pages/library/BookHistoryPage'));
const MembersPage = lazy(() => import('../pages/library/MembersPage'));
const LibraryReportsPage = lazy(() => import('../pages/library/LibraryReportsPage'));
const LibrarySettingsPage = lazy(() => import('../pages/library/LibrarySettingsPage'));

const PageFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
    <CircularProgress />
  </Box>
);

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/modules" replace /> : <LoginPage />}
      />

      {/* Post-login module selection — standalone, outside any module layout */}
      <Route
        path="/modules"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageFallback />}><ModuleSelectionPage /></Suspense>
          </ProtectedRoute>
        }
      />

      {/* ===== Inventory Management (existing — unchanged) ===== */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/modules" replace />} />
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
        <Route
          path="notifications"
          element={<Suspense fallback={<PageFallback />}><NotificationsPage /></Suspense>}
        />
        <Route
          path="settings"
          element={<RoleRoute><Suspense fallback={<PageFallback />}><SettingsPage /></Suspense></RoleRoute>}
        />
      </Route>

      {/* ===== Book Management (separate layout) =====
          Every /api/v1/library endpoint is ADMIN-only server-side, so the whole
          module is gated here too — otherwise a USER would land on a full UI in
          which every request comes back 403. */}
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <RoleRoute redirectTo="/modules">
              <Suspense fallback={<PageFallback />}><LibraryLayout /></Suspense>
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/library/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><LibraryDashboardPage /></Suspense>} />
        <Route path="books" element={<Suspense fallback={<PageFallback />}><BooksPage /></Suspense>} />
        <Route path="issue" element={<Suspense fallback={<PageFallback />}><IssueBookPage /></Suspense>} />
        <Route path="return" element={<Suspense fallback={<PageFallback />}><ReturnBookPage /></Suspense>} />
        <Route path="issued" element={<Suspense fallback={<PageFallback />}><IssuedBooksPage /></Suspense>} />
        <Route path="history" element={<Suspense fallback={<PageFallback />}><BookHistoryPage /></Suspense>} />
        <Route path="members" element={<Suspense fallback={<PageFallback />}><MembersPage /></Suspense>} />
        <Route path="reports" element={<Suspense fallback={<PageFallback />}><LibraryReportsPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageFallback />}><LibrarySettingsPage /></Suspense>} />
      </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? '/modules' : '/login'} replace />} />
      </Routes>
    </>
  );
};

export default AppRoutes;
