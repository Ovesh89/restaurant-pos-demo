import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const PermissionGuard = ({
  permission,
  permissions = [],
  fallback = null,
  children
}) => {
  const { hasPermission, hasAnyPermission, role } = useAuth();

  // Owner has universal access
  if (role === 'owner') {
    return children;
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
