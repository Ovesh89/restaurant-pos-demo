import React, { useState, useEffect } from 'react';
import { Plus, Search, User, Phone, MapPin, Calendar, DollarSign, Award } from 'lucide-react';
import { customerRepository } from '../../services/repositories/customerRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';

export const CustomersPage = () => {
  const { user } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState(null);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', mobile: '', email: '', address: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadCustomers = async (overridePage = page, overrideLimit = limit) => {
    try {
      setLoading(true);
      const data = await customerRepository.getCustomers({
        search: search.trim() || undefined,
        page: overridePage,
        limit: overrideLimit,
      });
      setCustomers(data);
      setPagination(
        data.pagination || {
          total: data.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(data.length / overrideLimit)),
        }
      );
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadCustomers(1, limit);
  }, [search]);

  const handleOpenAdd = () => {
    setFormData({ name: '', mobile: '', email: '', address: '', notes: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      await customerRepository.createCustomer(formData, actor);
      setIsModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setFormError(err.message || 'Error saving customer.');
    } finally {
      setFormLoading(false);
    }
  };

  const columns = [
    {
      header: 'Guest Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
            {row.name.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-slate-800 text-sm block">{row.name}</span>
            {row.notes && <span className="text-xs text-slate-400 italic">{row.notes}</span>}
          </div>
        </div>
      )
    },
    {
      header: 'Mobile Phone',
      accessor: 'mobile',
      className: 'font-mono text-xs text-slate-600',
      render: (row) => row.mobile || '—'
    },
    {
      header: 'Visits',
      accessor: 'visitCount',
      className: 'font-bold text-slate-700 text-xs',
      render: (row) => `${row.visitCount || 0} visits`
    },
    {
      header: 'Total Spend (INR)',
      accessor: 'totalSpend',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">
          ₹{(row.totalSpend || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: 'Last Dining Visit',
      accessor: 'lastVisitAt',
      className: 'text-xs text-slate-400 font-mono',
      render: (row) => (row.lastVisitAt ? new Date(row.lastVisitAt).toLocaleDateString() : 'Never')
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer CRM Directory"
        subtitle="Manage regular guests, dining visit history, and cumulative billing spend"
      >
        <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
          Add Customer
        </Button>
      </PageHeader>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="w-full sm:max-w-sm">
          <Input
            icon={Search}
            placeholder="Search by guest name or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left">
          Total: {pagination?.total ?? customers.length} registered guests
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        emptyMessage="No customer records found."
        pagination={pagination}
        onPageChange={(p) => {
          setPage(p);
          loadCustomers(p, limit);
        }}
        onPageSizeChange={(l) => {
          setLimit(l);
          setPage(1);
          loadCustomers(1, l);
        }}
      />

      {/* Add Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Customer"
        subtitle="Save contact details for restaurant invoicing and history tracking"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <Input
            label="Full Name"
            placeholder="e.g. Vikram Singhania"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mobile Number"
              placeholder="10-digit mobile number"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />

            <Input
              label="Email (Optional)"
              type="email"
              placeholder="e.g. guest@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <Input
            label="Address (Optional)"
            placeholder="e.g. Sector 11, Gandhinagar"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Input
            label="Notes / Dietary Preferences"
            placeholder="e.g. Prefers corner tables, Jain food"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" loading={formLoading} className="w-full sm:w-auto">
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
