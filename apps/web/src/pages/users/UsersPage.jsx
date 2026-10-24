import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Shield, User, Phone, CheckCircle, XCircle, KeyRound, AlertCircle, Trash2 } from 'lucide-react';
import { userRepository } from '../../services/repositories/userRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { SYSTEM_ROLES } from '../../constants/roles';
import { useTranslation } from '../../hooks/useTranslation';

export const UsersPage = () => {
  const { user: currentUser, role: currentRole } = useAuth();
  const { t, formatNumber } = useTranslation();
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentRole === 'owner' || currentRole === 'admin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState(null);

  // Edit / Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: SYSTEM_ROLES.CAPTAIN,
    mobile: '',
    language: 'en'
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Dedicated Reset Password Modal State
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [confirmStaffPassword, setConfirmStaffPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const loadUsers = async (overridePage = page, overrideLimit = limit) => {
    try {
      setLoading(true);
      const data = await userRepository.getUsers({
        role: roleFilter || undefined,
        search: search.trim() || undefined,
        page: overridePage,
        limit: overrideLimit
      });
      setUsers(data);
      setPagination(
        data.pagination || {
          total: data.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(data.length / overrideLimit))
        }
      );
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadUsers(1, limit);
  }, [roleFilter, search]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      username: '',
      password: '',
      role: SYSTEM_ROLES.CAPTAIN,
      mobile: '',
      language: 'en'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      username: u.username,
      password: '', // blank unless changing
      role: u.role,
      mobile: u.mobile || '',
      language: u.language || 'en'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const actor = { id: currentUser?.id || 'admin', name: currentUser?.name || 'Admin' };
      if (editingUser) {
        await userRepository.updateUser(editingUser.id, formData, actor);
      } else {
        if (!formData.password) {
          throw new Error('Initial password is required.');
        }
        await userRepository.createUser(formData, actor);
      }
      setIsModalOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err.message || 'Error saving user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenResetPassword = (u) => {
    setResetPasswordUser(u);
    setNewStaffPassword('');
    setConfirmStaffPassword('');
    setResetPasswordError('');
    setResetPasswordSuccess('');
  };

  const handleSaveStaffPassword = async (e) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    setResetPasswordError('');
    setResetPasswordSuccess('');

    if (!newStaffPassword || newStaffPassword.length < 4) {
      setResetPasswordError('Password must be at least 4 characters long.');
      return;
    }

    if (newStaffPassword !== confirmStaffPassword) {
      setResetPasswordError('Passwords do not match.');
      return;
    }

    setResetPasswordLoading(true);
    try {
      const actor = { id: currentUser?.id || 'owner', name: currentUser?.name || 'Owner' };
      await userRepository.updateUser(resetPasswordUser.id, { password: newStaffPassword }, actor);
      setResetPasswordSuccess(`Password for ${resetPasswordUser.name} updated successfully!`);
      setTimeout(() => {
        setResetPasswordUser(null);
        loadUsers();
      }, 1200);
    } catch (err) {
      setResetPasswordError(err.message || 'Failed to update password.');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleToggleStatus = async (target) => {
    try {
      const actor = { id: currentUser?.id || 'admin', name: currentUser?.name || 'Admin' };
      await userRepository.toggleUserStatus(target.id, actor);
      await loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (target) => {
    if (target.id === currentUser?.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete staff account "${target.name}" (@${target.username})? This action cannot be undone.`)) {
      return;
    }
    try {
      const actor = { id: currentUser?.id || 'admin', name: currentUser?.name || 'Admin' };
      await userRepository.deleteUser(target.id, actor);
      await loadUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const roleColors = {
    owner: 'danger',
    admin: 'primary',
    manager: 'purple',
    reception: 'warning',
    cashier: 'success',
    captain: 'teal',
    kitchen: 'default'
  };

  const columns = [
    {
      header: t('users.title', 'Staff Member'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
            {row.name.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-slate-800">{row.name}</span>
            <span className="block text-xs font-mono text-slate-400">@{row.username}</span>
          </div>
        </div>
      )
    },
    {
      header: t('users.role', 'Assigned Role'),
      accessor: 'role',
      render: (row) => (
        <Badge variant={roleColors[row.role] || 'default'} size="sm">
          {row.role.toUpperCase()}
        </Badge>
      )
    },
    {
      header: t('customers.mobileNumber', 'Mobile Phone'),
      accessor: 'mobile',
      render: (row) => (
        <span className="text-xs font-mono text-slate-600">{row.mobile || '—'}</span>
      )
    },
    {
      header: t('common.status', 'Status'),
      accessor: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? t('common.active', 'Active') : t('common.inactive', 'Disabled')}
        </Badge>
      )
    },
    {
      header: t('common.actions', 'Actions'),
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon={KeyRound}
            onClick={() => handleOpenResetPassword(row)}
            title="Reset Staff Password"
          >
            {t('auth.securityPassword', 'Password')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Edit2}
            onClick={() => handleOpenEdit(row)}
          >
            {t('common.edit', 'Edit')}
          </Button>
          <Button
            variant={row.isActive ? 'ghost' : 'secondary'}
            size="sm"
            onClick={() => handleToggleStatus(row)}
            className={row.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}
          >
            {row.isActive ? t('common.deactivate', 'Disable') : t('common.activate', 'Enable')}
          </Button>
          {isAdminOrOwner && row.id !== currentUser?.id && (
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => handleDeleteUser(row)}
              title="Permanently Delete Staff Member"
            >
              {t('common.delete', 'Delete')}
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('users.title', 'Staff & User Management')}
        subtitle={t('users.subtitle', 'Manage employee access accounts, job roles, and terminal credentials')}
      >
        <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
          {t('users.addUser', 'Add Staff Member')}
        </Button>
      </PageHeader>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-2 sm:flex sm:flex-row flex-wrap items-center gap-2.5 sm:gap-3 pos-filter-grid">
        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            placeholder={t('common.search', 'Search staff by name, @username, or phone...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: '', label: t('common.all', 'All Roles') },
              ...Object.values(SYSTEM_ROLES).map((r) => ({
                value: r,
                label: r.charAt(0).toUpperCase() + r.slice(1)
              }))
            ]}
          />
        </div>

        <div className="sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left col-span-2 sm:col-span-1">
          {t('common.total', 'Total')}: {formatNumber(pagination?.total ?? users.length)}
        </div>
      </div>

      {/* Desktop / Tablet Table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage={t('users.noUsers', 'No staff members match the selected filter.')}
          pagination={pagination}
          onPageChange={(newPage) => {
            setPage(newPage);
            loadUsers(newPage, limit);
          }}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
            loadUsers(1, newLimit);
          }}
        />
      </div>

      {/* Mobile-Only Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
      <div className="block md:hidden">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading staff members...')}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
            {t('users.noUsers', 'No staff members match the selected filter.')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((row) => (
                <div
                  key={row.id}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md"
                >
                  <div>
                    {/* Header: Avatar + Name + Role Badge */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                          {row.name ? row.name.charAt(0) : '?'}
                        </div>
                        <div className="truncate">
                          <h3 className="font-bold text-slate-800 text-sm truncate">{row.name}</h3>
                          <span className="block text-xs font-mono text-slate-400">@{row.username}</span>
                        </div>
                      </div>

                      <Badge variant={roleColors[row.role] || 'default'} size="sm">
                        {row.role.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Contact & Status */}
                    <div className="my-2.5 flex items-center justify-between text-xs">
                      {row.mobile ? (
                        <a
                          href={`tel:${row.mobile}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{row.mobile}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No phone</span>
                      )}

                      <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
                        {row.isActive ? t('common.active', 'Active') : t('common.inactive', 'Disabled')}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={KeyRound}
                      onClick={() => handleOpenResetPassword(row)}
                      className="flex-1 text-xs justify-center"
                    >
                      {t('auth.securityPassword', 'Password')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Edit2}
                      onClick={() => handleOpenEdit(row)}
                      className="flex-1 text-xs justify-center"
                    >
                      {t('common.edit', 'Edit')}
                    </Button>
                    <Button
                      variant={row.isActive ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleStatus(row)}
                      className={`flex-1 text-xs justify-center ${
                        row.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'
                      }`}
                    >
                      {row.isActive ? t('common.deactivate', 'Disable') : t('common.activate', 'Enable')}
                    </Button>
                    {isAdminOrOwner && row.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(row)}
                        title="Delete User"
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors border border-slate-200 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Pagination */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <Pagination
                currentPage={pagination?.page || page}
                totalPages={pagination?.totalPages || 1}
                totalItems={pagination?.total || users.length}
                pageSize={pagination?.limit || limit}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  loadUsers(newPage, limit);
                }}
                onPageSizeChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                  loadUsers(1, newLimit);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `${t('users.editUser', 'Edit Account')}: ${editingUser.name}` : t('users.addUser', 'Create Staff Member')}
        subtitle={t('users.userModalSubtitle', 'Staff credentials for terminal login')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <Input
            label={t('auth.fullName', 'Full Name')}
            placeholder="e.g. Rahul Sharma"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('auth.username', 'Username')}
              placeholder="e.g. rahul"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />

            <Input
              label={t('customers.mobileNumber', 'Mobile Phone')}
              placeholder="10-digit phone"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={t('auth.systemRole', 'System Role')}
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={Object.values(SYSTEM_ROLES).map((r) => ({
                value: r,
                label: r.charAt(0).toUpperCase() + r.slice(1)
              }))}
              required
            />

            <Input
              label={editingUser ? t('auth.newPassword', 'New Password (Optional)') : t('auth.password', 'Password')}
              type="password"
              placeholder={editingUser ? 'Leave blank to keep' : 'Min 4 characters'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={formLoading} className="w-full sm:w-auto">
              {editingUser ? t('common.save', 'Save Changes') : t('common.create', 'Create Account')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Dedicated Reset Staff Password Modal */}
      <Modal
        isOpen={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        title={`${t('auth.securityPassword', 'Reset Staff Password')}: ${resetPasswordUser?.name}`}
        subtitle={`Update credentials for @${resetPasswordUser?.username} (${resetPasswordUser?.role?.toUpperCase()})`}
      >
        {resetPasswordUser && (
          <form onSubmit={handleSaveStaffPassword} className="space-y-4">
            {resetPasswordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetPasswordError}</span>
              </div>
            )}
            {resetPasswordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{resetPasswordSuccess}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('users.title', 'Staff Member')}:</span>
                <span className="font-bold text-slate-800">{resetPasswordUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('auth.username', 'Username')}:</span>
                <span className="font-mono font-bold text-slate-800">@{resetPasswordUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('auth.systemRole', 'Role')}:</span>
                <span className="font-bold text-blue-600 uppercase">{resetPasswordUser.role}</span>
              </div>
            </div>

            <Input
              label={t('auth.newPassword', 'New Password')}
              type="password"
              placeholder="Minimum 4 characters"
              value={newStaffPassword}
              onChange={(e) => setNewStaffPassword(e.target.value)}
              required
              autoFocus
            />

            <Input
              label={t('auth.confirmNewPassword', 'Confirm New Password')}
              type="password"
              placeholder="Re-type new password"
              value={confirmStaffPassword}
              onChange={(e) => setConfirmStaffPassword(e.target.value)}
              required
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 pos-modal-actions">
              <Button variant="secondary" onClick={() => setResetPasswordUser(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={resetPasswordLoading} icon={KeyRound}>
                {t('auth.updatePassword', 'Save Password')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
