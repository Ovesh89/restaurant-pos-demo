import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, CheckCircle2, XCircle, Layers, Trash2 } from 'lucide-react';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { PERMISSIONS } from '../../constants/permissions';
import { useTranslation } from '../../hooks/useTranslation';

export const CategoriesPage = () => {
  const { user, role, hasPermission } = useAuth();
  const { t, formatNumber } = useTranslation();
  const canEdit = hasPermission(PERMISSIONS.MENU_EDIT);
  const isAdminOrOwner = user?.role === 'owner' || user?.role === 'admin' || role === 'owner' || role === 'admin';

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', sortOrder: 1, kotRequired: true });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await categoryRepository.getCategories(true);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', code: '', sortOrder: categories.length + 1, kotRequired: true });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      code: cat.code || '',
      sortOrder: cat.sortOrder || 1,
      kotRequired: cat.kotRequired !== false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      if (editingCategory) {
        await categoryRepository.updateCategory(editingCategory.id, formData, actor);
      } else {
        await categoryRepository.createCategory(formData, actor);
      }
      setIsModalOpen(false);
      await loadCategories();
    } catch (err) {
      setFormError(err.message || 'Error saving category.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await categoryRepository.toggleCategoryStatus(cat.id, actor);
      await loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Are you sure you want to permanently delete category "${cat.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await categoryRepository.deleteCategory(cat.id, actor);
      await loadCategories();
    } catch (err) {
      alert(err.message || 'Failed to delete category.');
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      header: t('common.sortOrder', 'Sort'),
      accessor: 'sortOrder',
      className: 'w-16 font-mono text-slate-500',
      render: (row) => formatNumber(row.sortOrder ?? 1)
    },
    {
      header: t('menu.categoryName', 'Category Name'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-800">{row.name}</span>
            {row.code && <span className="ml-2 text-xs font-mono text-slate-400">({row.code})</span>}
          </div>
        </div>
      )
    },
    {
      header: t('menu.kotPolicy', 'KOT Policy'),
      accessor: 'kotRequired',
      render: (row) => (
        <Badge variant={row.kotRequired !== false ? 'info' : 'warning'} size="sm">
          {row.kotRequired !== false ? t('menu.kotRequired', 'KOT Required') : t('menu.noKot', 'No KOT')}
        </Badge>
      )
    },
    {
      header: t('common.status', 'Status'),
      accessor: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
        </Badge>
      )
    },
    {
      header: t('common.actions', 'Actions'),
      align: 'right',
      render: (row) => {
        if (!canEdit) return null;
        return (
          <div className="flex items-center justify-end gap-2">
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
              {row.isActive ? t('common.deactivate', 'Deactivate') : t('common.activate', 'Activate')}
            </Button>
            {isAdminOrOwner && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => handleDeleteCategory(row)}
                title="Permanently Delete Category"
              >
                {t('common.delete', 'Delete')}
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('menu.categoriesTitle', 'Menu Categories')}
        subtitle={t('menu.categoriesSubtitle', 'Manage food and beverage category taxonomy')}
      >
        {canEdit && (
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            {t('menu.addCategory', 'Add Category')}
          </Button>
        )}
      </PageHeader>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="w-full sm:max-w-sm">
          <Input
            icon={Search}
            placeholder={t('common.search', 'Search categories by name or code...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left">
          {t('common.total', 'Total')}: {formatNumber(filteredCategories.length)}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredCategories}
        loading={loading}
        emptyMessage={t('menu.noCategories', 'No menu categories match your search.')}
      />

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? t('menu.editCategory', 'Edit Menu Category') : t('menu.createCategory', 'Create Menu Category')}
        subtitle={t('menu.categoryModalSubtitle', 'Organize dishes into logical kitchen & menu sections')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <Input
            label={t('menu.categoryName', 'Category Name')}
            placeholder="e.g. Starter, Chicken, Dessert"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('menu.shortCode', 'Short Code / SKU')}
              placeholder="e.g. STR, CHK"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            />

            <Input
              label={t('common.sortOrder', 'Display Order')}
              type="number"
              min="1"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
              required
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.kotRequired}
                onChange={(e) => setFormData({ ...formData, kotRequired: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-xs text-slate-800">{t('menu.kotRequired', 'Kitchen KOT Required')}</span>
            </label>
            <p className="text-[11px] text-slate-500 ml-6">
              When enabled, items ordered in this category automatically generate KOT tickets to the kitchen. Uncheck for instant items (drinks, ice creams, pre-made items) where kitchen preparation is not required.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={formLoading} className="w-full sm:w-auto">
              {editingCategory ? t('common.save', 'Save Changes') : t('common.create', 'Create Category')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
