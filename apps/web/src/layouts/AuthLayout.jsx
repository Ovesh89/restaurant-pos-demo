import React from 'react';
import { Outlet } from 'react-router-dom';
import { DevResetBanner } from '../components/dev/DevResetBanner';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <DevResetBanner />
      <div className="flex-1 flex items-center justify-center p-4">
        <Outlet />
      </div>
    </div>
  );
};
