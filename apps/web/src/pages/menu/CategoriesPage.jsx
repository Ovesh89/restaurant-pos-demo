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
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-2 sm:flex sm:flex-row items-center gap-2.5 sm:gap-4 pos-filter-grid">
        <div className="w-full col-span-2 sm:col-span-1 sm:max-w-sm">
          <Input
            icon={Search}
            placeholder={t('common.search', 'Search categories by name or code...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left col-span-2 sm:col-span-1">
          {t('common.total', 'Total')}: {formatNumber(filteredCategories.length)}
        </div>
      </div>

      {/* Desktop / Tablet Data Table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filteredCategories}
          loading={loading}
          emptyMessage={t('menu.noCategories', 'No menu categories match your search.')}
        />
      </div>

      {/* Mobile-Only Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
      <div className="block md:hidden">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading categories...')}</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
            {t('menu.noCategories', 'No menu categories match your search.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredCategories.map((row) => (
              <div
                key={row.id}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md"
              >
                <div>
                  {/* Top Bar: Sort Order + Name & Code */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-slate-800 text-sm truncate">{row.name}</h3>
                        {row.code && <span className="text-[11px] font-mono text-slate-400">Code: {row.code}</span>}
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                      #{formatNumber(row.sortOrder ?? 1)}
                    </span>
                  </div>

                  {/* Badges: KOT Policy & Status */}
                  <div className="my-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={row.kotRequired !== false ? 'info' : 'warning'} size="sm">
                        {row.kotRequired !== false ? t('menu.kotRequired', 'KOT Required') : t('menu.noKot', 'No KOT')}
                      </Badge>
                      <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
                        {row.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                {canEdit && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
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
                      {row.isActive ? t('common.deactivate', 'Deactivate') : t('common.activate', 'Activate')}
                    </Button>
                    {isAdminOrOwner && (
                      <button
                        onClick={() => handleDeleteCategory(row)}
                        title="Delete Category"
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors border border-slate-200 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 pos-modal-actions">
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
