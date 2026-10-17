import crypto from 'node:crypto';
import { utcNowIso } from '../../repositories/BaseMongoRepository.js';
import { normalizePhoneNumber } from '../../utils/phone.js';
import {
  NotFoundAppError,
  ValidationAppError,
  StateConflictError,
} from '../../middleware/errorHandler.js';
import { orderRepository } from '../orders/repositories.js';
import { customerRepository } from './repository.js';

class CustomerService {
  async createCustomer(branchId, data = {}) {
    const name = String(data.name || '').trim();
    const rawMobile = String(data.mobile || data.phone || '').trim();

    if (!name) {
      throw new ValidationAppError('Customer name is required.');
    }
    if (!rawMobile) {
      throw new ValidationAppError('Customer mobile number is required.');
    }

    const cleanMobile = normalizePhoneNumber(rawMobile);
    const existing = await customerRepository.findByMobile(branchId, cleanMobile);
    if (existing) {
      throw new StateConflictError(
        `Customer with mobile '${cleanMobile}' already exists in this branch.`
      );
    }

    const now = utcNowIso();
    const customerDoc = {
      _id: crypto.randomUUID(),
      branchId,
      name,
      mobile: cleanMobile,
      phone: cleanMobile,
      email: data.email ? String(data.email).trim() : null,
      address: data.address ? String(data.address).trim() : null,
      notes: data.notes ? String(data.notes).trim() : null,
      visitCount: 0,
      totalVisits: 0,
      totalSpending: '0.00',
      totalSpend: '0.00',
      lastVisitAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return customerRepository.insertOne(customerDoc);
  }

  async getOrCreateCustomer(branchId, name, mobile) {
    const cleanMobile = normalizePhoneNumber(mobile);
    const existing = await customerRepository.findByMobile(branchId, cleanMobile);
    if (existing) {
      if (name && existing.name !== name) {
        return customerRepository.updateById(existing._id, { name });
      }
      return existing;
    }
    return this.createCustomer(branchId, { name, mobile: cleanMobile });
  }

  async getCustomer(customerId) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundAppError('Customer not found.');
    }
    return customer;
  }

  async updateCustomer(customerId, data = {}) {
    const customer = await this.getCustomer(customerId);
    const updateFields = {};

    if ('name' in data) {
      const name = String(data.name || '').trim();
      if (!name) {
        throw new ValidationAppError('Name cannot be empty.');
      }
      updateFields.name = name;
    }

    if ('mobile' in data || 'phone' in data) {
      const rawPhone = data.mobile ?? data.phone;
      const cleanMobile = normalizePhoneNumber(String(rawPhone || ''));
      if (cleanMobile !== customer.mobile && cleanMobile !== customer.phone) {
        const existing = await customerRepository.findByMobile(
          customer.branchId,
          cleanMobile
        );
        if (existing && existing._id !== customerId) {
          throw new StateConflictError(
            `Mobile '${cleanMobile}' is already registered to another customer.`
          );
        }
        updateFields.mobile = cleanMobile;
        updateFields.phone = cleanMobile;
      }
    }

    if ('email' in data) {
      updateFields.email = data.email ? String(data.email).trim() : null;
    }
    if ('address' in data) {
      updateFields.address = data.address ? String(data.address).trim() : null;
    }
    if ('notes' in data) {
      updateFields.notes = data.notes ? String(data.notes).trim() : null;
    }

    if (Object.keys(updateFields).length > 0) {
      return customerRepository.updateById(customerId, updateFields);
    }
    return customer;
  }

  async searchCustomers({ branchId, query = null, page = 1, limit = 20 }) {
    return customerRepository.searchCustomers({
      branchId,
      query,
      page,
      limit,
    });
  }

  async getCustomerOrders(customerId, limit = 20) {
    await this.getCustomer(customerId);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    return orderRepository.findMany(
      { customerId },
      { sort: { createdAt: -1 }, limit: safeLimit }
    );
  }
}

export const customerService = new CustomerService();
