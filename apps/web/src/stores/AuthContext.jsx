import React, { createContext, useState, useEffect } from 'react';
import { authRepository } from '../services/repositories/authRepository';
import { storageAdapter } from '../services/storage/localStorageAdapter';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize storage first
    storageAdapter.initialize();

    // Check existing session
    const current = authRepository.getCurrentSession();
    if (current && current.user) {
      setSession(current);
    }

    // In API mode, restore and validate session against backend /api/v1/me
    if (typeof authRepository.restoreSession === 'function') {
      authRepository.restoreSession().then((restored) => {
        if (restored) {
          setSession(restored);
        }
      }).catch((err) => {
        console.warn('[AuthContext] Session restore check:', err);
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setSession(null);
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = async (username, password) => {
    const newSession = await authRepository.login(username, password);
    setSession(newSession);
    return newSession;
  };

  const logout = async () => {
    await authRepository.logout();
    setSession(null);
  };

  const updateProfile = async (profileData) => {
    if (!session?.user) return;
    const updated = await authRepository.updateProfile(session.user.id, profileData);
    setSession((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        name: updated.name || updated.displayName || prev.user.name,
        username: updated.username || prev.user.username,
        mobile: updated.mobile !== undefined ? updated.mobile : prev.user.mobile
      }
    }));
    return updated;
  };

  const hasPermission = (permissionCode) => {
    if (!session || !session.permissions) return false;
    const userRole = session.user?.role?.toLowerCase();
    // Owner and Admin have full operational access
    if (userRole === 'owner' || userRole === 'admin') return true;
    return session.permissions.includes(permissionCode);
  };

  const hasAnyPermission = (permissionCodes = []) => {
    if (!session || !session.permissions) return false;
    const userRole = session.user?.role?.toLowerCase();
    if (userRole === 'owner' || userRole === 'admin') return true;
    return permissionCodes.some((code) => session.permissions.includes(code));
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        role: session?.user?.role || null,
        permissions: session?.permissions || [],
        isAuthenticated: !!session?.user,
        loading,
        login,
        logout,
        updateProfile,
        hasPermission,
        hasAnyPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
