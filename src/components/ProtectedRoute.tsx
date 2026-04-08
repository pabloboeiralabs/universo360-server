import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'admin' | 'franchise_owner' | 'customer' | 'collaborator';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: AppRole[];
  redirectTo?: string;
}

const ProtectedRoute = ({ 
  children, 
  requiredRoles = [], 
  redirectTo = '/admin/login' 
}: ProtectedRouteProps) => {
  const { user, roles, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
    
    if (!hasRequiredRole) {
      // Redirect based on user's actual role
      if (roles.includes('admin')) {
        return <Navigate to="/admin" replace />;
      } else if (roles.includes('franchise_owner')) {
        return <Navigate to="/franchise" replace />;
      } else if (roles.includes('collaborator')) {
        return <Navigate to="/colaborador" replace />;
      } else {
        return <Navigate to="/" replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
