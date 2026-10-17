import {
  ConflictAppError,
  NotFoundAppError,
  ValidationAppError,
} from '../../middleware/errorHandler.js';
import { ensureBranchAccess } from '../../middleware/permissions.js';
import { auditService } from '../audit/service.js';
import {
  areaRepository,
  branchRepository,
  tableRepository,
} from './repositories.js';

export const VALID_TABLE_STATUSES = [
  'AVAILABLE',
  'OCCUPIED',
  'ORDER_IN_PROGRESS',
  'KOT_SENT',
  'PREPARING',
  'READY',
  'SERVED',
  'BILL_PENDING',
];

export class RestaurantService {
  constructor() {
    this.branchRepo = branchRepository;
    this.areaRepo = areaRepository;
    this.tableRepo = tableRepository;
  }

  // --- Branches ---

  async listBranches(user) {
    const roleCodes = user.roleCodes || [];
    if (roleCodes.includes('OWNER') || roleCodes.includes('ADMIN')) {
      return this.branchRepo.findMany({}, { sort: [['name', 1]] });
    }
    const branchIds = user.branchIds || [];
    return this.branchRepo.findMany(
      { _id: { $in: branchIds } },
      { sort: [['name', 1]] }
    );
  }

  async getBranch(branchId, user) {
    const branch = await this.branchRepo.findById(branchId);
    if (!branch) {
      throw new NotFoundAppError(`Branch '${branchId}' not found.`);
    }
    ensureBranchAccess(user, branch.id);
    return branch;
  }

  async createBranch(data, actor) {
    const code = String(data.code || '').trim().toUpperCase();
    const name = String(data.name || '').trim();
    if (!code || !name) {
      throw new ValidationAppError('Branch code and name are required.');
    }

    const existing = await this.branchRepo.findByCode(code);
    if (existing) {
      throw new ConflictAppError(`Branch with code '${code}' already exists.`);
    }

    const doc = {
      code,
      name,
      address: data.address || '',
      phone: data.phone || '',
      gstin: data.gstin || '',
      timezone: data.timezone || 'Asia/Kolkata',
      currency: data.currency || 'INR',
      taxConfig: data.taxConfig || {
        rate: '5.00',
        gstin: data.gstin || '',
        mode: 'EXCLUSIVE',
      },
      invoiceConfig: data.invoiceConfig || {
        prefix: 'INV-',
        terms: 'Thank you for dining with us.',
      },
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };

    const created = await this.branchRepo.insertOne(doc, 'branch');

    await auditService.logAction({
      branchId: created.id,
      action: 'BRANCH_CREATED',
      entityType: 'branch',
      entityId: created.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: created,
    });

    return created;
  }

  async updateBranch(branchId, data, actor) {
    const beforeDoc = await this.branchRepo.findById(branchId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Branch '${branchId}' not found.`);
    }
    ensureBranchAccess(actor, beforeDoc.id);

    const updateFields = {};
    if (data.name !== undefined) updateFields.name = String(data.name).trim();
    if (data.address !== undefined) updateFields.address = data.address;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.gstin !== undefined) updateFields.gstin = data.gstin;
    if (data.timezone !== undefined) updateFields.timezone = data.timezone;
    if (data.currency !== undefined) updateFields.currency = data.currency;
    if (data.taxConfig !== undefined) updateFields.taxConfig = data.taxConfig;
    if (data.invoiceConfig !== undefined) updateFields.invoiceConfig = data.invoiceConfig;
    if (data.isActive !== undefined) updateFields.isActive = Boolean(data.isActive);

    const updated = await this.branchRepo.updateById(beforeDoc.id, updateFields);

    await auditService.logAction({
      branchId: beforeDoc.id,
      action: 'BRANCH_UPDATED',
      entityType: 'branch',
      entityId: beforeDoc.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
      after: updated,
    });

    return updated;
  }

  // --- Areas ---

  async listAreas(branchId, user, isActiveOnly = false) {
    ensureBranchAccess(user, branchId);
    return this.areaRepo.findByBranch(branchId, isActiveOnly);
  }

  async createArea(data, actor) {
    const branchId = data.branchId || (actor.branchIds || [])[0] || 'branch-main';
    ensureBranchAccess(actor, branchId);

    const branch = await this.branchRepo.findById(branchId);
    if (!branch) {
      throw new NotFoundAppError(`Branch '${branchId}' not found.`);
    }

    const name = String(data.name || '').trim();
    if (!name) {
      throw new ValidationAppError('Area name is required.');
    }

    const doc = {
      branchId,
      name,
      sortOrder: Number(data.sortOrder ?? 0),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };

    const created = await this.areaRepo.insertOne(doc, 'area');

    await auditService.logAction({
      branchId,
      action: 'AREA_CREATED',
      entityType: 'area',
      entityId: created.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: created,
    });

    return created;
  }

  async updateArea(areaId, data, actor) {
    const beforeDoc = await this.areaRepo.findById(areaId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Area '${areaId}' not found.`);
    }
    ensureBranchAccess(actor, beforeDoc.branchId);

