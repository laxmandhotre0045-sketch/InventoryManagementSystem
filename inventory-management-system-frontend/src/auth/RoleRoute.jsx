import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isAdmin } from '../utils/roleUtils';

const RoleRoute = ({ children }) => {
  const { role } = useAuth();

  if (!isAdmin(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default RoleRoute;
