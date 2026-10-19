import React, { useState, useEffect } from 'react';
import { User, Phone, Shield, Building, Key, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useRestaurant } from '../../context/RestaurantContext';
import { authRepository } from '../../services/repositories/authRepository';
import { PageHeader } from '../../components/common/PageHeader';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';

export const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const { restaurantName, branchName } = useRestaurant();
  const { t, language, setLanguage, supportedLanguages } = useTranslation();

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileUsername, setProfileUsername] = useState(user?.username || '');
  const [profileMobile, setProfileMobile] = useState(user?.mobile || '');
  const [profileLanguage, setProfileLanguage] = useState(user?.language || 'en');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileUsername(user.username || '');
      setProfileMobile(user.mobile || '');
      setProfileLanguage(user.language || 'en');
    }
  }, [user]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      await updateProfile({
        name: profileName,
        username: profileUsername,
        mobile: profileMobile,
        language: profileLanguage
      });
      // Selected language applies ONLY after saving changes to profile
      setLanguage(profileLanguage);
      setProfileSuccess(t('auth.profileUpdatedSuccess', null, 'Profile information and language updated successfully.'));
    } catch (err) {
      setProfileError(err.message || t('common.error', null, 'Failed to update profile.'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.passwordMismatch', null, 'New password and confirmation do not match.'));
      return;
    }

    setPasswordLoading(true);
    try {
      await authRepository.changePassword(user.id, currentPassword, newPassword);
      setPasswordSuccess(t('auth.passwordChangedSuccess', null, 'Password changed successfully.'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || t('common.error', null, 'Failed to change password.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <PageHeader
        title={t('auth.myProfile', null, 'My Profile')}
        subtitle={t('auth.profileSubtitle', null, 'Manage your personal details, language preference, and account security')}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Account Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-100 text-blue-700 font-extrabold text-xl sm:text-2xl flex items-center justify-center border-4 border-blue-50 mb-3 sm:mb-4 shadow-inner">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">{user?.name}</h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">@{user?.username}</p>

          <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-2">
            <Badge variant="primary" size="md">
              {t('common.status', null, 'ROLE')}: {user?.role?.toUpperCase()}
            </Badge>
          </div>

          <div className="w-full mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100 space-y-2.5 sm:space-y-3 text-left text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Building className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{restaurantName} — {branchName}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{user?.mobile || t('common.none', null, 'No mobile linked')}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{t('auth.systemRole', null, 'System Role')}: <b className="capitalize">{user?.role}</b></span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Globe className="w-4 h-4 text-blue-500 shrink-0" />
              <span>{t('topbar.language', null, 'Language')}: <b>{supportedLanguages.find(l => l.code === (user?.language || 'en'))?.nativeName || 'English'}</b></span>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="md:col-span-2 space-y-4 sm:space-y-6">
          {/* Edit Profile */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-1">{t('auth.personalInfo', null, 'Personal Information')}</h3>
            <p className="text-xs text-slate-500 mb-4">{t('auth.personalInfoDesc', null, 'Update your display name, contact phone number, and preferred language.')}</p>

            {profileSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('auth.fullName', null, 'Full Name')}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
                <Input
                  label={t('auth.username', null, 'Username')}
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  placeholder="e.g. owner"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('auth.mobilePhone', null, 'Mobile Phone')}
                  value={profileMobile}
                  onChange={(e) => setProfileMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                />

                {/* Preferred Language Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('auth.languagePreference', null, 'Preferred Language')}</span>
                  </label>
                  <select
                    value={profileLanguage}
                    onChange={(e) => setProfileLanguage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs cursor-pointer"
                  >
                    {supportedLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.nativeName} ({lang.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
                <Globe className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>{t('auth.languageHelpText', null, 'All application text will be displayed in this language. Numbers, bill totals, and prices will always remain in English.')}</span>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={profileLoading}>
                  {t('auth.saveProfileChanges', null, 'Save Profile Changes')}
                </Button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-1">{t('auth.securityPassword', null, 'Security & Password')}</h3>
            <p className="text-xs text-slate-500 mb-4">{t('auth.securityPasswordDesc', null, 'Change your account login credentials.')}</p>

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label={t('auth.currentPassword', null, 'Current Password')}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('auth.newPassword', null, 'New Password')}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 4 characters"
                  required
                />
                <Input
                  label={t('auth.confirmNewPassword', null, 'Confirm New Password')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  required
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="secondary" loading={passwordLoading} icon={Key}>
                  {t('auth.updatePassword', null, 'Update Password')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
