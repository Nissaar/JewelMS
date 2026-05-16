import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Unauthorized from '../pages/Unauthorized';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'Admin' | 'User';
  requiredPermission?: {
    functionality: string;
    action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete';
  };
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, requiredPermission }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin bypass
  if (user.role === 'Admin') return <>{children}</>;

  // Check Role
  if (requiredRole && user.role !== requiredRole) {
    return <Unauthorized />;
  }

  // Check granular permission
  if (requiredPermission) {
    const hasPermission = user.permissions?.find(
      p => p.functionality === requiredPermission.functionality && p[requiredPermission.action]
    );

    if (!hasPermission) {
      return <Unauthorized />;
    }
  }

  return <>{children}</>;
};
