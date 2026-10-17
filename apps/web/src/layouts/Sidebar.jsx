import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  Users,
  ShieldCheck,
  ClipboardList,
  User,
  Coffee,
  ShoppingBag,
  BellRing,
  ChefHat,
  Receipt,
  Contact,
  BarChart3,
  Clock,
  Settings,
  X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PERMISSIONS } from '../constants/permissions';

export const Sidebar = ({ onClose }) => {
  const { hasPermission, hasAnyPermission, role } = useAuth();
  const location = useLocation();

  const isLinkActive = (to) => {
    if (to === '/orders') {
      // Live Orders is active on /orders or /orders/new, but NOT on /orders/history
      return (
        location.pathname === '/orders' ||
        location.pathname === '/orders/' ||
        location.pathname === '/orders/new'
      );
    }
    if (to === '/orders/history') {
      return (
        location.pathname === '/orders/history' ||
        location.pathname.startsWith('/orders/history/')
      );
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const navItems = [
    {
      title: 'Operations',
      items: [
        {
          name: 'Dashboard',
          to: '/dashboard',
          icon: LayoutDashboard,
          show: true
        },
        {
          name: 'Live Orders',
          to: '/orders',
          icon: ShoppingBag,
          show: hasAnyPermission([PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CONFIRM, PERMISSIONS.TABLE_VIEW])
        },
        {
          name: 'Order History',
          to: '/orders/history',
          icon: Clock,
          show: hasAnyPermission([PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CONFIRM, PERMISSIONS.REPORT_VIEW, PERMISSIONS.BILLING_GENERATE])
        },
        {
          name: 'Order Approval',
          to: '/reception',
          icon: BellRing,
          show: hasPermission(PERMISSIONS.ORDER_CONFIRM)
        },
        {
          name: 'Kitchen KDS',
          to: '/kitchen',
          icon: ChefHat,
          show: hasPermission(PERMISSIONS.KOT_VIEW)
        },
        {
          name: 'Table Floor',
          to: '/tables',
          icon: Coffee,
          show: hasPermission(PERMISSIONS.TABLE_VIEW)
        }
      ]
    },
    {
      title: 'Billing & Finance',
      items: [
        {
          name: 'Billing Desk',
          to: '/billing',
          icon: Receipt,
          show: hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT])
        },
        {
          name: 'Customers CRM',
          to: '/customers',
          icon: Contact,
          show: hasPermission(PERMISSIONS.CUSTOMER_VIEW)
        },
        {
          name: 'Reports & Analytics',
          to: '/reports',
          icon: BarChart3,
          show: hasPermission(PERMISSIONS.REPORT_VIEW)
        },
        {
          name: 'Register Shifts',
          to: '/shifts',
          icon: Clock,
          show: hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT, PERMISSIONS.REPORT_VIEW])
        }
      ]
    },
    {
      title: 'Menu Management',
      items: [
        {
          name: 'Categories',
          to: '/menu/categories',
          icon: Layers,
          show: hasPermission(PERMISSIONS.MENU_VIEW)
        },
        {
          name: 'Products & Pricing',
          to: '/menu/products',
          icon: UtensilsCrossed,
          show: hasPermission(PERMISSIONS.MENU_VIEW)
        }
      ]
    },
    {
      title: 'Administration',
      items: [
        {
          name: 'Staff Users',
          to: '/users',
          icon: Users,
          show: hasPermission(PERMISSIONS.USER_MANAGE)
        },
        {
          name: 'Roles & Matrix',
          to: '/roles',
          icon: ShieldCheck,
          show: hasPermission(PERMISSIONS.ROLE_MANAGE)
        },
        {
          name: 'Audit Trail',
          to: '/audit',
          icon: ClipboardList,
          show: hasPermission(PERMISSIONS.AUDIT_VIEW)
        },
        {
          name: 'System Settings',
          to: '/settings',
          icon: Settings,
          show: hasPermission(PERMISSIONS.SETTINGS_MANAGE)
        }
      ]
    },
    {
      title: 'Account',
      items: [
        {
          name: 'My Profile',
          to: '/profile',
          icon: User,
          show: true
        }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/95 p-1 flex items-center justify-center shadow-md shadow-black/20 shrink-0 border border-slate-700/60 overflow-hidden">
            <img src="/logo.png" alt="Green Garden Pure Veg Logo" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white tracking-tight truncate leading-tight">Green Garden</h2>
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block truncate">Pure Veg Restaurant</span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {navItems.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => item.show);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx}>
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-3 mb-2">
                {section.title}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/orders' || item.to === '/orders/history'}
                      onClick={() => {
                        if (onClose) onClose();
                      }}
                      className={() => {
                        const active = isLinkActive(item.to);
                        return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          active
                            ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`;
                      }}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Indicator Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs text-slate-400">Mode:</span>
          <span className="text-xs font-bold text-slate-200 capitalize">{role}</span>
        </div>
      </div>
    </aside>
  );
};
