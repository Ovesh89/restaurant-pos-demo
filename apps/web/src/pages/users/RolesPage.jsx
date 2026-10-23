import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Check, Save, RotateCcw, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { roleRepository } from '../../services/repositories/roleRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { PERMISSION_DEFINITIONS } from '../../constants/permissions';
import { DEFAULT_ROLE_PERMISSIONS } from '../../constants/roles';
import { useTranslation } from '../../hooks/useTranslation';

export const RolesPage = () => {
  const { user: currentUser } = useAuth();
  const { t, formatNumber } = useTranslation();

  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadRoles = async (keepRoleId = null) => {
    try {
      setLoading(true);
      const data = await roleRepository.getRoles();
      setRoles(data);
      if (data.length > 0) {
        const targetId = keepRoleId || selectedRoleId;
        const target = data.find((r) => r.id === targetId) || data[0];
        setSelectedRoleId(target.id);
        setSelectedPermissions(target.permissions || []);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const handleSelectRole = (r) => {
    setSelectedRoleId(r.id);
    setSelectedPermissions(r.permissions || []);
    setMessage({ type: '', text: '' });
  };

  const handleTogglePermission = (code) => {
    const isOwner = selectedRole?.name === 'owner';
    if (isOwner) {
      return;
    }

    if (selectedPermissions.includes(code)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== code));
    } else {
      setSelectedPermissions([...selectedPermissions, code]);
    }
  };

  const handleToggleModule = (moduleName) => {
    if (selectedRole?.name === 'owner') return;

    const modPermCodes = PERMISSION_DEFINITIONS
      .filter((p) => p.module === moduleName)
      .map((p) => p.code);

    const allSelected = modPermCodes.every((c) => selectedPermissions.includes(c));

    if (allSelected) {
      // Deselect all in this module
      setSelectedPermissions(selectedPermissions.filter((c) => !modPermCodes.includes(c)));
    } else {
      // Select all in this module
      const combined = Array.from(new Set([...selectedPermissions, ...modPermCodes]));
      setSelectedPermissions(combined);
    }
  };

  const handleResetToDefaults = () => {
    if (selectedRole?.name === 'owner') return;
    const roleKey = selectedRole?.name || selectedRole?.code?.toLowerCase();
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey];
    if (Array.isArray(defaults) && defaults.length > 0) {
      setSelectedPermissions([...defaults]);
      setMessage({
        type: 'success',
        text: `Permissions reset to default recommendations for "${selectedRole?.label}". Click Save to persist.`,
      });
    } else {
      setMessage({
        type: 'error',
        text: `No default permission template found for role "${selectedRole?.label}".`,
      });
    }
  };

  const handleSave = async () => {
    setMessage({ type: '', text: '' });
    setSaving(true);
    try {
      const actor = { id: currentUser?.id || 'admin', name: currentUser?.name || 'Admin' };
      await roleRepository.updateRolePermissions(selectedRoleId, selectedPermissions, actor);
      setMessage({ type: 'success', text: `Permissions updated successfully for "${selectedRole?.label}".` });
      await loadRoles(selectedRoleId);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update permissions.' });
    } finally {
      setSaving(false);
    }
  };

  // Group permission definitions by module
  const modules = [...new Set(PERMISSION_DEFINITIONS.map((p) => p.module))];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('roles.title', 'Roles & Permission Matrix')}
        subtitle={t('roles.subtitle', 'Manage role-based access control (RBAC) and configure granular operation rights')}
      />

      {message.text && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Roles List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-2 sm:mb-3">
            {t('auth.systemRole', 'System Roles')}
          </h2>
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 sm:gap-2 no-scrollbar pb-1 lg:pb-0">
            {roles.map((r) => {
              const isSelected = r.id === selectedRoleId;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSelectRole(r)}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl text-left text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 lg:w-full ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                      : 'text-slate-700 hover:bg-slate-50 border border-slate-100 lg:border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{r.label}</span>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full ml-2">
                    {formatNumber(r.permissions?.length || 0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Permissions Editor */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">
                    {selectedRole?.label} {t('roles.permissions', 'Permissions')}
                  </h3>
                  {selectedRole?.name === 'owner' && (
                    <Badge variant="danger" size="sm">Universal Master</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedRole?.name === 'owner'
                    ? 'Owner role possesses unrestricted privileges across all system components.'
                    : `Configured with ${selectedPermissions.length} active permissions across ${modules.length} modules.`}
                </p>
              </div>

              {selectedRole?.name !== 'owner' && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={RotateCcw}
                    onClick={handleResetToDefaults}
                    title="Reset role permissions to recommended system defaults"
                  >
                    Defaults
                  </Button>
                  <Button
                    variant="primary"
                    icon={Save}
                    onClick={handleSave}
                    loading={saving}
                  >
                    {t('common.save', 'Save Matrix')}
                  </Button>
                </div>
              )}
            </div>

            {/* Matrix By Module */}
            <div className="space-y-6">
              {modules.map((mod) => {
                const perms = PERMISSION_DEFINITIONS.filter((p) => p.module === mod);
                const allSelected = perms.every((p) => selectedPermissions.includes(p.code));
                const someSelected = perms.some((p) => selectedPermissions.includes(p.code));

                return (
                  <div key={mod} className="space-y-2.5 p-3.5 sm:p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          {mod}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({perms.filter((p) => selectedPermissions.includes(p.code)).length}/{perms.length})
                        </span>
                      </div>

                      {selectedRole?.name !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => handleToggleModule(mod)}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                        >
                          {allSelected ? (
                            <>
                              <Square className="w-3 h-3" /> Deselect All
                            </>
                          ) : (
                            <>
                              <CheckSquare className="w-3 h-3" /> Select All
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {perms.map((p) => {
                        const checked = selectedPermissions.includes(p.code);
                        const isOwner = selectedRole?.name === 'owner';
                        return (
                          <label
                            key={p.code}
                            className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              checked
                                ? 'bg-blue-50/60 border-blue-200 text-blue-950 font-medium shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isOwner}
                              onChange={() => handleTogglePermission(p.code)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-75 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 block truncate">{p.name}</span>
                              <span className="text-[11px] text-slate-500 block leading-tight">{p.description}</span>
                              <span className="block text-[10px] font-mono text-slate-400 mt-1">
                                {p.code}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedRole?.name !== 'owner' && (
            <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={handleResetToDefaults}
              >
                Reset to Defaults
              </Button>
              <Button
                variant="primary"
                icon={Save}
                onClick={handleSave}
                loading={saving}
              >
                {t('common.save', 'Save Matrix Changes')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
