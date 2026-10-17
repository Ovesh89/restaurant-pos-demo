import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, CheckCircle2, XCircle, Layers } from 'lucide-react';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { PERMISSIONS } from '../../constants/permissions';

export const CategoriesPage = () => {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.MENU_EDIT);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', sortOrder: 1 });
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
    setFormData({ name: '', code: '', sortOrder: categories.length + 1 });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, code: cat.code || '', sortOrder: cat.sortOrder || 1 });
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

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      header: 'Sort',
      accessor: 'sortOrder',
      className: 'w-16 font-mono text-slate-500'
    },
    {
      header: 'Category Name',
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
      header: 'Status',
      accessor: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      header: 'Actions',
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
              Edit
            </Button>
            <Button
              variant={row.isActive ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => handleToggleStatus(row)}
              className={row.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}
            >
              {row.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Categories"
        subtitle="Manage food and beverage category taxonomy"
      >
        {canEdit && (
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            Add Category
          </Button>
        )}
      </PageHeader>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="w-full sm:max-w-sm">
          <Input
            icon={Search}
            placeholder="Search categories by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left">
          Total: {filteredCategories.length} categories
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredCategories}
        loading={loading}
        emptyMessage="No menu categories match your search."
      />

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Menu Category' : 'Create Menu Category'}
        subtitle="Organize dishes into logical kitchen & menu sections"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Category Name"
            placeholder="e.g. Starter, Chicken, Dessert"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Short Code / SKU"
              placeholder="e.g. STR, CHK"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            />

            <Input
              label="Display Order"
              type="number"
              min="1"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" loading={formLoading} className="w-full sm:w-auto">
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
