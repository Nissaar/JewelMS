import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Unauthorized from '../pages/Unauthorized';
import { PAGE_ACCESS, hasPermission } from '../shared/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'Admin' | 'User';
  /** Page path whose permission (from PAGE_ACCESS) the user must hold. */
  page?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, page }) => {
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

  const requirement = page ? PAGE_ACCESS[page] : undefined;
  if (requirement && !hasPermission(user, ...requirement)) {
    return <Unauthorized />;
  }

  return <>{children}</>;
};
