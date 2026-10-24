import React, { useState, useEffect } from 'react';
import { Plus, Search, User, Phone, MapPin, Calendar, DollarSign, Award, Clock, Receipt, ShoppingBag } from 'lucide-react';
import { customerRepository } from '../../services/repositories/customerRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { useTranslation } from '../../hooks/useTranslation';

export const CustomersPage = () => {
  const { user } = useAuth();
  const { t, formatNumber, formatCurrency } = useTranslation();

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

  // Customer Orders List Modal
  const [selectedCustomerForOrders, setSelectedCustomerForOrders] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
  const [customerOrdersError, setCustomerOrdersError] = useState('');

  const handleOpenCustomerOrders = async (customer) => {
    setSelectedCustomerForOrders(customer);
    setCustomerOrders([]);
    setCustomerOrdersLoading(true);
    setCustomerOrdersError('');

    try {
      const custId = customer.id || customer._id;
      const res = await orderRepository.getOrderHistory({
        customerId: custId,
        limit: 100,
      });
      const list = Array.isArray(res) ? res : (res?.orders || res?.items || []);
      setCustomerOrders(list);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      setCustomerOrdersError(err.message || 'Failed to load orders for this customer.');
    } finally {
      setCustomerOrdersLoading(false);
    }
  };

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
      header: t('customers.customerName', 'Guest Name'),
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
      header: t('customers.mobileNumber', 'Mobile Phone'),
      accessor: 'mobile',
      className: 'font-mono text-xs text-slate-600',
      render: (row) => row.mobile || '—'
    },
    {
      header: t('customers.totalVisits', 'Visits'),
      accessor: 'visitCount',
      className: 'font-bold text-slate-700 text-xs',
      render: (row) => `${formatNumber(row.visitCount || 0)} ${t('customers.totalVisits', 'visits')}`
    },
    {
      header: t('customers.totalSpent', 'Total Spend'),
      accessor: 'totalSpend',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">
          {formatCurrency(row.totalSpend || 0)}
        </span>
      )
    },
    {
      header: t('customers.lastVisit', 'Last Dining Visit'),
      accessor: 'lastVisitAt',
      className: 'text-xs text-slate-400 font-mono',
      render: (row) => (row.lastVisitAt ? new Date(row.lastVisitAt).toLocaleDateString() : t('common.never', 'Never'))
    },
    {
      header: t('common.actions', 'Actions'),
      align: 'right',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          icon={Receipt}
          onClick={() => handleOpenCustomerOrders(row)}
          className="text-xs font-bold whitespace-nowrap"
        >
          {t('orders.orders', 'Orders List')}
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('customers.title', 'Customer CRM Directory')}
        subtitle={t('customers.subtitle', 'Manage regular guests, dining visit history, and cumulative billing spend')}
      >
        <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
          {t('customers.addCustomer', 'Add Customer')}
        </Button>
      </PageHeader>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-2 sm:flex sm:flex-row items-center gap-2.5 sm:gap-4 pos-filter-grid">
        <div className="w-full col-span-2 sm:col-span-1 sm:max-w-sm">
          <Input
            icon={Search}
            placeholder={t('common.search', 'Search by guest name or mobile...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left col-span-2 sm:col-span-1">
          {t('common.total', 'Total')}: {formatNumber(pagination?.total ?? customers.length)}
        </div>
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={customers}
          loading={loading}
          emptyMessage={t('customers.noCustomers', 'No customer records found.')}
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
      </div>

      {/* Mobile-Only Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
      <div className="block md:hidden">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading customers...')}</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
            {t('customers.noCustomers', 'No customer records found.')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customers.map((row) => {
                const initial = row.name ? row.name.charAt(0).toUpperCase() : '?';
                const lastVisit = row.lastVisitAt
                  ? new Date(row.lastVisitAt).toLocaleDateString()
                  : t('common.never', 'Never');

                return (
                  <div
                    key={row.id || row._id}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md"
                  >
                    <div>
                      {/* Top Header: Avatar + Name + Visits Badge */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center border border-blue-200 shrink-0">
                            {initial}
                          </div>
                          <div className="truncate">
                            <h3 className="font-bold text-slate-900 text-sm truncate">{row.name}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {row.createdAt ? `Joined ${new Date(row.createdAt).toLocaleDateString()}` : 'Registered Guest'}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs shrink-0 border border-slate-200">
                          {formatNumber(row.visitCount || 0)} {t('customers.totalVisits', 'visits')}
                        </span>
                      </div>

                      {/* Phone Tap-To-Call Bar & Spend */}
                      <div className="my-2.5 flex items-center justify-between">
                        {row.mobile ? (
                          <a
                            href={`tel:${row.mobile}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold font-mono text-xs hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{row.mobile}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-mono">No phone recorded</span>
                        )}

                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            {t('customers.totalSpent', 'Total Spend')}
                          </span>
                          <span className="text-sm font-extrabold text-emerald-600">
                            {formatCurrency(row.totalSpend || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Details & Notes */}
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 text-xs text-slate-600 mb-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{t('customers.lastVisit', 'Last Dining')}:</span>
                          </span>
                          <span className="font-semibold text-slate-700">{lastVisit}</span>
                        </div>

                        {row.email && (
                          <p className="text-[11px] text-slate-500 truncate font-mono">
                            {row.email}
                          </p>
                        )}

                        {row.address && (
                          <div className="flex items-start gap-1 text-[11px] text-slate-500 pt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{row.address}</span>
                          </div>
                        )}

                        {row.notes && (
                          <p className="text-[11px] text-blue-700 italic bg-blue-50/60 p-1.5 rounded-lg border border-blue-100 mt-1">
                            Note: {row.notes}
                          </p>
                        )}
                      </div>
                      {/* Customer Orders Action */}
                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Receipt}
                          onClick={() => handleOpenCustomerOrders(row)}
                          className="w-full text-xs font-bold justify-center"
                        >
                          {t('orders.orders', 'View Orders List')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Pagination */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <Pagination
                currentPage={pagination?.page || page}
                totalPages={pagination?.totalPages || 1}
                totalItems={pagination?.total || customers.length}
                pageSize={pagination?.limit || limit}
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
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('customers.addCustomer', 'Register New Customer')}
        subtitle={t('customers.customerModalSubtitle', 'Save contact details for restaurant invoicing and history tracking')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <Input
            label={t('auth.fullName', 'Full Name')}
            placeholder="e.g. Vikram Singhania"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('customers.mobileNumber', 'Mobile Number')}
              placeholder="10-digit mobile number"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />

            <Input
              label={t('customers.email', 'Email (Optional)')}
              type="email"
              placeholder="e.g. guest@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <Input
            label={t('settings.branchAddress', 'Address (Optional)')}
            placeholder="e.g. Sector 11, Gandhinagar"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Input
            label={t('customers.notes', 'Notes / Dietary Preferences')}
            placeholder="e.g. Prefers corner tables, Jain food"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={formLoading} className="w-full sm:w-auto">
              {t('common.save', 'Save Customer')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Orders List Modal */}
      <Modal
        isOpen={Boolean(selectedCustomerForOrders)}
        onClose={() => setSelectedCustomerForOrders(null)}
        title={`Orders: ${selectedCustomerForOrders?.name || 'Customer'}`}
        subtitle={
          selectedCustomerForOrders?.mobile
            ? `Phone: ${selectedCustomerForOrders.mobile} • Total Spend: ${formatCurrency(selectedCustomerForOrders.totalSpend || 0)}`
            : `Total Spend: ${formatCurrency(selectedCustomerForOrders?.totalSpend || 0)}`
        }
      >
        <div className="space-y-3">
          {customerOrdersLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-slate-200 border-t-blue-600 mb-2"></div>
              <p>{t('common.loading', 'Loading customer orders...')}</p>
            </div>
          ) : customerOrdersError ? (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs">
              {customerOrdersError}
            </div>
          ) : customerOrders.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 font-medium">
              No orders found for this customer yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1 pb-1 border-b border-slate-100">
                <span>{customerOrders.length} Order(s) Recorded</span>
                <span>Cumulative: {formatCurrency(customerOrders.reduce((sum, o) => sum + Number(o.grandTotal || o.subtotal || 0), 0))}</span>
              </div>
              {customerOrders.map((ord) => {
                const amount = Number(ord.grandTotal !== undefined ? ord.grandTotal : (ord.subtotal || 0));
                const dateStr = ord.createdAt
                  ? new Date(ord.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                  : '—';
                const itemsCount = ord.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || ord.items?.length || 0;

                return (
                  <div
                    key={ord.id || ord._id}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 transition-all shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {ord.orderNo || ord.orderNumber || 'ORD'}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {ord.tableNo ? `Table ${ord.tableNo}` : (ord.orderType || 'Order')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-slate-900 block font-mono">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 gap-2">
                      <span className="shrink-0">{dateStr}</span>
                      <span className="font-medium text-slate-600 truncate text-right">
                        {itemsCount} item(s): {ord.items?.map((i) => `${i.productName || i.name} (x${i.quantity})`).slice(0, 3).join(', ')}{ord.items?.length > 3 ? '...' : ''}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                        ord.status === 'COMPLETED' || ord.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : ord.status === 'CANCELLED' || ord.status === 'REJECTED'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {ord.status || 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" onClick={() => setSelectedCustomerForOrders(null)} className="w-full sm:w-auto">
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
