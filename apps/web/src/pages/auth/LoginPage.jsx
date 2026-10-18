import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Lock,
  AlertCircle,
  Sparkles,
  Crown,
  Shield,
  ConciergeBell,
  Receipt,
  ChefHat,
  Smartphone,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

const DEMO_ACCOUNTS = [
  {
    role: 'Owner',
    username: 'owner',
    password: 'owner123',
    title: 'Super Admin',
    desc: 'Full system control & reports',
    icon: Crown,
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    activeColor: 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20',
  },
  {
    role: 'Admin',
    username: 'admin',
    password: 'admin123',
    title: 'Branch Admin',
    desc: 'Staff, tables, catalog & pricing',
    icon: Shield,
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    activeColor: 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20',
  },
  {
    role: 'Manager',
    username: 'manager',
    password: 'manager123',
    title: 'Floor Manager',
    desc: 'Floor operations & discounts',
    icon: ConciergeBell,
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    activeColor: 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20',
  },
  {
    role: 'Cashier',
    username: 'cashier',
    password: 'cashier123',
    title: 'Main Cashier',
    desc: 'Bill generation, payments & settlements',
    icon: Receipt,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    activeColor: 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20',
  },
  {
    role: 'Reception',
    username: 'reception',
    password: 'reception123',
    title: 'Front Reception',
    desc: 'Order confirmation & table allocations',
    icon: Sparkles,
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    activeColor: 'border-purple-500 bg-purple-50/70 ring-2 ring-purple-500/20',
  },
  {
    role: 'Captain',
    username: 'captain',
    password: 'captain123',
    title: 'Captain / Waiter',
    desc: 'Table dine-in order taking & KOTs',
    icon: Smartphone,
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
    activeColor: 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20',
  },
  {
    role: 'Kitchen',
    username: 'kitchen',
    password: 'kitchen123',
    title: 'Kitchen Chef',
    desc: 'Live KOT queue, preparation & ready',
    icon: ChefHat,
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    activeColor: 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/20',
  },
];

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const executeLogin = async (u, p) => {
    setError('');
    setLoading(true);

    try {
      await login(u, p);
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await executeLogin(username, password);
  };

  const handleQuickFill = (acc, autoSubmit = false) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setSelectedRole(acc.role);
    setError('');

    if (autoSubmit) {
      executeLogin(acc.username, acc.password);
    }
  };

  return (
    <div className="w-full max-w-xl px-3 sm:px-0 py-6">
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-200 text-slate-800">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-7">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Green Garden Pure Veg"
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Green Garden</h1>
          <p className="text-xs sm:text-sm text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
            Pure Veg Restaurant & Banquet
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Dine-In, KOT & Billing Management System • DEMO TERMINAL
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setSelectedRole(null);
            }}
            placeholder="Enter username"
            icon={User}
            required
            autoComplete="username"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setSelectedRole(null);
            }}
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

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">
              Instant Demo Access
            </span>
          </div>
        </div>

        {/* Instant Demo Access Section (Below Sign In Button) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/40 border border-emerald-100/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  1-Click Role Autofill
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    Demo
                  </span>
                </h3>
              </div>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Click role to fill credentials
            </span>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Select any role to autofill username & password into the fields above:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              const isSelected = selectedRole === acc.role;
              return (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleQuickFill(acc)}
                  className={`relative p-2.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between group cursor-pointer ${
                    isSelected
                      ? acc.activeColor
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${acc.badgeColor}`}
                    >
                      <Icon className="w-3 h-3" />
                      {acc.role}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-800 truncate">
                      {acc.username}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {acc.password}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRole && (
            <div className="mt-2.5 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Autofilled credentials for <b>{selectedRole}</b>
              </span>
              <button
                type="button"
                onClick={() => {
                  const acc = DEMO_ACCOUNTS.find((a) => a.role === selectedRole);
                  if (acc) executeLogin(acc.username, acc.password);
                }}
                disabled={loading}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer disabled:opacity-50"
              >
                Sign In Now →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
