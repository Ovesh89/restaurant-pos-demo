import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileBottomNav } from './MobileBottomNav';
import { DevResetBanner } from '../components/dev/DevResetBanner';
import { OfflineBanner } from '../components/common/OfflineBanner';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { useAuth } from '../hooks/useAuth';

export const MainLayout = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const { activeToast, dismissToast } = useOrderNotifications();
  const { user, role } = useAuth();
  const location = useLocation();
  const isCaptain = role === 'captain' || user?.role === 'captain';

  const [captainSelectedArea, setCaptainSelectedArea] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pos_captain_selected_area');
    }
    return null;
  });

  useEffect(() => {
    const handleAreaChange = (e) => {
      setCaptainSelectedArea(e.detail?.areaId ?? localStorage.getItem('pos_captain_selected_area'));
    };
    window.addEventListener('pos-area-change', handleAreaChange);
    window.addEventListener('storage', handleAreaChange);
    return () => {
      window.removeEventListener('pos-area-change', handleAreaChange);
      window.removeEventListener('storage', handleAreaChange);
    };
  }, []);

  const isCaptainAreaList = isCaptain && location.pathname === '/tables' && !captainSelectedArea;
  const isBottomNavHidden = isCaptain && !isCaptainAreaList;

  return (
    <div className="h-screen h-[100dvh] w-screen flex flex-col bg-slate-100 antialiased overflow-hidden">
      {/* Dev Reset Banner */}
      <DevResetBanner />
      {/* Offline Status Indicator */}
      <OfflineBanner />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop Sidebar (hidden when collapsed or on mobile) */}
        {isDesktopSidebarOpen && (
          <div className="hidden lg:flex shrink-0 h-full overflow-hidden transition-all duration-200">
            <Sidebar />
          </div>
        )}

        {/* Mobile Slide-over Drawer */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            {/* Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 z-10 shadow-2xl h-full overflow-hidden">
              <Sidebar onClose={() => setIsMobileSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Topbar
            onToggleSidebar={() => {
              if (window.innerWidth >= 1024) {
                setIsDesktopSidebarOpen((prev) => !prev);
              } else {
                setIsMobileSidebarOpen((prev) => !prev);
              }
            }}
          />
          <main className={`flex-1 overflow-y-auto ${isBottomNavHidden ? 'p-2 sm:p-4 pb-2' : 'p-3.5 sm:p-4 md:p-6 lg:p-8 pb-24 lg:pb-8'}`}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Floating Push Notification Toast Banner for Captain & Kitchen */}
      {activeToast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-slide-in flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/40">
              <BellRing className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white">{activeToast.title}</h4>
                <span className="text-[10px] text-slate-400 font-mono">({activeToast.time})</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">{activeToast.message}</p>
            </div>
          </div>
          <button
            onClick={dismissToast}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Dismiss Notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav onOpenMenu={() => setIsMobileSidebarOpen(true)} />
    </div>
  );
};
