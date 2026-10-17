import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Coffee, Receipt, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PERMISSIONS } from '../constants/permissions';

export const MobileBottomNav = ({ onOpenMenu }) => {
  const { hasAnyPermission, hasPermission } = useAuth();

  const navButtons = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true
    },
    {
      to: '/orders',
      label: 'Orders',
      icon: ShoppingBag,
      show: hasAnyPermission([PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CONFIRM, PERMISSIONS.TABLE_VIEW])
    },
    {
      to: '/tables',
      label: 'Tables',
      icon: Coffee,
      show: hasPermission(PERMISSIONS.TABLE_VIEW)
    },
    {
      to: '/billing',
      label: 'Billing',
      icon: Receipt,
      show: hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT])
    }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] safe-area-bottom">
      <div className="flex items-stretch justify-around h-14">
        {navButtons.map((item) => {
          if (!item.show) return null;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/orders'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors select-none ${
                  isActive
                    ? 'text-blue-600 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-900 active:bg-slate-50'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </NavLink>
          );
        })}

        {/* More / All Modules Drawer Opener */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-900 active:bg-slate-50 transition-colors select-none"
          aria-label="Open all modules menu"
        >
          <Menu className="w-5 h-5 shrink-0" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
};
