import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';

export const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-sm text-slate-500 mt-2">
          Your current role (<span className="font-semibold capitalize text-slate-700">{role}</span>) does not have permission to access this module or execute this operation.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => navigate('/dashboard')} icon={ArrowLeft}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
