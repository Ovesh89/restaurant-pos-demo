import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Layers, AlertCircle } from 'lucide-react';
import { branchRepository } from '../../services/repositories/branchRepository.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { DataTable } from '../common/DataTable.jsx';
import { useTranslation } from '../../hooks/useTranslation.js';

export const DiningAreaManager = ({ onAreasChanged = null }) => {
  const { t, formatNumber } = useTranslation();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [formData, setFormData] = useState({ name: '', sortOrder: 1, isActive: true });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAreas = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await branchRepository.getAreas(false);
      setAreas(data || []);
      if (onAreasChanged) onAreasChanged(data || []);
    } catch (err) {
      console.error('Failed to load dining areas:', err);
      setErrorMsg(err.message || 'Failed to load dining areas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  const handleOpenAdd = () => {
    setEditingArea(null);
    setFormData({ name: '', sortOrder: areas.length + 1, isActive: true });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (area) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      sortOrder: area.sortOrder ?? 1,
      isActive: area.isActive !== false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingArea) {
        await branchRepository.updateArea(editingArea.id, formData);
        setSuccessMsg(`Dining Area "${formData.name}" updated successfully.`);
      } else {
        await branchRepository.createArea(formData);
        setSuccessMsg(`Dining Area "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
      await loadAreas();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Error saving dining area.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (area) => {
    try {
      await branchRepository.toggleAreaStatus(area.id);
      setSuccessMsg(`Dining Area "${area.name}" is now ${area.isActive ? 'Inactive' : 'Active'}.`);
      await loadAreas();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (area) => {
    if (!window.confirm(`Are you sure you want to delete Dining Area "${area.name}"? If any tables are assigned to this area, delete or reassign them first.`)) {
      return;
    }

    try {
      await branchRepository.deleteArea(area.id);
      setSuccessMsg(`Dining Area "${area.name}" deleted successfully.`);
      await loadAreas();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Cannot delete area with tables assigned.');
    }
  };

  const columns = [
    {
      header: t('common.sortOrder', 'Order'),
      accessor: 'sortOrder',
      width: '80px',
      render: (row) => <span className="font-mono text-slate-500 font-bold">#{formatNumber(row.sortOrder ?? 1)}</span>,
    },
    {
      header: t('tables.area', 'Dining Area Name'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-800">{row.name}</span>
          </div>
        </div>
      ),
    },
    {
      header: t('common.status', 'Status'),
      accessor: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
        </Badge>
      ),
    },
    {
      header: t('common.actions', 'Actions'),
      align: 'right',
      render: (row) => (
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
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={() => handleDelete(row)}
            title="Delete Dining Area"
          >
            {t('common.delete', 'Delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{t('tables.manageAreas', 'Assigned Dining Areas')}</h4>
          <p className="text-xs text-slate-500">
            Define seating zones (Indoor Hall, Family Lounge, Rooftop Garden, etc.)
          </p>
        </div>
        <Button variant="primary" icon={Plus} size="sm" onClick={handleOpenAdd}>
          + {t('tables.addArea', 'Add Dining Area')}
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Desktop / Tablet Table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={areas}
          loading={loading}
          emptyMessage={t('tables.noAreas', 'No dining areas configured yet.')}
        />
      </div>

      {/* Mobile-Only Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
      <div className="block md:hidden">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading dining areas...')}</p>
          </div>
        ) : areas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
            {t('tables.noAreas', 'No dining areas configured yet.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {areas.map((row) => (
              <div
                key={row.id}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md"
              >
                <div>
                  {/* Top Bar: Sort Order + Name & Status */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-bold text-slate-800 text-sm truncate">{row.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">Area #{formatNumber(row.sortOrder ?? 1)}</span>
                      </div>
                    </div>

                    <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
                      {row.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                    </Badge>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5 mt-2.5">
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
                  <button
                    onClick={() => handleDelete(row)}
                    title="Delete Dining Area"
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors border border-slate-200 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Area Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingArea ? t('tables.editArea', 'Edit Dining Area') : t('tables.addArea', 'Create Assigned Dining Area')}
        subtitle="Floor seating section for tables and service"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <Input
            label={t('tables.area', 'Dining Area Name')}
            placeholder="e.g. Indoor AC Hall, Garden Dining, Rooftop"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
          />

          <Input
            label={t('common.sortOrder', 'Display Sort Order')}
            type="number"
            min="1"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
            required
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-xs text-slate-800">{t('common.active', 'Dining Area Active')}</span>
            </label>
            <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
              Inactive dining areas are hidden from order creation and table views.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={formLoading} className="w-full sm:w-auto">
              {editingArea ? t('common.save', 'Save Changes') : t('common.create', 'Create Area')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
