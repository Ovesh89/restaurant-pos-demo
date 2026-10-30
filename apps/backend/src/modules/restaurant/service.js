import {
  ConflictAppError,
  NotFoundAppError,
  ValidationAppError,
} from '../../middleware/errorHandler.js';
import { ensureBranchAccess } from '../../middleware/permissions.js';
import { auditService } from '../audit/service.js';
import { orderRepository, orderEventRepository } from '../orders/repositories.js';
import { kotRepository } from '../kot/repository.js';
import { billRepository } from '../billing/repositories.js';
import { utcNowIso } from '../../repositories/BaseMongoRepository.js';
import {
  areaRepository,
  branchRepository,
  tableRepository,
  kitchenStationRepository,
} from './repositories.js';

export const VALID_TABLE_STATUSES = [
  'AVAILABLE',
  'OCCUPIED',
  'ORDER_IN_PROGRESS',
  'WAITING_CONFIRMATION',
  'CONFIRMED',
  'KOT_SENT',
  'PREPARING',
  'READY',
  'SERVED',
  'BILL_PENDING',
  'BILLING',
  'PAID',
];

export class RestaurantService {
  constructor() {
    this.branchRepo = branchRepository;
    this.areaRepo = areaRepository;
    this.tableRepo = tableRepository;
    this.stationRepo = kitchenStationRepository;
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
      restaurantName: data.restaurantName || name,
      tagline: data.tagline !== undefined ? data.tagline : 'Garden Restaurant',
      logo: data.logo || null,
      logoWhite: data.logoWhite || null,
      logoBlack: data.logoBlack || null,
      logoReceipt: data.logoReceipt || null,
      logoRedReceipt: data.logoRedReceipt || null,
      favicon: data.favicon || null,
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      gstin: data.gstin || '',
      fssai: data.fssai || '',
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
      requireOrderApproval: data.requireOrderApproval !== undefined ? Boolean(data.requireOrderApproval) : true,
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
    if (data.restaurantName !== undefined) updateFields.restaurantName = String(data.restaurantName).trim();
    if (data.tagline !== undefined) updateFields.tagline = data.tagline;
    if (data.logo !== undefined) updateFields.logo = data.logo;
    if (data.logoWhite !== undefined) updateFields.logoWhite = data.logoWhite;
    if (data.logoBlack !== undefined) updateFields.logoBlack = data.logoBlack;
    if (data.logoReceipt !== undefined) updateFields.logoReceipt = data.logoReceipt;
    if (data.logoRedReceipt !== undefined) updateFields.logoRedReceipt = data.logoRedReceipt;
    if (data.favicon !== undefined) updateFields.favicon = data.favicon;
    if (data.address !== undefined) updateFields.address = data.address;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.email !== undefined) updateFields.email = data.email;
    if (data.gstin !== undefined) updateFields.gstin = data.gstin;
    if (data.fssai !== undefined) updateFields.fssai = data.fssai;
    if (data.timezone !== undefined) updateFields.timezone = data.timezone;
    if (data.currency !== undefined) updateFields.currency = data.currency;
    if (data.taxConfig !== undefined) updateFields.taxConfig = data.taxConfig;
    if (data.invoiceConfig !== undefined) updateFields.invoiceConfig = data.invoiceConfig;
    if (data.requireOrderApproval !== undefined) updateFields.requireOrderApproval = Boolean(data.requireOrderApproval);
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

