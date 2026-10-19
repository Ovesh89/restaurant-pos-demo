import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useRestaurant } from '../../context/RestaurantContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { restaurantName, restaurantTitle, logo } = useRestaurant();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Login screen must always be in English by default
  useEffect(() => {
    if (language !== 'en') {
      setLanguage('en');
    }
  }, [language, setLanguage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await login(username, password);
      // Based on user profile settings after logging in successfully, activate their selected language
      const userLang = session?.user?.language || 'en';
      setLanguage(userLang);
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
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-200 text-slate-800 relative">

        {/* Brand */}
        <div className="text-center mb-6 sm:mb-8 pt-2">
          <div className="w-24 h-24 mx-auto mb-3 flex items-center justify-center">
            <img
              src={logo}
              alt={restaurantName}
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{restaurantName}</h1>
          <p className="text-xs text-red-600 font-bold uppercase tracking-wider mt-0.5">
            {restaurantTitle}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {t('app.tagline', null, 'Dine-In, KOT & Billing Management System')}
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
            label={t('auth.username', null, 'Username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('auth.enterUsername', null, 'Enter username')}
            icon={User}
            required
            autoComplete="username"
          />

          <Input
            label={t('auth.password', null, 'Password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.enterPassword', null, 'Enter password')}
            icon={Lock}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            loading={loading}
            className="w-full py-2.5 text-base font-bold shadow-md shadow-blue-600/20"
          >
            {t('auth.signInTerminal', null, 'Sign In to Terminal')}
          </Button>
        </form>
      </div>
    </div>
  );
};
