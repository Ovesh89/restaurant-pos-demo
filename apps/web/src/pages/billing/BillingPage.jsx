import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  DollarSign,
  Search,
  Printer,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  User,
  Coffee,
  Receipt,
  Tag,
  RefreshCw,
  Wallet,
  Clock
} from 'lucide-react';
import { billRepository, BILL_STATUS } from '../../services/repositories/billRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { customerRepository } from '../../services/repositories/customerRepository';
import { printService } from '../../services/printing/printService';
import { billingCalculator, DISCOUNT_TYPES, PAYMENT_MODES } from '../../services/calculations/billingCalculator';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { ORDER_STATUS } from '../../constants/orderStatus';

export const BillingPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [readyOrders, setReadyOrders] = useState([]);
  const [billsHistory, setBillsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Settlement Checkout Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeBill, setActiveBill] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerResults, setCustomerResults] = useState([]);

  // Discount
  const [discountType, setDiscountType] = useState(DISCOUNT_TYPES.FIXED);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');

  // Payment Entry
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES.UPI);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Customer Add Modal
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Post-Settlement Discount Modal State
  const [discountModalBill, setDiscountModalBill] = useState(null);
  const [modalDiscType, setModalDiscType] = useState(DISCOUNT_TYPES.PERCENTAGE);
  const [modalDiscValue, setModalDiscValue] = useState('');
  const [modalDiscReason, setModalDiscReason] = useState('');
  const [discountModalError, setDiscountModalError] = useState('');
  const [discountModalLoading, setDiscountModalLoading] = useState(false);
  const [discountModalSuccess, setDiscountModalSuccess] = useState(false);
  const [updatedSettledBill, setUpdatedSettledBill] = useState(null);

  const loadSettledBills = async (overridePage = historyPage, overrideLimit = historyLimit) => {
    try {
      setHistoryLoading(true);
      const bills = await billRepository.getBills({
        status: BILL_STATUS.PAID,
        page: overridePage,
        limit: overrideLimit,
      });
      setBillsHistory(bills);
      setHistoryPagination(
        bills.pagination || {
          total: bills.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(bills.length / overrideLimit)),
        }
      );
    } catch (err) {
      console.error('Failed to load settled bills:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [orders, bills] = await Promise.all([
        orderRepository.getOrders({
          status: [
            ORDER_STATUS.SERVED,
            ORDER_STATUS.READY,
            ORDER_STATUS.BILLING,
            ORDER_STATUS.KOT_SENT,
            ORDER_STATUS.PREPARING,
          ],
        }),
        billRepository.getBills({
          status: BILL_STATUS.PAID,
          page: 1,
          limit: historyLimit,
        }),
      ]);

      // Rule 12: Pending Settlement must exclude completed/paid records
      const settledOrderIds = new Set(
        bills
          .filter((b) => b.isSettled || b.status === BILL_STATUS.PAID || b.rawStatus === 'COMPLETED')
          .map((b) => b.orderId)
      );
      const pendingOrders = orders.filter((o) => !settledOrderIds.has(o.id));

      setReadyOrders(pendingOrders);
      setBillsHistory(bills);
      setHistoryPagination(
        bills.pagination || {
          total: bills.length,
          page: 1,
          limit: historyLimit,
          totalPages: Math.max(1, Math.ceil(bills.length / historyLimit)),
        }
      );

      const targetTableId = searchParams.get('tableId');
      const targetOrderId = searchParams.get('orderId');
      if (targetOrderId) {
        const match = pendingOrders.find((o) => o.id === targetOrderId);
        if (match) {
          handleOpenCheckout(match);
        }
      } else if (targetTableId) {
        const match = pendingOrders.find((o) => o.tableId === targetTableId);
        if (match) {
          handleOpenCheckout(match);
        }
      }
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [searchParams]);

  // Close Checkout Modal & Synchronize
  const handleCloseDesk = async () => {
    setSelectedOrder(null);
    setActiveBill(null);
    await loadBillingData();
  };

  // Open Checkout Terminal
  const handleOpenCheckout = async (order) => {
    setSelectedOrder(order);
    setActionError('');
    setSelectedCustomer(null);
    setDiscountValue(0);
    setDiscountReason('');

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      // Retrieve or initialize bill
      let bill;
      try {
        bill = await billRepository.generateBill({
          order,
          discount: { type: DISCOUNT_TYPES.FIXED, value: 0, reason: '' },
          actor
        });
      } catch (genErr) {
        // Fallback: If duplicate/conflict or already created, fetch directly by orderId
        const existing = await billRepository.getBillByOrderId(order.id);
        if (existing) {
          bill = existing;
        } else {
          throw genErr;
        }
      }

      // If bill is already fully settled but not yet closed on backend, close it to release table & order
      if (bill.isSettled && bill.rawStatus !== 'COMPLETED') {
        try {
          bill = await billRepository.closeBill(bill.id, actor);
          await loadBillingData();
        } catch (closeErr) {
          console.warn('Auto-closing settled bill in checkout:', closeErr);
        }
      }

      setActiveBill(bill);
      setPaymentAmount(bill.balance > 0 ? bill.balance.toString() : '');
    } catch (err) {
      console.error(err);
      setActionError(err.message);
    }
  };

  const handleOpenDiscountModal = (bill) => {
    setDiscountModalBill(bill);
    setModalDiscType(bill.discountType || DISCOUNT_TYPES.PERCENTAGE);
    setModalDiscValue(bill.discountValue ? bill.discountValue.toString() : '');
    setModalDiscReason(bill.discountReason || '');
    setDiscountModalError('');
    setDiscountModalSuccess(false);
    setUpdatedSettledBill(null);
  };

  const handleApplyPostSettlementDiscount = async (e) => {
    e.preventDefault();
    if (!discountModalBill) return;
    setDiscountModalError('');
    setDiscountModalLoading(true);

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const updated = await billRepository.applyDiscount(
        discountModalBill.id,
        {
          type: modalDiscType,
          value: Number(modalDiscValue) || 0,
          reason: modalDiscReason
        },
        actor
      );
      setUpdatedSettledBill(updated);
      setDiscountModalSuccess(true);
      await loadBillingData();
    } catch (err) {
      setDiscountModalError(err.message || 'Failed to update discount on settled bill.');
    } finally {
      setDiscountModalLoading(false);
    }
  };

  // Recompute bill on discount change
  const handleApplyDiscount = async () => {
    if (!selectedOrder) return;
    if (Number(discountValue) > 0 && !discountReason.trim()) {
      setActionError('A mandatory reason is required to apply discount.');
      return;
    }
    setActionError('');

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const bill = await billRepository.generateBill({
        order: selectedOrder,
        discount: {
          type: discountType,
          value: Number(discountValue),
          reason: discountReason.trim()
        },
        customer: selectedCustomer,
        actor
      });
      setActiveBill(bill);
      setPaymentAmount(bill.balance.toString());
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Add Payment Entry (Supports Split Payments: UPI + Cash + Card)
  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!activeBill) return;

    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setActionError('Please enter a valid payment amount.');
      return;
    }

    setActionError('');
    setActionLoading(true);

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const result = await billRepository.addPayment(
        activeBill.id,
        {
          mode: paymentMode,
          amount: amt,
          reference: paymentRef
        },
        actor
      );

      setActiveBill(result.bill);
      setPaymentRef('');
      setPaymentAmount(result.bill.balance > 0 ? result.bill.balance.toString() : '');

      if (result.isSettled) {
        // Automatically print invoice upon full settlement with dynamic UPI QR if applicable!
        const configuredUpiId = localStorage.getItem('gts_pos_upi_id') || 'q705457761@ybl';
        printService.printInvoice(result.bill, selectedOrder, selectedCustomer, null, {
          paymentMode,
          upiId: configuredUpiId,
        });
        await loadBillingData();
      }
    } catch (err) {
      setActionError(err.message || 'Payment recording failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Customer search
  const handleSearchCustomer = async (q) => {
    setCustomerQuery(q);
    if (!q.trim()) {
      setCustomerResults([]);
      return;
    }
    const results = await customerRepository.getCustomers(q);
    setCustomerResults(results);
  };

  const handleSelectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerQuery('');
    setCustomerResults([]);
  };

  const handleCreateQuickCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const cust = await customerRepository.createCustomer(
        { name: newCustName, mobile: newCustPhone },
        actor
      );
      setSelectedCustomer(cust);
      setIsNewCustModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReprintInvoice = (bill) => {
    const configuredUpiId = localStorage.getItem('gts_pos_upi_id') || 'q705457761@ybl';
    printService.printInvoice(bill, null, { name: bill.customerName, mobile: bill.customerMobile }, null, {
      upiId: configuredUpiId,
    });
  };

  const historyColumns = [
    {
      header: 'Invoice #',
      accessor: 'billNo',
      className: 'w-24 font-mono font-bold text-blue-700'
    },
    {
      header: 'Table / Source',
      accessor: 'tableNo',
      render: (row) => {
        if (row.orderType && row.orderType !== 'DINE_IN') {
          const typeBadgeStyles = {
            TAKEAWAY: 'bg-amber-50 text-amber-800 border-amber-200',
            ZOMATO: 'bg-rose-50 text-rose-800 border-rose-200',
            SWIGGY: 'bg-orange-50 text-orange-800 border-orange-200',
            ONLINE_OTHER: 'bg-purple-50 text-purple-800 border-purple-200',
          };
          const badgeClass = typeBadgeStyles[row.orderType] || 'bg-slate-100 text-slate-800 border-slate-200';
          const typeLabel = row.orderType === 'TAKEAWAY' ? 'Take Away' : row.orderType;
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-black border ${badgeClass}`}>
              {typeLabel}
            </span>
          );
        }
        return <span className="font-extrabold text-slate-800">{row.tableNo ? `Table ${row.tableNo}` : 'Direct'}</span>;
      }
    },
    {
      header: 'Guest / Customer',
      accessor: 'customerName',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.customerName ? `${row.customerName} (${row.customerMobile})` : 'Walk-in Guest'}
        </span>
      )
    },
    {
      header: 'Grand Total (INR)',
      accessor: 'grandTotal',
      align: 'right',
      render: (row) => <span className="font-extrabold text-slate-900">₹{row.grandTotal?.toLocaleString()}</span>
    },
    {
      header: 'Payment Modes',
      accessor: 'payments',
      render: (row) => (
        <div className="flex flex-wrap gap-1 text-[11px]">
          {row.payments?.map((p, pIdx) => (
            <span key={pIdx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
              {p.mode}: ₹{p.amount}
            </span>
          ))}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <Badge variant={row.status === BILL_STATUS.PAID ? 'success' : 'default'} size="sm">
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Time',
      accessor: 'createdAt',
      className: 'text-xs text-slate-400 font-mono',
      render: (row) => new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon={Tag}
            onClick={() => handleOpenDiscountModal(row)}
            title="Update Post-Settlement Discount"
          >
            Discount
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Printer}
            onClick={() => handleReprintInvoice(row)}
            title="Reprint Invoice"
          >
            Reprint
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Desk & Payment Settlement"
        subtitle="Generate final tax invoices, apply approved discounts, accept split payments (Cash, UPI, Card), and release tables"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={loadBillingData} loading={loading}>
          Refresh Queue
        </Button>
      </PageHeader>

      {/* Top Section: Active Tables & Online Orders Ready for Billing */}
      <div>
        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span>Orders Pending Settlement</span>
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center">
            {readyOrders.length}
          </span>
        </h2>

        {loading ? (
          <p className="text-xs text-slate-400">Checking pending bills...</p>
        ) : readyOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-xs font-medium">
            No active dining tables or takeaway orders pending bill settlement.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {readyOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase text-slate-400 font-mono">{ord.orderNo}</span>
                    <Badge variant={ord.status === ORDER_STATUS.SERVED ? 'success' : 'primary'} size="sm">
                      {ord.status}
                    </Badge>
                  </div>

                  <div className="my-3">
                    {ord.orderType && ord.orderType !== 'DINE_IN' ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                            {ord.orderType === 'TAKEAWAY' ? 'Take Away' : ord.orderType}
                          </span>
                          {ord.onlineOrderRef && (
                            <span className="text-[11px] font-mono font-bold text-slate-600">
                              #{ord.onlineOrderRef}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-slate-800 truncate">
                          {ord.customerName || 'Walk-in Guest'}
                        </h3>
                        {ord.customerPhone && (
                          <p className="text-xs text-slate-500 font-mono">{ord.customerPhone}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-black text-slate-800">Table {ord.tableNo}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Captain: {ord.captainName || 'Staff'}</p>
                      </>
                    )}
                    <p className="text-xs text-slate-600 mt-1.5 font-semibold">
                      {ord.items?.length} dishes ({ord.items?.reduce((a, b) => a + b.quantity, 0)} items)
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Subtotal</span>
                    <p className="text-base font-black text-slate-900">₹{ord.subtotal}</p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={Receipt}
                    onClick={() => handleOpenCheckout(ord)}
                  >
                    Settle Bill
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Invoices & Receipts History */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-800">Recent Settled Invoices</h2>
        <DataTable
          columns={historyColumns}
          data={billsHistory}
          loading={historyLoading}
          emptyMessage="No historical bills settled yet."
          pagination={historyPagination}
          onPageChange={(p) => {
            setHistoryPage(p);
            loadSettledBills(p, historyLimit);
          }}
          onPageSizeChange={(l) => {
            setHistoryLimit(l);
            setHistoryPage(1);
            loadSettledBills(1, l);
          }}
        />
      </div>

      {/* Comprehensive Checkout & Settlement Modal */}
      <Modal
        isOpen={!!selectedOrder && !!activeBill}
        onClose={handleCloseDesk}
        title={`Settle Bill: ${activeBill?.billNo}`}
        subtitle={`${selectedOrder?.orderType && selectedOrder.orderType !== 'DINE_IN' ? (selectedOrder.orderType === 'TAKEAWAY' ? 'Take Away' : selectedOrder.orderType) : `Table ${selectedOrder?.tableNo}`} • Order ${selectedOrder?.orderNo}`}
        maxWidth="max-w-4xl"
      >
        {activeBill && (
          <div className="space-y-4 sm:space-y-6">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Left Column: Customer & Items Breakdown */}
              <div className="space-y-4">
                {/* Guest / Customer Picker */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      Guest Profile (Optional)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNewCustModalOpen(true)}
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      + Add New
                    </button>
                  </div>

                  {selectedCustomer ? (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-800">{selectedCustomer.name}</p>
                        <p className="text-[11px] text-slate-500">{selectedCustomer.mobile}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(null)}
                        className="text-red-500 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="Search guest by mobile or name..."
                        value={customerQuery}
                        onChange={(e) => handleSearchCustomer(e.target.value)}
                      />
                      {customerResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-32 overflow-y-auto">
                          {customerResults.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none flex justify-between"
                            >
                              <span className="font-bold">{c.name}</span>
                              <span className="text-slate-400 font-mono">{c.mobile}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Items Snapshot */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Ordered Dishes</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                    {activeBill.items.map((i, idx) => (
                      <div key={idx} className="p-2.5 bg-white flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800">{i.name}</span>
                          <span className="text-slate-400 ml-1.5 font-mono">
                            {i.quantity}x @ ₹{i.unitPrice}
                          </span>
                        </div>
                        <span className="font-extrabold text-slate-900">₹{i.quantity * i.unitPrice}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discount Section */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-blue-600" /> Apply Discount
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyDiscount}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200"
                    >
                      Update Total
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      options={[
                        { value: DISCOUNT_TYPES.FIXED, label: 'Fixed Amount (₹)' },
                        { value: DISCOUNT_TYPES.PERCENTAGE, label: 'Percentage (%)' }
                      ]}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Discount value"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                  </div>

                  <Input
                    placeholder="Reason for discount (Required if value > 0)..."
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Right Column: Financial Calculation & Split Payment Collector */}
              <div className="space-y-4">
                {/* Financial Summary Card */}
                <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 shadow-sm text-xs space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono text-white">₹{activeBill.subtotal?.toFixed(2)}</span>
                  </div>

                  {activeBill.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Discount ({activeBill.discountReason || 'Discount'}):</span>
                      <span className="font-mono">-₹{activeBill.discountAmount?.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400">
                    <span>Taxable Base:</span>
                    <span className="font-mono text-white">₹{activeBill.taxableValue?.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>CGST (2.5%) + SGST (2.5%):</span>
                    <span className="font-mono text-white">₹{activeBill.taxAmount?.toFixed(2)}</span>
                  </div>

                  {activeBill.rounding !== 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Rounding:</span>
                      <span className="font-mono text-white">₹{activeBill.rounding?.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-700 flex justify-between items-center text-sm">
                    <span className="font-bold text-white">Grand Total:</span>
                    <span className="text-xl font-black text-amber-400">₹{activeBill.grandTotal}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span>Total Paid:</span>
                    <span className="font-bold text-emerald-400">₹{activeBill.paidAmount?.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-black">
                    <span className={activeBill.balance <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      Balance Due:
                    </span>
                    <span className={activeBill.balance <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      ₹{activeBill.balance?.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Captured Payments List */}
                {activeBill.payments && activeBill.payments.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Recorded Split Payments
                    </span>
                    <div className="space-y-1">
                      {activeBill.payments.map((p, idx) => (
                        <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-800">{p.mode}</span>
                            {p.reference && <span className="text-slate-400 ml-1.5 font-mono">({p.reference})</span>}
                          </div>
                          <span className="font-extrabold text-emerald-600">₹{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Split Payment Collector Form */}
                {activeBill.balance > 0 ? (
                  <form onSubmit={handleAddPayment} className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 uppercase tracking-wider text-[11px] flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-blue-600" /> Collect Payment Entry
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold">Supports Split Payments</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        label="Payment Mode"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        options={[
                          { value: PAYMENT_MODES.UPI, label: 'UPI / QR Code' },
                          { value: PAYMENT_MODES.CASH, label: 'Cash Currency' },
                          { value: PAYMENT_MODES.CARD, label: 'Credit / Debit Card' },
                          { value: PAYMENT_MODES.OTHER, label: 'Other' }
                        ]}
                      />
                      <Input
                        label="Amount (₹)"
                        type="number"
                        min="1"
                        max={activeBill.balance}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        required
                      />
                    </div>

                    <Input
                      label="Transaction Ref / Auth Code (Optional)"
                      placeholder="e.g. UPI Ref / Last 4 Card digits"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                    />

                    <Button type="submit" variant="primary" className="w-full" loading={actionLoading}>
                      Record Payment Entry
                    </Button>
                  </form>
                ) : (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-emerald-800 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="font-black text-sm">Bill is Fully Settled!</p>
                    <p className="text-xs text-emerald-700">
                      {selectedOrder?.orderType && selectedOrder.orderType !== 'DINE_IN'
                        ? 'Order is completed and tax invoice is generated.'
                        : `Table ${selectedOrder?.tableNo} is released to AVAILABLE and tax invoice is generated.`}
                    </p>
                    <Button
                      variant="primary"
                      icon={Printer}
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const configuredUpiId = localStorage.getItem('gts_pos_upi_id') || 'q705457761@ybl';
                        printService.printInvoice(activeBill, selectedOrder, selectedCustomer, null, {
                          paymentMode: activeBill.payments?.find((p) => p.mode === 'UPI') ? 'UPI' : paymentMode,
                          upiId: configuredUpiId,
                        });
                      }}
                    >
                      Print Tax Invoice
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={handleCloseDesk}
              >
                Close Desk
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Add Customer Modal */}
      <Modal
        isOpen={isNewCustModalOpen}
        onClose={() => setIsNewCustModalOpen(false)}
        title="Quick Register Guest"
        subtitle="Add guest phone and name for invoice records"
      >
        <form onSubmit={handleCreateQuickCustomer} className="space-y-4">
          <Input
            label="Guest Full Name"
            placeholder="e.g. Priya Sharma"
            value={newCustName}
            onChange={(e) => setNewCustName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Mobile Phone"
            placeholder="10-digit mobile number"
            value={newCustPhone}
            onChange={(e) => setNewCustPhone(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsNewCustModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Register & Attach</Button>
          </div>
        </form>
      </Modal>

      {/* Post-Settlement Discount Adjustment Modal */}
      <Modal
        isOpen={!!discountModalBill}
        onClose={() => setDiscountModalBill(null)}
        title={`Adjust Discount: ${discountModalBill?.billNo}`}
        subtitle={`Table ${discountModalBill?.tableNo} • Settled Grand Total: ₹${discountModalBill?.grandTotal}`}
      >
        {discountModalBill && (
          <form onSubmit={handleApplyPostSettlementDiscount} className="space-y-4">
            {discountModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{discountModalError}</span>
              </div>
            )}

            {discountModalSuccess ? (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-emerald-800 space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold text-sm">Discount Updated Successfully!</p>
                <p className="text-xs text-emerald-700">
                  New Grand Total: <span className="font-mono font-bold text-slate-900">₹{updatedSettledBill?.grandTotal}</span>
                  {updatedSettledBill?.discountAmount > 0 && ` (Discount: ₹${updatedSettledBill?.discountAmount})`}
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="primary"
                    icon={Printer}
                    onClick={() => {
                      printService.printInvoice(updatedSettledBill, null, {
                        name: updatedSettledBill.customerName,
                        mobile: updatedSettledBill.customerMobile
                      });
                    }}
                  >
                    Print Updated Tax Invoice
                  </Button>
                  <Button variant="secondary" onClick={() => setDiscountModalBill(null)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bill Subtotal:</span>
                    <span className="font-mono font-bold text-slate-800">₹{discountModalBill.subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Grand Total:</span>
                    <span className="font-mono font-bold text-slate-800">₹{discountModalBill.grandTotal}</span>
                  </div>
                  {discountModalBill.discountAmount > 0 && (
                    <div className="flex justify-between text-amber-700 font-medium">
                      <span>Existing Discount:</span>
                      <span>-₹{discountModalBill.discountAmount} ({discountModalBill.discountReason})</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Discount Type"
                    value={modalDiscType}
                    onChange={(e) => setModalDiscType(e.target.value)}
                    options={[
                      { value: DISCOUNT_TYPES.PERCENTAGE, label: 'Percentage (%)' },
                      { value: DISCOUNT_TYPES.FIXED, label: 'Fixed Amount (₹)' }
                    ]}
                  />
                  <Input
                    label="Discount Value"
                    type="number"
                    min="0"
                    step="any"
                    value={modalDiscValue}
                    onChange={(e) => setModalDiscValue(e.target.value)}
                    placeholder={modalDiscType === DISCOUNT_TYPES.PERCENTAGE ? 'e.g. 10' : 'e.g. 100'}
                    required
                  />
                </div>

                <Input
                  label="Mandatory Reason"
                  value={modalDiscReason}
                  onChange={(e) => setModalDiscReason(e.target.value)}
                  placeholder="e.g. Manager courtesy, loyalty discount"
                  required
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button variant="secondary" onClick={() => setDiscountModalBill(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={discountModalLoading}>
                    Apply & Update Invoice
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
};