  async deleteArea(areaId, actor) {
    const beforeDoc = await this.areaRepo.findById(areaId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Area '${areaId}' not found.`);
    }
    ensureBranchAccess(actor, beforeDoc.branchId);

    const tablesInArea = await this.tableRepo.findByBranch(beforeDoc.branchId, { areaId });
    if (tablesInArea && tablesInArea.length > 0) {
      throw new ValidationAppError(
        `Cannot delete Dining Area '${beforeDoc.name}' because ${tablesInArea.length} table(s) are assigned to it. Please reassign or delete the tables first.`
      );
    }

    await this.areaRepo.deleteById(areaId);

    await auditService.logAction({
      branchId: beforeDoc.branchId,
      action: 'AREA_DELETED',
      entityType: 'area',
      entityId: areaId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
    });

    return { success: true, message: `Dining Area '${beforeDoc.name}' deleted successfully.` };
  }

  // --- Kitchen Stations ---

  async listKitchenStations(branchId, user, isActiveOnly = false) {
    ensureBranchAccess(user, branchId);
    let stations = await this.stationRepo.findByBranch(branchId, isActiveOnly);

    // Auto-seed default stations if none exist for this branch
    if (stations.length === 0 && !isActiveOnly) {
      const defaultStations = [
        { name: 'Main Kitchen', code: 'MAIN', sortOrder: 1 },
        { name: 'Tandoor Station', code: 'TANDOOR', sortOrder: 2 },
        { name: 'Main Curry Station', code: 'CURRY', sortOrder: 3 },
        { name: 'Bar & Beverages', code: 'BAR', sortOrder: 4 },
        { name: 'Breads & Bakery', code: 'BAKERY', sortOrder: 5 },
        { name: 'Dessert Station', code: 'DESSERT', sortOrder: 6 },
      ];
      for (const def of defaultStations) {
        await this.stationRepo.insertOne(
          {
            branchId,
            name: def.name,
            code: def.code,
            description: '',
            sortOrder: def.sortOrder,
            isActive: true,
          },
          'station'
        );
      }
      stations = await this.stationRepo.findByBranch(branchId, isActiveOnly);
    }

    return stations;
  }

  async getKitchenStation(stationId, user) {
    const station = await this.stationRepo.findById(stationId);
    if (!station) {
      throw new NotFoundAppError(`Kitchen Station '${stationId}' not found.`);
    }
    ensureBranchAccess(user, station.branchId);
    return station;
  }

  async createKitchenStation(data, actor) {
    const branchId = data.branchId || (actor.branchIds || [])[0] || 'branch-main';
    ensureBranchAccess(actor, branchId);

    const name = String(data.name || '').trim();
    if (!name) {
      throw new ValidationAppError('Kitchen Station name is required.');
    }

    const code = data.code ? String(data.code).trim().toUpperCase() : name.toUpperCase().slice(0, 10);
    const existing = await this.stationRepo.findByName(branchId, name);
    if (existing) {
      throw new ConflictAppError(`Kitchen Station '${name}' already exists in this branch.`);
    }

    const doc = {
      branchId,
      name,
      code,
      description: data.description || '',
      sortOrder: Number(data.sortOrder ?? 0),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };

    const created = await this.stationRepo.insertOne(doc, 'station');

    await auditService.logAction({
      branchId,
      action: 'KITCHEN_STATION_CREATED',
      entityType: 'kitchen_station',
      entityId: created.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: created,
    });

    return created;
  }

  async updateKitchenStation(stationId, data, actor) {
    const beforeDoc = await this.stationRepo.findById(stationId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Kitchen Station '${stationId}' not found.`);
    }
    ensureBranchAccess(actor, beforeDoc.branchId);

