import React, { useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { storageAdapter } from '../../services/storage/localStorageAdapter';

export const DevResetBanner = ({ onDataReset }) => {
  // Hidden as per user request
  return null;

  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    storageAdapter.resetToSeedData();
    setShowConfirm(false);
    if (onDataReset) {
      onDataReset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="bg-amber-500 text-slate-900 px-2.5 sm:px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-sm flex-wrap gap-1.5">
      <div className="flex items-center gap-2">
        <span className="bg-black/10 font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wide uppercase">
          Dev / Demo Mode
        </span>
        <span className="hidden sm:inline">Operating with LocalStorage repositories.</span>
      </div>
      <div>
        {showConfirm ? (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-600/30 px-2 py-0.5 rounded flex-wrap">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-900 shrink-0" />
            <span className="text-[11px] font-bold">Reset data to seed?</span>
            <button
              onClick={handleReset}
              className="bg-red-700 hover:bg-red-800 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider"
            >
              Yes
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-slate-800 hover:text-black text-[10px] underline ml-0.5"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="inline-flex items-center gap-1 bg-white/80 hover:bg-white text-slate-900 px-2 py-0.5 rounded-full font-semibold text-[10px] sm:text-[11px] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>
        )}
      </div>
    </div>
  );
};
