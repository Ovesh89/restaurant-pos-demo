import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const PermissionGuard = ({
  permission,
  permissions = [],
  fallback = null,
  children
}) => {
  const { hasPermission, hasAnyPermission, role, user } = useAuth();
  const location = useLocation();
  const currentRole = role || user?.role;

  // Owner has universal access
  if (currentRole === 'owner') {
    return children;
  }

  // Captain is strictly restricted to Table Floor, Order Add/Update, and Profile
  if (currentRole === 'captain') {
    const p = location.pathname;
    const isAllowedForCaptain =
      p === '/tables' ||
      p.startsWith('/tables/') ||
      p === '/orders/new' ||
      p.startsWith('/orders/new') ||
      p === '/profile' ||
      p.startsWith('/profile');

    if (!isAllowedForCaptain) {
      return <Navigate to="/tables" replace />;
    }
  }

  let isAllowed = true;

  if (permission) {
    isAllowed = hasPermission(permission);
  } else if (permissions.length > 0) {
    isAllowed = hasAnyPermission(permissions);
  }

  if (!isAllowed) {
    if (fallback) return fallback;
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
