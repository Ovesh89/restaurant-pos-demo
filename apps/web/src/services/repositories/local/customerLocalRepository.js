import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class CustomerLocalRepository {
  async getCustomers(queryOrOptions = '') {
    const isOptions = queryOrOptions && typeof queryOrOptions === 'object';
    const query = isOptions
      ? (queryOrOptions.search || queryOrOptions.query || '')
      : (typeof queryOrOptions === 'string' ? queryOrOptions : '');
    const page = isOptions ? queryOrOptions.page : undefined;
    const limit = isOptions ? queryOrOptions.limit : undefined;

    const customers = storageAdapter.getItem(STORAGE_KEYS.CUSTOMERS) || [];
    let list = [...customers];
    if (query && String(query).trim()) {
      const q = String(query).toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.mobile?.includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));

    const total = list.length;
    let paginated = list;
    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);
      const totalPages = Math.max(1, Math.ceil(total / limitNum));
      paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      paginated.pagination = {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      };
    } else {
      paginated.pagination = {
        total,
        page: 1,
        limit: total || 20,
        totalPages: 1,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      };
    }
    paginated.items = paginated;
    return paginated;
  }

  async getCustomerById(id) {
    const customers = await this.getCustomers();
    return customers.find((c) => c.id === id) || null;
  }

  async createCustomer(customerData, actor = { id: 'cashier', name: 'Cashier' }) {
    const customers = storageAdapter.getItem(STORAGE_KEYS.CUSTOMERS) || [];

    // Check unique phone if present
    if (customerData.mobile) {
      const exists = customers.find((c) => c.mobile === customerData.mobile.trim());
      if (exists) {
        return exists; // return existing customer
      }
    }

    const newCustomer = {
      id: `cust-${Date.now()}`,
      name: customerData.name.trim(),
      mobile: customerData.mobile?.trim() || '',
      email: customerData.email?.trim() || '',
      address: customerData.address?.trim() || '',
      notes: customerData.notes?.trim() || '',
      visitCount: 0,
      totalSpend: 0,
      lastVisitAt: null,
      createdAt: new Date().toISOString()
    };

    customers.unshift(newCustomer);
    storageAdapter.setItem(STORAGE_KEYS.CUSTOMERS, customers);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: newCustomer.id,
      details: `Registered customer ${newCustomer.name} (${newCustomer.mobile}).`
    });

    return newCustomer;
  }

  async recordVisitAndSpend(customerId, amount) {
    const customers = storageAdapter.getItem(STORAGE_KEYS.CUSTOMERS) || [];
    const index = customers.findIndex((c) => c.id === customerId);
    if (index === -1) return null;

    const cust = customers[index];
    cust.visitCount = (cust.visitCount || 0) + 1;
    cust.totalSpend = (cust.totalSpend || 0) + (Number(amount) || 0);
    cust.lastVisitAt = new Date().toISOString();

    customers[index] = cust;
    storageAdapter.setItem(STORAGE_KEYS.CUSTOMERS, customers);
    return cust;
  }
}

export const customerLocalRepository = new CustomerLocalRepository();