    const updateFields = {};
    if (data.name !== undefined) updateFields.name = String(data.name).trim();
    if (data.sortOrder !== undefined) updateFields.sortOrder = Number(data.sortOrder);
    if (data.isActive !== undefined) updateFields.isActive = Boolean(data.isActive);

    const updated = await this.areaRepo.updateById(areaId, updateFields);

    await auditService.logAction({
      branchId: beforeDoc.branchId,
      action: 'AREA_UPDATED',
      entityType: 'area',
      entityId: areaId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
      after: updated,
    });

    return updated;
  }

  // --- Tables ---

  async listTables(branchId, user, { areaId = null, status = null, isActive = null } = {}) {
    ensureBranchAccess(user, branchId);
    return this.tableRepo.findByBranch(branchId, { areaId, status, isActive });
  }

  async getTable(tableId, user) {
    const table = await this.tableRepo.findById(tableId);
    if (!table) {
      throw new NotFoundAppError(`Table '${tableId}' not found.`);
    }
    ensureBranchAccess(user, table.branchId);
    return table;
  }

  async createTable(data, actor) {
    const branchId = data.branchId || (actor.branchIds || [])[0] || 'branch-main';
    ensureBranchAccess(actor, branchId);

    const areaId = data.areaId;
    if (!areaId) {
      throw new ValidationAppError('areaId is required.');
    }

    const area = await this.areaRepo.findById(areaId);
    if (!area || area.branchId !== branchId) {
      throw new ValidationAppError(
        `Area '${areaId}' does not exist in branch '${branchId}'.`
      );
    }

    const tableNum = String(data.tableNumber || '').trim();
    if (!tableNum) {
      throw new ValidationAppError('tableNumber is required.');
    }

    const capacity = Number(data.capacity);
    if (Number.isNaN(capacity) || capacity < 1) {
      throw new ValidationAppError('capacity must be a positive integer.');
    }

    const existing = await this.tableRepo.findByBranchAndNumber(branchId, tableNum);
    if (existing) {
      throw new ConflictAppError(
        `Table number '${tableNum}' already exists in branch '${branchId}'.`
      );
    }

    const status = data.status || 'AVAILABLE';
    if (!VALID_TABLE_STATUSES.includes(status)) {
      throw new ValidationAppError(`Invalid table status '${status}'.`);
    }

    const doc = {
      branchId,
      areaId,
      tableNumber: tableNum,
      capacity,
      status,
      activeOrderId: null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };

    const created = await this.tableRepo.insertOne(doc, 'tbl');

    await auditService.logAction({
      branchId,
      action: 'TABLE_CREATED',
      entityType: 'table',
      entityId: created.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: created,
    });

    return created;
  }

  async updateTable(tableId, data, actor) {
    const beforeDoc = await this.tableRepo.findById(tableId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Table '${tableId}' not found.`);
    }
    const branchId = beforeDoc.branchId;
    ensureBranchAccess(actor, branchId);

    const updateFields = {};
    if (data.areaId !== undefined) {
      const area = await this.areaRepo.findById(data.areaId);
      if (!area || area.branchId !== branchId) {
        throw new ValidationAppError(
          `Area '${data.areaId}' does not exist in branch '${branchId}'.`
        );
      }
      updateFields.areaId = data.areaId;
    }

    if (data.tableNumber !== undefined) {
      const newNum = String(data.tableNumber).trim();
      if (newNum !== beforeDoc.tableNumber) {
        const existing = await this.tableRepo.findByBranchAndNumber(branchId, newNum);
        if (existing && existing.id !== beforeDoc.id) {
          throw new ConflictAppError(
            `Table number '${newNum}' already exists in branch '${branchId}'.`
          );
        }
        updateFields.tableNumber = newNum;
      }
    }

    if (data.capacity !== undefined) {
      const cap = Number(data.capacity);
      if (Number.isNaN(cap) || cap < 1) {
        throw new ValidationAppError('capacity must be a positive integer.');
      }
      updateFields.capacity = cap;
    }

    if (data.status !== undefined) {
      if (!VALID_TABLE_STATUSES.includes(data.status)) {
        throw new ValidationAppError(`Invalid table status '${data.status}'.`);
      }
      updateFields.status = data.status;
    }

    if (data.isActive !== undefined) {
      updateFields.isActive = Boolean(data.isActive);
    }

    if ('activeOrderId' in data) {
      updateFields.activeOrderId = data.activeOrderId;
    }

    const updated = await this.tableRepo.updateById(beforeDoc.id, updateFields);

    await auditService.logAction({
      branchId,
      action: 'TABLE_UPDATED',
      entityType: 'table',
      entityId: beforeDoc.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
      after: updated,
    });

    return updated;
  }
}

export const restaurantService = new RestaurantService();
