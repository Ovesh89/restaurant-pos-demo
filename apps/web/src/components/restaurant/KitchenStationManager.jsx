import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, Flame, AlertCircle } from 'lucide-react';
import { kitchenStationRepository } from '../../services/repositories/kitchenStationRepository.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { DataTable } from '../common/DataTable.jsx';

export const KitchenStationManager = () => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    sortOrder: 1,
    isActive: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadStations = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const fetcher = kitchenStationRepository.getKitchenStations || kitchenStationRepository.getStations;
      const data = await fetcher.call(kitchenStationRepository, false);
      setStations(data || []);
    } catch (err) {
      console.error('Failed to load kitchen stations:', err);
      setErrorMsg(err.message || 'Failed to load kitchen stations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStations();
  }, []);

  const handleOpenAdd = () => {
    setEditingStation(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      sortOrder: stations.length + 1,
      isActive: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (station) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      code: station.code || '',
      description: station.description || '',
      sortOrder: station.sortOrder ?? 1,
      isActive: station.isActive !== false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingStation) {
        const updater = kitchenStationRepository.updateKitchenStation || kitchenStationRepository.updateStation;
        await updater.call(kitchenStationRepository, editingStation.id, formData);
        setSuccessMsg(`Kitchen Station "${formData.name}" updated successfully.`);
      } else {
        const creator = kitchenStationRepository.createKitchenStation || kitchenStationRepository.createStation;
        await creator.call(kitchenStationRepository, formData);
        setSuccessMsg(`Kitchen Station "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
      await loadStations();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Error saving kitchen station.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (station) => {
    try {
      const toggler = kitchenStationRepository.toggleKitchenStationStatus || kitchenStationRepository.toggleStationStatus;
      await toggler.call(kitchenStationRepository, station.id);
      setSuccessMsg(`Kitchen Station "${station.name}" is now ${station.isActive ? 'Inactive' : 'Active'}.`);
      await loadStations();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update kitchen station status.');
    }
  };

  const handleDelete = async (station) => {
    if (!window.confirm(`Are you sure you want to permanently delete Kitchen Station "${station.name}"?`)) {
      return;
    }

    try {
      const deleter = kitchenStationRepository.deleteKitchenStation || kitchenStationRepository.deleteStation;
      await deleter.call(kitchenStationRepository, station.id);
      setSuccessMsg(`Kitchen Station "${station.name}" deleted successfully.`);
      await loadStations();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Cannot delete kitchen station.');
    }
  };

  const columns = [
    {
      header: 'Order',
      accessor: 'sortOrder',
      width: '80px',
      render: (row) => <span className="font-mono text-slate-500 font-bold">#{row.sortOrder ?? 1}</span>,
    },
    {
      header: 'Station Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-800">{row.name}</span>
            {row.code && <span className="ml-2 font-mono text-xs text-slate-400">({row.code})</span>}
            {row.description && <span className="block text-[11px] text-slate-500">{row.description}</span>}
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
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
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={() => handleDelete(row)}
            title="Delete Kitchen Station"
          >
            Delete
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
          <h4 className="font-bold text-slate-800 text-sm">Kitchen Preparation Stations</h4>
          <p className="text-xs text-slate-500">
            Define kitchen routing (Curry Station, Tandoor & Grill, Chinese, Desserts, Beverages)
          </p>
        </div>
        <Button variant="primary" icon={Plus} size="sm" onClick={handleOpenAdd}>
          Add Kitchen Station
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

      {/* Table */}
      <DataTable
        columns={columns}
        data={stations}
        loading={loading}
        emptyMessage="No kitchen stations configured yet."
      />

      {/* Add / Edit Station Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStation ? 'Edit Kitchen Station' : 'Create Kitchen Station'}
        subtitle="Kitchen section for routing preparation orders and KOTs"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Kitchen Station Name"
            placeholder="e.g. Main Curry, Tandoor, Chinese Wok, Mocktail Bar"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Station Code / Short Tag"
              placeholder="e.g. CURRY, TANDOOR, BAR"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            />

            <Input
              label="Sort Order"
              type="number"
              min="1"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
              required
            />
          </div>

          <Input
            label="Description (Optional)"
            placeholder="e.g. Handles gravy curries, dal, and rice preparations"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-xs text-slate-800">Station Active</span>
            </label>
            <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
              Inactive stations will not receive new KOT routing allocations.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" loading={formLoading} className="w-full sm:w-auto">
              {editingStation ? 'Save Changes' : 'Create Station'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
