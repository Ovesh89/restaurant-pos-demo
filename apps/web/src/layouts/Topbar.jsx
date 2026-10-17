import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Building, UserCircle, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Badge } from '../components/common/Badge';

export const Topbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
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
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shadow-xs shrink-0 safe-area-top">
      {/* Left Area: Hamburger (Mobile) + Branch Context */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 truncate shadow-2xs">
          <img src="/logo.png" alt="Green Garden Pure Veg" className="w-4 h-4 object-contain shrink-0" />
          <span className="truncate hidden sm:inline">Green Garden Pure Veg — Main Branch</span>
          <span className="truncate sm:hidden">Green Garden Pure Veg</span>
        </div>
      </div>

      {/* User Actions & Profile */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-tight">{user.name}</p>
              <div className="mt-0.5">
                <Badge variant={roleColors[user.role] || 'default'} size="sm">
                  {user.role?.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
              {user.name.charAt(0)}
            </div>
          </div>
        )}

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        <button
          onClick={handleLogout}
          title="Sign Out"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
