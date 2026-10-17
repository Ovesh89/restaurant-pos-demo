import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';

export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (showReconnected) {
    return (
      <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 transition-all shadow-sm">
        <Wifi className="w-3.5 h-3.5" />
        <span>Internet connection restored. Operational data active in local storage.</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-slate-900 text-xs font-bold px-4 py-2 flex items-center justify-center gap-2 transition-all shadow-sm">
        <WifiOff className="w-4 h-4 text-slate-950" />
        <span>
          Offline Mode Active — You can continue taking orders, kitchen tickets, and billing normally via local storage.
        </span>
      </div>
    );
  }

  return null;
};