    const updateFields = {};
    if (data.name !== undefined) {
      const trimmed = String(data.name).trim();
      if (!trimmed) throw new ValidationAppError('Kitchen Station name cannot be empty.');
      updateFields.name = trimmed;
    }
    if (data.code !== undefined) updateFields.code = String(data.code).trim().toUpperCase();
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.sortOrder !== undefined) updateFields.sortOrder = Number(data.sortOrder);
    if (data.isActive !== undefined) updateFields.isActive = Boolean(data.isActive);

    const updated = await this.stationRepo.updateById(stationId, updateFields);

    await auditService.logAction({
      branchId: beforeDoc.branchId,
      action: 'KITCHEN_STATION_UPDATED',
      entityType: 'kitchen_station',
      entityId: stationId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
      after: updated,
    });

    return updated;
  }

  async deleteKitchenStation(stationId, actor) {
    const beforeDoc = await this.stationRepo.findById(stationId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Kitchen Station '${stationId}' not found.`);
    }
    ensureBranchAccess(actor, beforeDoc.branchId);

    await this.stationRepo.deleteById(stationId);

    await auditService.logAction({
      branchId: beforeDoc.branchId,
      action: 'KITCHEN_STATION_DELETED',
      entityType: 'kitchen_station',
      entityId: stationId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
    });

    return { success: true, message: `Kitchen Station '${beforeDoc.name}' deleted successfully.` };
  }


  // --- Tables ---

  async listTables(branchId, user, { areaId = null, status = null, isActive = null } = {}) {
    ensureBranchAccess(user, branchId);
    const tables = await this.tableRepo.findByBranch(branchId, { areaId, status, isActive });

    try {
      const activeOrders = await orderRepository.findMany({
        branchId,
        status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      });
      if (activeOrders && activeOrders.length > 0) {
        const orderMap = new Map();
        for (const ord of activeOrders) {
          if (ord.tableId) orderMap.set(String(ord.tableId), ord);
          if (ord.tableNumber) {
            orderMap.set(String(ord.tableNumber), ord);
            const cleanNo = String(ord.tableNumber).replace(/^T-?/i, '');
            orderMap.set(cleanNo, ord);
            orderMap.set(`T-${cleanNo}`, ord);
          }
        }
        for (const tbl of tables) {
          const cleanNo = String(tbl.tableNumber || '').replace(/^T-?/i, '');
          const ord =
            orderMap.get(String(tbl.id)) ||
            orderMap.get(String(tbl._id)) ||
            orderMap.get(String(tbl.tableNumber)) ||
            orderMap.get(cleanNo) ||
            orderMap.get(`T-${cleanNo}`);

          if (ord) {
            tbl.activeOrderId = ord.id || ord._id;
            if (!tbl.status || tbl.status === 'AVAILABLE') {
              if (['DRAFT', 'HOLD', 'WAITING_CONFIRMATION'].includes(ord.status)) {
                tbl.status = 'OCCUPIED';
              } else if (['CONFIRMED', 'KOT_SENT'].includes(ord.status)) {
                tbl.status = 'KOT_SENT';
              } else if (ord.status === 'PREPARING') {
                tbl.status = 'PREPARING';
              } else if (ord.status === 'READY') {
                tbl.status = 'READY';
              } else if (ord.status === 'SERVED') {
                tbl.status = 'SERVED';
              } else if (['BILLING', 'BILL_PENDING', 'PAYMENT_PENDING'].includes(ord.status)) {
                tbl.status = 'BILL_PENDING';
              } else {
                tbl.status = 'OCCUPIED';
              }
            }
          }
        }
      }
    } catch {
      // Return raw tables if active orders lookup encounters issues
    }

    return tables;
  }

  async getTable(tableId, user) {
    const table = await this.tableRepo.findById(tableId);
    if (!table) {
      throw new NotFoundAppError(`Table '${tableId}' not found.`);
    }
    ensureBranchAccess(user, table.branchId);

    try {
      const activeOrder = await orderRepository.findActiveByTable(table.branchId, table._id || table.id);
      if (activeOrder) {
        table.activeOrderId = activeOrder.id || activeOrder._id;
        if (!table.status || table.status === 'AVAILABLE') {
          if (['DRAFT', 'HOLD', 'WAITING_CONFIRMATION'].includes(activeOrder.status)) {
            table.status = 'OCCUPIED';
          } else if (['CONFIRMED', 'KOT_SENT'].includes(activeOrder.status)) {
            table.status = 'KOT_SENT';
          } else if (activeOrder.status === 'PREPARING') {
            table.status = 'PREPARING';
          } else if (activeOrder.status === 'READY') {
            table.status = 'READY';
          } else if (activeOrder.status === 'SERVED') {
            table.status = 'SERVED';
          } else if (['BILLING', 'BILL_PENDING', 'PAYMENT_PENDING'].includes(activeOrder.status)) {
            table.status = 'BILL_PENDING';
          } else {
            table.status = 'OCCUPIED';
          }
        }
      }
    } catch {
      // Return raw table if active order lookup encounters issues
    }

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

  async transferTable({ fromTableId, toTableId, reason = '' }, user) {
    if (!fromTableId || !toTableId) {
      throw new ValidationAppError('Both source and destination tables are required.');
    }
    if (String(fromTableId).trim() === String(toTableId).trim()) {
      throw new ValidationAppError('Destination table cannot be the same as source table.');
    }

    // Resolve source table by id or number
    let fromTable = await this.tableRepo.findById(fromTableId);
    if (!fromTable && user?.branchIds?.[0]) {
      fromTable = await this.tableRepo.findByBranchAndNumber(user.branchIds[0], fromTableId);
    }
    if (!fromTable) {
      throw new NotFoundAppError(`Source table '${fromTableId}' not found.`);
    }

    const branchId = fromTable.branchId;
    ensureBranchAccess(user, branchId);

    // Resolve destination table by id or number
    let toTable = await this.tableRepo.findById(toTableId);
    if (!toTable) {
      toTable = await this.tableRepo.findByBranchAndNumber(branchId, toTableId);
    }
    if (!toTable) {
      throw new NotFoundAppError(`Destination table '${toTableId}' not found.`);
    }

    if (toTable.branchId !== branchId) {
      throw new ValidationAppError('Destination table must belong to the same branch.');
    }

    if (String(fromTable.id || fromTable._id) === String(toTable.id || toTable._id)) {
      throw new ValidationAppError('Destination table cannot be the same as source table.');
    }

    if (toTable.isActive === false) {
      throw new ValidationAppError(`Destination Table ${toTable.tableNumber} is deactivated.`);
    }

    // Check if destination table is occupied
    const activeDestOrder = await orderRepository.findActiveByTable(branchId, toTable._id || toTable.id);
    if (activeDestOrder || (toTable.status && toTable.status !== 'AVAILABLE')) {
      throw new ConflictAppError(
        `Destination Table ${toTable.tableNumber} is currently occupied (${toTable.status || 'Active Order'}).`
      );
    }

    // Find active order on source table
    let activeOrder = await orderRepository.findActiveByTable(branchId, fromTable._id || fromTable.id);
    if (!activeOrder && fromTable.activeOrderId) {
      activeOrder = await orderRepository.findById(fromTable.activeOrderId);
      if (
        activeOrder &&
        ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(activeOrder.status)
      ) {
        activeOrder = null;
      }
    }
    if (!activeOrder) {
      activeOrder = await orderRepository.findOne({
        branchId,
        tableNumber: fromTable.tableNumber,
        status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      });
    }

    if (!activeOrder) {
      throw new NotFoundAppError(`No active order found on Table ${fromTable.tableNumber} to transfer.`);
    }

    const now = utcNowIso();
    const orderId = activeOrder.id || activeOrder._id;
    const fromTableNum = fromTable.tableNumber;
    const toTableNum = toTable.tableNumber;

    // 1. Shift the order to the new table without changing order items or totals
    const cleanReason = String(reason || '').trim();
    const transferNote = `[Transferred from Table ${fromTableNum} to Table ${toTableNum}${cleanReason ? ': ' + cleanReason : ''}]`;
    const newNotes = activeOrder.notes
      ? `${activeOrder.notes} ${transferNote}`
      : transferNote;

    await orderRepository.updateById(orderId, {
      tableId: toTable._id || toTable.id,
      tableNumber: toTableNum,
      notes: newNotes,
      updatedAt: now,
    });

    // 2. Update active KOT tickets so kitchen display & printing reflect the new table
    try {
      const orderKots = await kotRepository.findByOrder(orderId);
      if (Array.isArray(orderKots)) {
        for (const kot of orderKots) {
          await kotRepository.updateById(kot.id || kot._id, {
            tableId: toTable._id || toTable.id,
            tableNumber: toTableNum,
            updatedAt: now,
          });
        }
      }
    } catch (e) {
      console.warn('Warning: Failed to update KOT table numbers during table transfer:', e);
    }

    // 3. Update any active bills for this order
    try {
      const orderBills = await billRepository.findByOrder(orderId);
      if (Array.isArray(orderBills)) {
        for (const bill of orderBills) {
          await billRepository.updateById(bill.id || bill._id, {
            tableId: toTable._id || toTable.id,
            tableNumber: toTableNum,
            updatedAt: now,
          });
        }
      }
    } catch (e) {
      console.warn('Warning: Failed to update Bill table numbers during table transfer:', e);
    }

    // 4. Determine destination table operational status
    let destStatus = fromTable.status;
    if (!destStatus || destStatus === 'AVAILABLE') {
      if (['DRAFT', 'HOLD', 'WAITING_CONFIRMATION'].includes(activeOrder.status)) {
        destStatus = 'OCCUPIED';
      } else if (['CONFIRMED', 'KOT_SENT'].includes(activeOrder.status)) {
        destStatus = 'KOT_SENT';
      } else if (activeOrder.status === 'PREPARING') {
        destStatus = 'PREPARING';
      } else if (activeOrder.status === 'READY') {
        destStatus = 'READY';
      } else if (activeOrder.status === 'SERVED') {
        destStatus = 'SERVED';
      } else if (['BILLING', 'BILL_PENDING', 'PAYMENT_PENDING'].includes(activeOrder.status)) {
        destStatus = 'BILL_PENDING';
      } else {
        destStatus = 'OCCUPIED';
      }
    }

    // 5. Release fromTable back to AVAILABLE
    await this.tableRepo.updateById(fromTable.id || fromTable._id, {
      status: 'AVAILABLE',
      activeOrderId: null,
      currentOrderId: null,
      updatedAt: now,
    });

    // 6. Occupy toTable with the transferred order
    await this.tableRepo.updateById(toTable.id || toTable._id, {
      status: destStatus,
      activeOrderId: orderId,
      currentOrderId: orderId,
      updatedAt: now,
    });

    // 7. Record Order Event
    await orderEventRepository.recordEvent({
      orderId,
      branchId,
      eventType: 'TABLE_TRANSFERRED',
      fromStatus: activeOrder.status,
      toStatus: activeOrder.status,
      actorId: user?.id || 'staff',
      reason: cleanReason,
      metadata: {
        fromTableId: fromTable._id || fromTable.id,
        fromTableNumber: fromTableNum,
        toTableId: toTable._id || toTable.id,
        toTableNumber: toTableNum,
        reason: cleanReason || null,
      },
    });

    // 8. Audit Log
    await auditService.logAction({
      branchId,
      action: 'TABLE_TRANSFERRED',
      entityType: 'table',
      entityId: fromTable.id || fromTable._id,
      actorUserId: user?.id || 'staff',
      actorName: user?.displayName || user?.name || user?.username || 'Staff',
      metadata: {
        fromTableNumber: fromTableNum,
        toTableId: toTable._id || toTable.id,
        toTableNumber: toTableNum,
        orderId,
        orderNumber: activeOrder.orderNumber,
        reason: cleanReason,
      },
    });

    // 9. Fetch updated representations
    const updatedOrder = await orderRepository.findById(orderId);
    const updatedFromTable = await this.tableRepo.findById(fromTable.id || fromTable._id);
    const updatedToTable = await this.tableRepo.findById(toTable.id || toTable._id);

    return {
      order: updatedOrder,
      fromTable: updatedFromTable,
      toTable: updatedToTable,
    };
  }
}

export const restaurantService = new RestaurantService();
