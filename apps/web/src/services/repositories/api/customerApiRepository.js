import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';

class CustomerApiRepository {
  normalizeCustomer(cust) {
    if (!cust) return null;

    const phone = cust.phone || cust.mobile || '';
    const visitCount = Number(cust.totalVisits !== undefined ? cust.totalVisits : (cust.visitCount || 0));
    const totalSpend = Number(cust.totalSpend || 0);

    return {
      id: cust.id || cust._id,
      _id: cust.id || cust._id,
      name: cust.name || '',
      mobile: phone,
      phone,
      email: cust.email || '',
      address: cust.address || '',
      notes: cust.notes || '',
      visitCount,
      totalVisits: visitCount,
      totalSpend,
      lastVisitAt: cust.lastVisitAt || null,
      createdAt: cust.createdAt,
      updatedAt: cust.updatedAt
    };
  }

  async getCustomers(queryOrOptions = '') {
    const isOptions = queryOrOptions && typeof queryOrOptions === 'object';
    const search = isOptions
      ? (queryOrOptions.search || queryOrOptions.query || '')
      : (typeof queryOrOptions === 'string' ? queryOrOptions : '');
    const page = isOptions ? queryOrOptions.page : undefined;
    const limit = isOptions ? queryOrOptions.limit : undefined;
    const branchId = isOptions ? queryOrOptions.branchId : undefined;

    const params = {
      branchId: branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
    };

    if (page) params.page = page;
    if (limit) params.limit = limit;
    else if (!page) params.limit = 100;

    if (search && String(search).trim()) {
      params.search = String(search).trim();
    }

    const res = await apiClient.get('/customers', { params });
    const rawList = Array.isArray(res) ? res : (res?.items || []);
    let list = rawList.map((c) => this.normalizeCustomer(c));

    const total = Number(res?.pagination?.total ?? list.length);
    const pageNum = Number(res?.pagination?.page ?? page ?? 1);
    const limitNum = Number(res?.pagination?.limit ?? limit ?? list.length ?? 20);
    const totalPages = Number(res?.pagination?.totalPages ?? res?.pagination?.pages ?? Math.max(1, Math.ceil(total / (limitNum || 1))));

    list.pagination = res?.pagination || {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    };
    list.items = list;

    return list;
  }

  async getCustomerById(id) {
    if (!id) return null;
    const res = await apiClient.get(`/customers/${id}`);
    return this.normalizeCustomer(res);
  }

  async createCustomer(customerData, actor = { id: 'cashier', name: 'Cashier' }) {
    const payload = {
      branchId: APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
      name: customerData.name?.trim() || '',
      phone: (customerData.mobile || customerData.phone || '').trim(),
      email: customerData.email?.trim() || undefined,
      address: customerData.address?.trim() || undefined,
      notes: customerData.notes?.trim() || undefined
    };

    const res = await apiClient.post('/customers', payload);
    return this.normalizeCustomer(res);
  }

  async recordVisitAndSpend(customerId, amount) {
    // In Django backend, billing_service.close_bill automatically
    // increments totalVisits and totalSpend. If called manually, fetch fresh customer.
    return await this.getCustomerById(customerId);
  }
}

export const customerApiRepository = new CustomerApiRepository();
