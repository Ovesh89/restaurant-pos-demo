import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  TrendingUp,
  History,
  CheckCircle,
  XCircle,
  UtensilsCrossed,
  Tag,
  DollarSign,
  Trash2
} from 'lucide-react';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { APP_CONFIG } from '../../config/appConfig';
import { PERMISSIONS } from '../../constants/permissions';

export const ProductsPage = () => {
  const { user, role, hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.MENU_EDIT);
  const isAdminOrOwner = user?.role === 'owner' || user?.role === 'admin' || role === 'owner' || role === 'admin';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStation, setSelectedStation] = useState('');

  // Add/Edit Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    categoryId: '',
    price: '',
    taxRate: 5,
    station: 'Main Curry',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Price Change Modal State (When editing only price with mandatory audit reason)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceProduct, setPriceProduct] = useState(null);
  const [newPriceValue, setNewPriceValue] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [priceError, setPriceError] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);

  // Price History Audit Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [priceHistoryRecords, setPriceHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadData = async (overridePage = page, overrideLimit = limit) => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        productRepository.getProducts({
          categoryId: selectedCategory || undefined,
          station: selectedStation || undefined,
          search: search.trim() || undefined,
          page: overridePage,
          limit: overrideLimit,
        }),
        categoryRepository.getCategories(true)
      ]);
      setProducts(prods);
      setCategories(cats);
      setPagination(
        prods.pagination || {
          total: prods.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(prods.length / overrideLimit)),
        }
      );
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadData(1, limit);
  }, [selectedCategory, selectedStation, search]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      code: '',
      categoryId: categories[0]?.id || '',
      price: '',
      taxRate: 5,
      station: 'Main Curry',
      description: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      code: p.code || '',
      categoryId: p.categoryId,
      price: p.price,
      taxRate: p.taxRate || 5,
      station: p.station || 'Main Curry',
      description: p.description || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenPriceChange = (p) => {
    setPriceProduct(p);
    setNewPriceValue(p.price.toString());
    setPriceReason('');
    setPriceError('');
    setIsPriceModalOpen(true);
  };

  const handleOpenHistory = async (p = null) => {
    setHistoryProduct(p);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const records = await productRepository.getPriceHistory(p ? p.id : null);
      setPriceHistoryRecords(records);
    } catch (err) {
      console.error('Error loading price history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      if (editingProduct) {
        // If price was modified inside the general edit modal, we require a reason or warn
        if (Number(formData.price) !== editingProduct.price) {
          throw new Error('To change selling price, please use the specific "Change Price" action which logs mandatory audit justification.');
        }
        await productRepository.updateProduct(editingProduct.id, formData, actor);
      } else {
        await productRepository.createProduct(formData, actor);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Error saving product.');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePriceSubmit = async (e) => {
    e.preventDefault();
    setPriceError('');

    if (!priceReason.trim()) {
      setPriceError('A mandatory reason is required to update menu price.');
      return;
    }

    const numericPrice = Number(newPriceValue);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setPriceError('Please enter a valid non-negative price.');
      return;
    }

    if (numericPrice === priceProduct.price) {
      setPriceError('New price must be different from current price.');
      return;
    }

    setPriceLoading(true);
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await productRepository.updateProduct(
        priceProduct.id,
        { price: numericPrice },
        actor,
        priceReason
      );
      setIsPriceModalOpen(false);
      await loadData();
    } catch (err) {
      setPriceError(err.message || 'Failed to update price.');
    } finally {
      setPriceLoading(false);
    }
  };

  const handleToggleAvailability = async (p) => {
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await productRepository.toggleProductAvailability(p.id, actor);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (p) => {
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await productRepository.toggleProductStatus(p.id, actor);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Are you sure you want to permanently delete the dish "${p.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await productRepository.deleteProduct(p.id, actor);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete product.');
    }
  };

  const handleDeletePriceRecord = async (rec) => {
    if (!window.confirm(`Are you sure you want to delete this price history revision (₹${rec.oldPrice} → ₹${rec.newPrice})?`)) {
      return;
    }
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      const prodId = rec.productId || historyProduct?.id;
      await productRepository.deletePriceHistory(rec.id, prodId);
      await handleOpenHistory(historyProduct);
    } catch (err) {
      alert(err.message || 'Failed to delete price history record.');
    }
  };

  const getCategoryName = (catId) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : 'Unknown';
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'code',
      className: 'w-24 font-mono font-bold text-slate-500'
    },
    {
      header: 'Product Name',
      accessor: 'name',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800 text-sm">{row.name}</span>
          {row.description && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{row.description}</p>
          )}
        </div>
      )
    },
    {
      header: 'Category',
      accessor: 'categoryId',
      render: (row) => (
        <Badge variant="primary" size="sm">
          {getCategoryName(row.categoryId)}
        </Badge>
      )
    },
    {
      header: 'Station',
      accessor: 'station',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
          {row.station || 'Main Curry'}
        </span>
      )
    },
    {
      header: 'Price (INR)',
      accessor: 'price',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <span className="font-extrabold text-slate-900 text-sm">₹{row.price.toLocaleString()}</span>
          <span className="block text-[10px] text-slate-400 font-mono">+{row.taxRate}% GST</span>
        </div>
      )
    },
    {
      header: 'Kitchen Avail.',
      accessor: 'isAvailable',
      align: 'center',
      render: (row) => (
        <button
          disabled={!canEdit}
          onClick={() => handleToggleAvailability(row)}
          title="Toggle instant item availability"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
            row.isAvailable
              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${row.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          {row.isAvailable ? 'In Stock' : 'Sold Out'}
        </button>
      )
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? 'Active' : 'Archived'}
        </Badge>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => {
        if (!canEdit) return null;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              icon={TrendingUp}
              title="Update item selling price with reason"
              onClick={() => handleOpenPriceChange(row)}
            >
              Price
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Edit2}
              title="Edit dish description and details"
              onClick={() => handleOpenEdit(row)}
            >
              Edit
            </Button>
            <button
              onClick={() => handleOpenHistory(row)}
              title="View Price Change History"
              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <History className="w-4 h-4" />
            </button>
            {isAdminOrOwner && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                title="Permanently Delete Dish"
                onClick={() => handleDeleteProduct(row)}
              >
                Delete
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
        title="Menu Products & Pricing"
        subtitle="Configure dishes, price history, kitchen stations, and real-time 86/stock availability"
      >
        <Button
          variant="secondary"
          icon={History}
          onClick={() => handleOpenHistory(null)}
        >
          Full Price Audit
        </Button>
        {canEdit && (
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            Add Dish
          </Button>
        )}
      </PageHeader>

      {/* Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            placeholder="Search dish or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name }))
            ]}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            options={[
              { value: '', label: 'All Stations' },
              ...APP_CONFIG.DEFAULT_KITCHEN_STATIONS.map((s) => ({ value: s.name, label: s.name }))
            ]}
          />
        </div>

        <div className="w-full sm:w-auto sm:ml-auto text-xs text-slate-500 font-semibold text-right">
          Total: {pagination?.total ?? products.length} dishes
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        emptyMessage="No products match your filter criteria."
        pagination={pagination}
        onPageChange={(newPage) => {
          setPage(newPage);
          loadData(newPage, limit);
        }}
        onPageSizeChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
          loadData(1, newLimit);
        }}
      />

      {/* Add / Edit General Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Edit Product Information' : 'Add New Menu Product'}
        subtitle="Manage dish naming, ingredients description, and kitchen preparation station"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input
              label="Dish / Item Name"
              placeholder="e.g. Butter Chicken"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Product Code / SKU"
              placeholder="e.g. CHK-01"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Select
              label="Category"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />

            <Select
              label="Kitchen Station"
              value={formData.station}
              onChange={(e) => setFormData({ ...formData, station: e.target.value })}
              options={APP_CONFIG.DEFAULT_KITCHEN_STATIONS.map((s) => ({ value: s.name, label: s.name }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input
              label="Selling Price (₹)"
              type="number"
              min="0"
              placeholder="e.g. 450"
              value={formData.price}
              disabled={!!editingProduct}
              helperText={editingProduct ? 'Use "Price" button to modify price with reason' : ''}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />

            <Input
              label="GST / Tax Rate (%)"
              type="number"
              min="0"
              max="28"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description & Notes
            </label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              placeholder="Dish details, allergen flags, ingredients..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingProduct ? 'Save Updates' : 'Add to Menu'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mandatory Price Change Audit Modal */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title="Modify Selling Price"
        subtitle={`Update price for "${priceProduct?.name}" with mandatory audit reason`}
      >
        <form onSubmit={handlePriceSubmit} className="space-y-4">
          {priceError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {priceError}
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Current Price</span>
              <p className="text-lg font-bold text-slate-700">₹{priceProduct?.price}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">Product Code</span>
              <p className="text-sm font-mono font-bold text-slate-700">{priceProduct?.code}</p>
            </div>
          </div>

          <Input
            label="New Selling Price (₹)"
            type="number"
            min="0"
            step="1"
            value={newPriceValue}
            onChange={(e) => setNewPriceValue(e.target.value)}
            icon={DollarSign}
            required
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Price Revision (Mandatory)
            </label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              placeholder="e.g. Raw material cost increase, festive seasonal rate revision..."
              value={priceReason}
              onChange={(e) => setPriceReason(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsPriceModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={priceLoading}>
              Commit Price Change
            </Button>
          </div>
        </form>
      </Modal>

      {/* Price History Audit Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={historyProduct ? `Price History: ${historyProduct.name}` : 'Master Price Change History'}
        subtitle="Chronological audit records of all food selling price revisions"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {historyLoading ? (
            <p className="text-sm text-slate-500 text-center py-6">Loading audit records...</p>
          ) : priceHistoryRecords.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No historical price changes recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
              {priceHistoryRecords.map((rec) => (
                <div key={rec.id} className="py-3 text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">{rec.productName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(rec.changedAt).toLocaleString()}
                      </span>
                      {isAdminOrOwner && (
                        <button
                          onClick={() => handleDeletePriceRecord(rec)}
                          title="Delete Price Revision Record"
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="line-through text-slate-400 font-semibold">₹{rec.oldPrice}</span>
                    <span className="font-extrabold text-blue-600 text-sm">→ ₹{rec.newPrice}</span>
                    <span className="ml-auto text-slate-500">Changed by: <b className="text-slate-700">{rec.changedBy}</b></span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-lg text-slate-600 mt-1 italic">
                    "{rec.reason}"
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
