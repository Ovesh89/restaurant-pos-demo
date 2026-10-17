import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, User, Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-200 text-slate-800">
        {/* Brand */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-24 h-24 mx-auto mb-3 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Green Garden Pure Veg"
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Green Garden</h1>
          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
            Pure Veg Restaurant & Banquet
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Dine-In, KOT & Billing Management System
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            icon={User}
            required
            autoComplete="username"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            icon={Lock}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            loading={loading}
            className="w-full py-2.5 text-base font-bold shadow-md shadow-blue-600/20"
          >
            Sign In to Terminal
          </Button>
        </form>
      </div>
    </div>
  );
};
