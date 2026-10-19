import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Coffee, Edit2, Users, Layers, AlertCircle, Receipt, ArrowRightLeft } from 'lucide-react';
import { tableRepository } from '../../services/repositories/tableRepository';
import { branchRepository } from '../../services/repositories/branchRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { TABLE_STATUS_CONFIG, TABLE_STATUS } from '../../constants/tableStatus';
import { PERMISSIONS } from '../../constants/permissions';
import { DiningAreaManager } from '../../components/restaurant/DiningAreaManager.jsx';

export const TablesPage = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const canManage = hasPermission(PERMISSIONS.TABLE_MANAGE);

  const [tables, setTables] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Dining Areas Modal State
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);

  // Add / Edit Table Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [formData, setFormData] = useState({ tableNo: '', areaId: '', capacity: 4 });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Transfer Table State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceTable, setTransferSourceTable] = useState(null);
  const [transferTargetTableId, setTransferTargetTableId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const loadFloor = async () => {
    try {
      setLoading(true);
      const [tList, aList] = await Promise.all([
        tableRepository.getTables(),
        branchRepository.getAreas()
      ]);
      setTables(tList);
      setAreas(aList);
      if (aList.length > 0 && selectedAreaId === 'ALL') {
        // default can be ALL or first area
      }
    } catch (err) {
      console.error('Failed to load table floor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloor();
  }, []);

  const handleOpenAdd = () => {
    setEditingTable(null);
    setFormData({
      tableNo: '',
      areaId: selectedAreaId !== 'ALL' ? selectedAreaId : (areas[0]?.id || 'area-indoor'),
      capacity: 4
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tbl, e) => {
    e.stopPropagation();
    setEditingTable(tbl);
    setFormData({
      tableNo: tbl.tableNo,
      areaId: tbl.areaId,
      capacity: tbl.capacity
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
      if (editingTable) {
        await tableRepository.updateTable(editingTable.id, formData, actor);
      } else {
        await tableRepository.createTable(formData, actor);
      }
      setIsModalOpen(false);
      await loadFloor();
    } catch (err) {
      setFormError(err.message || 'Error saving table.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (tbl, e) => {
    e.stopPropagation();
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await tableRepository.toggleTableActive(tbl.id, actor);
      await loadFloor();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenTransfer = (tbl, e) => {
    e.stopPropagation();
    setTransferSourceTable(tbl);
    const availableTables = tables.filter((t) => t.status === TABLE_STATUS.AVAILABLE && t.isActive && t.id !== tbl.id);
    setTransferTargetTableId(availableTables[0]?.id || '');
    setTransferReason('');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = async (e) => {
    e.preventDefault();
    if (!transferTargetTableId) {
      setTransferError('Please select a destination table.');
      return;
    }

    setTransferError('');
    setTransferLoading(true);

    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      await tableRepository.transferTable({
        fromTableId: transferSourceTable.id,
        toTableId: transferTargetTableId,
        reason: transferReason,
        actor
      });
      setIsTransferModalOpen(false);
      await loadFloor();
    } catch (err) {
      setTransferError(err.message || 'Transfer failed.');
    } finally {
      setTransferLoading(false);
    }
  };

  // Filter tables by active tab
  const displayedTables = selectedAreaId === 'ALL'
    ? tables
    : tables.filter((t) => t.areaId === selectedAreaId);

  const getAreaName = (areaId) => {
    const area = areas.find((a) => a.id === areaId);
    return area ? area.name : 'General Area';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant Table Floor"
        subtitle="Floor layout visualizer, dining sections, table seating capacity, and status overview"
      >
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Layers} onClick={() => setIsAreaModalOpen(true)}>
              Manage Areas
            </Button>
            <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
              Add Table
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Area Selector Tabs & Status Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-3 sm:pb-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedAreaId('ALL')}
            className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedAreaId === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            All Areas ({tables.length})
          </button>
          {areas.map((a) => {
            const count = tables.filter((t) => t.areaId === a.id).length;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAreaId(a.id)}
                className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedAreaId === a.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {a.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-[10px] sm:text-[11px] font-semibold text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>KOT Sent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Bill Pending</span>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
          Loading restaurant table floor...
        </div>
      ) : displayedTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
          No dining tables configured in this area.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {displayedTables.map((tbl) => {
            const statusConfig = TABLE_STATUS_CONFIG[tbl.status] || TABLE_STATUS_CONFIG[TABLE_STATUS.AVAILABLE];
            const handleCardClick = () => {
              if (!tbl.isActive) return;
              if (tbl.status === TABLE_STATUS.AVAILABLE) {
                navigate(`/orders/new?tableId=${tbl.id}`);
              } else if (tbl.status === TABLE_STATUS.BILL_PENDING && hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT])) {
                navigate(`/billing?tableId=${tbl.id}`);
              } else {
                navigate(`/orders`);
              }
            };

            return (
              <div
                key={tbl.id}
                onClick={handleCardClick}
                className={`relative rounded-2xl border bg-white p-3.5 sm:p-5 shadow-xs transition-all flex flex-col justify-between min-h-[160px] sm:h-44 cursor-pointer ${
                  !tbl.isActive
                    ? 'opacity-50 border-dashed border-slate-300 cursor-not-allowed'
                    : 'hover:shadow-md hover:border-blue-500 hover:scale-[1.01]'
                }`}
              >
                {/* Top Info */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getAreaName(tbl.areaId)}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-0.5">
                      T-{tbl.tableNo}
                    </h3>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusConfig.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                    {statusConfig.label}
                  </span>
                </div>

                {/* Capacity & Attributes */}
                <div className="my-1.5 sm:my-2">
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-600 font-semibold">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{tbl.capacity} Pax</span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-xs">
                  {tbl.status === TABLE_STATUS.AVAILABLE ? (
                    <button
                      onClick={() => navigate(`/orders/new?tableId=${tbl.id}`)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200"
                    >
                      + Take Order
                    </button>
                  ) : tbl.status === TABLE_STATUS.BILL_PENDING && hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) ? (
                    <button
                      onClick={() => navigate(`/billing?tableId=${tbl.id}`)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-300 flex items-center gap-1"
                    >
                      <Receipt className="w-3 h-3" />
                      Collect Bill
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/orders')}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200"
                    >
                      View Order
                    </button>
                  )}

                  {tbl.status !== TABLE_STATUS.AVAILABLE && (
                    <button
                      onClick={(e) => handleOpenTransfer(tbl, e)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                      title="Transfer Table Order to Another Table"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenEdit(tbl, e)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                        title="Edit Table Capacity & Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleToggleActive(tbl, e)}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 px-1 py-0.5 rounded hover:bg-slate-100"
                      >
                        {tbl.isActive ? 'Deact.' : 'Act.'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Table Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTable ? `Edit Table ${editingTable.tableNo}` : 'Add Dining Table'}
        subtitle="Configure table identification and seating pax"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Table Number"
              placeholder="e.g. 05, 21, VIP-1"
              value={formData.tableNo}
              onChange={(e) => setFormData({ ...formData, tableNo: e.target.value })}
              required
            />

            <Input
              label="Seating Capacity (Pax)"
              type="number"
              min="1"
              max="30"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              required
            />
          </div>

          <Select
            label="Assigned Dining Area"
            value={formData.areaId}
            onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
            options={areas.map((a) => ({ value: a.id, label: a.name }))}
            required
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingTable ? 'Save Table' : 'Create Table'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Table Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title={`Transfer Table T-${transferSourceTable?.tableNo}`}
        subtitle="Relocate ongoing active order and kitchen tickets to another available table"
      >
        <form onSubmit={handleConfirmTransfer} className="space-y-4">
          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {transferError}
            </div>
          )}

          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-xs text-blue-900">
            <p className="font-bold">Active Table: T-{transferSourceTable?.tableNo}</p>
            <p className="mt-0.5">
              The ongoing order, canonical dishes, and kitchen tickets will seamlessly transfer to the chosen table. Table T-{transferSourceTable?.tableNo} will be released back to AVAILABLE.
            </p>
          </div>

          <Select
            label="Destination Available Table"
            value={transferTargetTableId}
            onChange={(e) => setTransferTargetTableId(e.target.value)}
            options={tables
              .filter((t) => t.status === TABLE_STATUS.AVAILABLE && t.isActive && t.id !== transferSourceTable?.id)
              .map((t) => ({
                value: t.id,
                label: `Table ${t.tableNo} (${t.capacity} Pax - ${getAreaName(t.areaId)})`
              }))}
            required
          />

          <Input
            label="Reason for Transfer"
            placeholder="e.g. Guest requested window booth / AC section"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon={ArrowRightLeft} loading={transferLoading}>
              Confirm Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Dining Area Manager Modal */}
      <Modal
        isOpen={isAreaModalOpen}
        onClose={() => {
          setIsAreaModalOpen(false);
          loadFloor();
        }}
        title="Manage Assigned Dining Areas"
        subtitle="Add, edit, toggle active status, and remove restaurant floor sections"
        maxWidth="max-w-4xl"
      >
        <DiningAreaManager onAreasChanged={loadFloor} />
      </Modal>
    </div>
  );
};
