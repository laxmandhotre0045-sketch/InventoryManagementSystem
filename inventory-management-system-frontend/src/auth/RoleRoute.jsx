import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isAdmin } from '../utils/roleUtils';

/**
 * Admin-only route guard.
 *
 * `redirectTo` is where a non-admin lands instead — Inventory pages send them back
 * to their dashboard, the Library module sends them to the module picker since they
 * have no Library landing page of their own.
 */
const RoleRoute = ({ children, redirectTo = '/dashboard' }) => {
  const { role } = useAuth();

  if (!isAdmin(role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default RoleRoute;
