import { useAuth } from './useAuth';

export const usePermission = () => {
  const { hasPermission, hasAnyPermission, role } = useAuth();

  return {
    hasPermission,
    hasAnyPermission,
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isManager: role === 'manager',
    isCaptain: role === 'captain',
    isKitchen: role === 'kitchen',
    isReception: role === 'reception',
    isCashier: role === 'cashier'
  };
};
