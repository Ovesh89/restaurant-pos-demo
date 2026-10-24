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
  Filter,
  ChevronDown,
  ChevronUp,
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
import { Pagination } from '../../components/common/Pagination';
import { APP_CONFIG } from '../../config/appConfig';
import { PERMISSIONS } from '../../constants/permissions';
import { useTranslation } from '../../hooks/useTranslation';

export const ProductsPage = () => {
  const { user, role, hasPermission } = useAuth();
  const { t, formatNumber, formatCurrency } = useTranslation();
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
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

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
      header: t('menu.shortCode', 'Code'),
      accessor: 'code',
      className: 'w-24 font-mono font-bold text-slate-500'
    },
    {
      header: t('menu.productName', 'Product Name'),
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
      header: t('menu.categoryName', 'Category'),
      accessor: 'categoryId',
      render: (row) => (
        <Badge variant="primary" size="sm">
          {getCategoryName(row.categoryId)}
        </Badge>
      )
    },
    {
      header: t('menu.kitchenStation', 'Station'),
      accessor: 'station',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
          {row.station || 'Main Curry'}
        </span>
      )
    },
    {
      header: t('menu.price', 'Price'),
      accessor: 'price',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(row.price)}</span>
          <span className="block text-[10px] text-slate-400 font-mono">+{formatNumber(row.taxRate)}% GST</span>
        </div>
      )
    },
    {
      header: t('menu.availability', 'Kitchen Avail.'),
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
          {row.isAvailable ? t('menu.inStock', 'In Stock') : t('menu.outOfStock', 'Sold Out')}
        </button>
      )
    },
    {
      header: t('common.status', 'Status'),
      accessor: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
          {row.isActive ? t('common.active', 'Active') : t('common.inactive', 'Archived')}
        </Badge>
      )
    },
    {
      header: t('common.actions', 'Actions'),
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
              {t('menu.price', 'Price')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Edit2}
              title="Edit dish description and details"
              onClick={() => handleOpenEdit(row)}
            >
              {t('common.edit', 'Edit')}
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
        title={t('menu.productsTitle', 'Menu Products & Pricing')}
        subtitle={t('menu.productsSubtitle', 'Configure dishes, price history, kitchen stations, and real-time 86/stock availability')}
      >
        <Button
          variant="secondary"
          icon={History}
          onClick={() => handleOpenHistory(null)}
          className="h-11 w-full justify-center text-xs font-bold"
        >
          {t('menu.priceHistory', 'Price History')}
        </Button>
        {canEdit && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={handleOpenAdd}
            className="h-11 w-full justify-center text-xs font-bold"
          >
            {t('menu.addProduct', 'Add Dish')}
          </Button>
        )}
      </PageHeader>

      {/* Mobile Filter Toggle Header */}
      <div className="md:hidden flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate">
              {selectedCategory ? (categories.find((c) => c.id === selectedCategory)?.name || 'Category') : t('orders.allCategories', 'All Categories')}
            </div>
            <div className="text-[10px] text-slate-500 font-medium truncate">
              {selectedStation || t('kitchen.allStations', 'All Stations')} • {formatNumber(pagination?.total ?? products.length)} {t('orders.dishes', 'dishes')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shrink-0"
        >
          <span>{isMobileFiltersOpen ? t('common.collapse', 'Collapse') : t('common.filter', 'Filters')}</span>
          {isMobileFiltersOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
      </div>

      {/* Filter Bar */}
      <div className={`bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex-col md:flex md:flex-row md:items-center gap-2.5 sm:gap-3 ${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            placeholder={t('common.search', 'Search dish or SKU...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 w-full md:flex md:items-center md:w-auto pos-filter-grid">
          <div className="w-full sm:w-48">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: '', label: t('orders.allCategories', 'All Categories') },
                ...categories.map((c) => ({ value: c.id, label: c.name }))
              ]}
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              options={[
                { value: '', label: t('kitchen.allStations', 'All Stations') },
                ...APP_CONFIG.DEFAULT_KITCHEN_STATIONS.map((s) => ({ value: s.name, label: s.name }))
              ]}
            />
          </div>
        </div>

        <div className="w-full sm:w-auto sm:ml-auto text-xs text-slate-500 font-semibold text-right">
          {t('common.total', 'Total')}: {formatNumber(pagination?.total ?? products.length)}
        </div>
      </div>

      {/* Desktop / Tablet Data Table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          emptyMessage={t('menu.noProducts', 'No products match your filter criteria.')}
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
      </div>

      {/* Mobile-Only Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
      <div className="block md:hidden">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading menu products...')}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
            {t('menu.noProducts', 'No products match your filter criteria.')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((row) => (
                <div
                  key={row.id}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md"
                >
                  <div>
                    {/* Top Bar: Dish Name, SKU, Category Badge */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm truncate">{row.name}</h3>
                          {row.code && (
                            <span className="font-mono text-[10px] text-slate-400">({row.code})</span>
                          )}
                        </div>
                        {row.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{row.description}</p>
                        )}
                      </div>

                      <Badge variant="primary" size="sm">
                        {getCategoryName(row.categoryId)}
                      </Badge>
                    </div>

                    {/* Pricing, Station, and Stock Availability */}
                    <div className="my-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-base font-black text-slate-900">
                          {formatCurrency(row.price)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          +{formatNumber(row.taxRate)}% GST
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {row.station || 'Main Curry'}
                        </span>

                        <button
                          disabled={!canEdit}
                          onClick={() => handleToggleAvailability(row)}
                          title="Toggle instant item availability"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                            row.isAvailable
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${row.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {row.isAvailable ? t('menu.inStock', 'In Stock') : t('menu.outOfStock', 'Sold Out')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  {canEdit && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={TrendingUp}
                        onClick={() => handleOpenPriceChange(row)}
                        className="flex-1 text-xs justify-center"
                      >
                        {t('menu.price', 'Price')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Edit2}
                        onClick={() => handleOpenEdit(row)}
                        className="flex-1 text-xs justify-center"
                      >
                        {t('common.edit', 'Edit')}
                      </Button>
                      <button
                        onClick={() => handleOpenHistory(row)}
                        title="View Price Change History"
                        className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 shrink-0"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      {isAdminOrOwner && (
                        <button
                          onClick={() => handleDeleteProduct(row)}
                          title="Permanently Delete Dish"
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

            {/* Mobile Pagination */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <Pagination
                currentPage={pagination?.page || page}
                totalPages={pagination?.totalPages || 1}
                totalItems={pagination?.total || products.length}
                pageSize={pagination?.limit || limit}
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
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit General Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? t('menu.editProduct', 'Edit Product Information') : t('menu.addProduct', 'Add New Menu Product')}
        subtitle={t('menu.productsSubtitle', 'Manage dish naming, ingredients description, and kitchen preparation station')}
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
              label={t('menu.productName', 'Dish / Item Name')}
              placeholder="e.g. Butter Chicken"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label={t('menu.shortCode', 'Product Code / SKU')}
              placeholder="e.g. CHK-01"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Select
              label={t('menu.categoryName', 'Category')}
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />

            <Select
              label={t('menu.kitchenStation', 'Kitchen Station')}
              value={formData.station}
              onChange={(e) => setFormData({ ...formData, station: e.target.value })}
              options={APP_CONFIG.DEFAULT_KITCHEN_STATIONS.map((s) => ({ value: s.name, label: s.name }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input
              label={`${t('menu.price', 'Selling Price')} (₹)`}
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
              label={t('settings.defaultTaxRate', 'GST / Tax Rate (%)')}
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
              {t('common.description', 'Description & Notes')}
            </label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              placeholder="Dish details, allergen flags, ingredients..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" className="w-full sm:w-auto" loading={formLoading}>
              {editingProduct ? t('common.save', 'Save Updates') : t('common.create', 'Add to Menu')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mandatory Price Change Audit Modal */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title={t('menu.modifyPrice', 'Modify Selling Price')}
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
              <span className="text-xs text-slate-500 font-medium">{t('menu.currentPrice', 'Current Price')}</span>
              <p className="text-lg font-bold text-slate-700">{formatCurrency(priceProduct?.price || 0)}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">{t('menu.shortCode', 'Product Code')}</span>
              <p className="text-sm font-mono font-bold text-slate-700">{priceProduct?.code}</p>
            </div>
          </div>

          <Input
            label={`${t('menu.newPrice', 'New Selling Price')} (₹)`}
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
              {t('menu.priceReason', 'Reason for Price Revision (Mandatory)')}
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

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsPriceModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" className="w-full sm:w-auto" loading={priceLoading}>
              {t('common.save', 'Commit Price Change')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Price History Audit Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={historyProduct ? `${t('menu.priceHistory', 'Price History')}: ${historyProduct.name}` : t('menu.masterPriceHistory', 'Master Price Change History')}
        subtitle="Chronological audit records of all food selling price revisions"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {historyLoading ? (
            <p className="text-sm text-slate-500 text-center py-6">{t('common.loading', 'Loading audit records...')}</p>
          ) : priceHistoryRecords.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">{t('menu.noPriceHistory', 'No historical price changes recorded.')}</p>
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
                    <span className="line-through text-slate-400 font-semibold">{formatCurrency(rec.oldPrice)}</span>
                    <span className="font-extrabold text-blue-600 text-sm">→ {formatCurrency(rec.newPrice)}</span>
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
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsHistoryModalOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
