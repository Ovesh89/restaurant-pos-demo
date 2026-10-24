import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { useRestaurant } from '../context/RestaurantContext';
import { Badge } from '../components/common/Badge';

export const Topbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { restaurantName, branchName, logo } = useRestaurant();
  const { t, setLanguage } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setLanguage('en');
    navigate('/login');
  };

  const roleColors = {
    owner: 'danger',
    admin: 'primary',
    manager: 'purple',
    reception: 'warning',
    cashier: 'success',
    captain: 'teal',
    kitchen: 'default'
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs shrink-0 safe-area-top z-30">
      <div className="h-14 sm:h-16 px-3.5 sm:px-6 flex items-center justify-between">
        {/* Left Area: Menu Toggle (Mobile & Desktop) + Branch Context */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            aria-label={t('topbar.toggleMenu', null, 'Toggle navigation menu')}
            title={t('topbar.toggleMenu', null, 'Toggle Navigation Menu')}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 truncate shadow-2xs">
            <img src={logo} alt={restaurantName} className="w-4 h-4 object-contain shrink-0" />
            <span className="truncate hidden sm:inline">{restaurantName} — {branchName}</span>
            <span className="truncate sm:hidden">{restaurantName}</span>
          </div>
        </div>

        {/* User Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-tight">{user.name}</p>
                <div className="mt-0.5">
                  <Badge variant={roleColors[user.role] || 'default'} size="sm">
                    {user.role?.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0 text-sm sm:text-base">
                {user.name?.charAt(0) || 'U'}
              </div>
            </div>
          )}

          <div className="h-5 sm:h-6 w-px bg-slate-200 mx-0.5 sm:mx-1"></div>

          <button
            onClick={handleLogout}
            title={t('topbar.logout', null, 'Sign Out')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('topbar.logout', null, 'Logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
