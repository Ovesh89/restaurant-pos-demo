import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Coffee, Receipt, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { PERMISSIONS } from '../constants/permissions';

export const MobileBottomNav = ({ onOpenMenu }) => {
  const { hasAnyPermission, hasPermission } = useAuth();
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(() => {
    if (typeof document !== 'undefined') {
      return (
        document.body.classList.contains('has-modal-open') ||
        document.body.getAttribute('data-modal-open') === 'true'
      );
    }
    return false;
  });

  useEffect(() => {
    const handleModalState = (e) => {
      setIsModalOpen(Boolean(e.detail?.isOpen));
    };

    window.addEventListener('pos-modal-state', handleModalState);

    // Also observe class mutations on body as fallback
    const observer = new MutationObserver(() => {
      const open =
        document.body.classList.contains('has-modal-open') ||
        document.body.getAttribute('data-modal-open') === 'true';
      setIsModalOpen(open);
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-modal-open'] });

    return () => {
      window.removeEventListener('pos-modal-state', handleModalState);
      observer.disconnect();
    };
  }, []);

  // When any modal or popup is open, hide the bottom navigation menu
  if (isModalOpen) {
    return null;
  }

  const navButtons = [
    {
      to: '/dashboard',
      label: t('nav.dashboard', null, 'Dashboard'),
      icon: LayoutDashboard,
      show: true
    },
    {
      to: '/orders',
      label: t('nav.orders', null, 'Orders'),
      icon: ShoppingBag,
      show: hasAnyPermission([PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CONFIRM, PERMISSIONS.TABLE_VIEW])
    },
    {
      to: '/tables',
      label: t('nav.tables', null, 'Tables'),
      icon: Coffee,
      show: hasPermission(PERMISSIONS.TABLE_VIEW)
    },
    {
      to: '/billing',
      label: t('nav.billing', null, 'Billing'),
      icon: Receipt,
      show: hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT])
    }
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] safe-area-bottom transition-all duration-150"
    >
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
          aria-label={t('nav.more', null, 'More')}
        >
          <Menu className="w-5 h-5 shrink-0" />
          <span>{t('nav.more', null, 'More')}</span>
        </button>
      </div>
    </nav>
  );
};
