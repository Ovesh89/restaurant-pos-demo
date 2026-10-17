import crypto from 'node:crypto';
import { utcNowIso } from '../../repositories/BaseMongoRepository.js';
import { getNextSequence } from '../../utils/sequence.js';
import {
  NotFoundAppError,
  ValidationAppError,
  StateConflictError,
} from '../../middleware/errorHandler.js';
import { branchRepository, tableRepository } from '../restaurant/repositories.js';
import { orderRepository, orderEventRepository } from '../orders/repositories.js';
import { notificationService } from '../notifications/service.js';
import { auditService } from '../audit/service.js';
import { kotRepository } from './repository.js';

class KOTService {
  async createInitialKot({ order, actorId, actorName, branchCode = null }) {
    let resolvedBranchCode = branchCode;
    if (!resolvedBranchCode) {
      const branch = await branchRepository.findById(order.branchId);
      resolvedBranchCode = branch?.code || 'MAIN';
    }

    const kotNumber = await getNextSequence('kot', 'KOT', resolvedBranchCode);
    const now = utcNowIso();

    const kotItems = (order.items || [])
      .filter((it) => (it.status || 'ACTIVE') === 'ACTIVE')
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: Number(it.quantity) || 1,
        note: it.note || '',
        station: it.station || 'MAIN',
        changeType: 'ADD',
      }));

    const orderId = order._id || order.id;
    const kotDoc = {
      _id: crypto.randomUUID(),
      kotNumber,
      orderId,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      tableId: order.tableId,
      tableNumber: order.tableNumber || '',
      captainId: order.captainId,
      captainName: order.captainName || '',
      revision: 1,
      type: 'NEW',
      status: 'NEW',
      kitchenStation: 'MAIN',
      items: kotItems,
      notes: '',
      printStatus: 'PENDING',
      printedAt: null,
      preparingAt: null,
      readyAt: null,
      servedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const serializedKot = await kotRepository.insertOne(kotDoc);

    await notificationService.notify({
      branchId: order.branchId,
      eventType: 'KOT_CREATED',
      title: `New KOT: Table ${order.tableNumber || ''}`,
      message: `Order ${order.orderNumber} sent to kitchen (${kotItems.length} items).`,
      recipientRole: 'KITCHEN',
      metadata: {
        kotId: serializedKot.id,
        orderId,
        kotNumber,
      },
    });

    return serializedKot;
  }

  async createModificationKot({
    order,
    deltaItems,
    reason,
    actorId,
    actorName,
    branchCode = null,
  }) {
    if (!Array.isArray(deltaItems) || deltaItems.length === 0) {
      throw new ValidationAppError('Delta items cannot be empty for modification KOT.');
    }

    let resolvedBranchCode = branchCode;
    if (!resolvedBranchCode) {
      const branch = await branchRepository.findById(order.branchId);
      resolvedBranchCode = branch?.code || 'MAIN';
    }

    const orderId = order._id || order.id;
    const nextRev = await kotRepository.getNextRevision(orderId);
    const kotNumber = await getNextSequence('kot', 'KOT', resolvedBranchCode);
    const now = utcNowIso();

    const kotDoc = {
      _id: crypto.randomUUID(),
      kotNumber,
      orderId,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      tableId: order.tableId,
      tableNumber: order.tableNumber || '',
      captainId: order.captainId,
      captainName: order.captainName || '',
      revision: nextRev,
      type: 'MODIFICATION',
      status: 'NEW',
      kitchenStation: 'MAIN',
      items: deltaItems,
      notes: reason || 'Additional items ordered',
      printStatus: 'PENDING',
      printedAt: null,
      preparingAt: null,
      readyAt: null,
      servedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const serializedKot = await kotRepository.insertOne(kotDoc);

    await notificationService.notify({
      branchId: order.branchId,
      eventType: 'KOT_MODIFIED',
      title: `KOT Revision #${nextRev}: Table ${order.tableNumber || ''}`,
      message: `Order ${order.orderNumber} modified. Reason: ${reason || 'Additional items ordered'}`,
      recipientRole: 'KITCHEN',
      metadata: {
        kotId: serializedKot.id,
        orderId,
        revision: nextRev,
      },
    });

    return serializedKot;
  }

  async createCancellationKot({
    order,
    cancelledItems = null,
    reason,
    actorId,
    actorName,
    branchCode = null,
  }) {
    let resolvedBranchCode = branchCode;
    if (!resolvedBranchCode) {
      const branch = await branchRepository.findById(order.branchId);
      resolvedBranchCode = branch?.code || 'MAIN';
    }

    const orderId = order._id || order.id;
    const nextRev = await kotRepository.getNextRevision(orderId);
    const kotNumber = await getNextSequence('kot', 'KOT', resolvedBranchCode);
    const now = utcNowIso();

    const sourceItems = Array.isArray(cancelledItems)
      ? cancelledItems
      : (order.items || []).filter((it) => (it.status || 'ACTIVE') === 'ACTIVE');

    const cancelItems = sourceItems.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: Number(it.quantity) || 1,
      note: it.note || '',
      station: it.station || 'MAIN',
      changeType: 'REMOVE',
    }));

    const kotDoc = {
      _id: crypto.randomUUID(),
      kotNumber,
      orderId,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      tableId: order.tableId,
      tableNumber: order.tableNumber || '',
      captainId: order.captainId,
      captainName: order.captainName || '',
      revision: nextRev,
      type: 'CANCELLATION',
      status: 'CANCELLED',
      kitchenStation: 'MAIN',
      items: cancelItems,
      notes: `CANCELLED: ${reason}`,
      printStatus: 'PENDING',
      printedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const serializedKot = await kotRepository.insertOne(kotDoc);

    await notificationService.notify({
      branchId: order.branchId,
      eventType: 'ORDER_CANCELLED',
      title: `KOT CANCELLED: Table ${order.tableNumber || ''}`,
      message: `Order ${order.orderNumber} cancelled by ${actorName}. Reason: ${reason}`,
      recipientRole: 'KITCHEN',
      metadata: {
        kotId: serializedKot.id,
        orderId,
      },
    });

    return serializedKot;
  }

  async getPrintPayload(kotId) {
    const kot = await kotRepository.findById(kotId);
    if (!kot) {
      throw new NotFoundAppError('KOT not found.');
    }

    const branch = (await branchRepository.findById(kot.branchId)) || {};

    return {
      kotId: kot._id,
      restaurant: {
        branchCode: branch.code || 'MAIN',
        branchName: branch.name || 'Restaurant POS',
        phone: branch.phone || '',
      },
      kotNumber: kot.kotNumber,
      orderId: kot.orderId,
      orderNumber: kot.orderNumber,
      tableNumber: kot.tableNumber || '',
      captainName: kot.captainName || '',
      type: kot.type,
      revision: kot.revision,
      status: kot.status,
      kitchenStation: kot.kitchenStation || 'MAIN',
      timestamp: kot.createdAt,
      createdAt: kot.createdAt,
      printStatus: kot.printStatus || 'PENDING',
      printedAt: kot.printedAt || null,
      items: (kot.items || []).map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        note: it.note || '',
        notes: it.note || '',
        changeType: it.changeType || 'ADD',
      })),
      notes: kot.notes || '',
    };
  }

  async updatePrintStatus(kotId, printStatus) {
    const normalized = String(printStatus || '').toUpperCase();
    if (!['PENDING', 'PRINTED', 'FAILED'].includes(normalized)) {
      throw new ValidationAppError('Invalid printStatus. Must be PENDING, PRINTED, or FAILED.');
    }

    const updateFields = { printStatus: normalized };
    if (normalized === 'PRINTED') {
      updateFields.printedAt = utcNowIso();
    }

    const updated = await kotRepository.updateById(kotId, updateFields);
    if (!updated) {
      throw new NotFoundAppError('KOT not found.');
    }
    return updated;
  }

  async getKot(kotId) {
    const kot = await kotRepository.findById(kotId);
    if (!kot) {
      throw new NotFoundAppError('KOT not found.');
    }
    return kot;
  }

  async listKots(filters = {}) {
    return kotRepository.listKots(filters);
  }

  async findByOrder(orderId) {
    return kotRepository.findByOrder(orderId);
  }

  async findByOrderIds(orderIds) {
    return kotRepository.findByOrderIds(orderIds);
  }
}

class KitchenService {
  async getKitchenQueue({ branchId, kitchenStation = null }) {
    const kots = await kotRepository.findActiveQueue(branchId, kitchenStation);
    const nowMs = Date.now();

    return kots.map((kot) => {
      let elapsedMinutes = 0;
      if (kot.createdAt) {
        const createdMs = new Date(kot.createdAt).getTime();
        if (!Number.isNaN(createdMs)) {
          elapsedMinutes = Math.max(0, Math.floor((nowMs - createdMs) / 60000));
        }
      }
      return {
        ...kot,
        elapsedMinutes,
      };
    });
  }

  async updateKotStatus({ kotId, newStatus, actorId, actorName, notes = null }) {
    const kot = await kotRepository.findById(kotId);
    if (!kot) {
      throw new NotFoundAppError('KOT not found.');
    }

    const currentStatus = kot.status;
    // Idempotent if already in the target status
    if (currentStatus === newStatus) {
      return kot;
    }

    const validTransitions = {
      NEW: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['SERVED', 'CANCELLED'],
      SERVED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new StateConflictError(
        `Invalid KOT transition from '${currentStatus}' to '${newStatus}'.`
      );
    }

    const now = utcNowIso();
    const updateData = { status: newStatus, updatedAt: now };
    if (newStatus === 'PREPARING') updateData.preparingAt = now;
    if (newStatus === 'READY') updateData.readyAt = now;
    if (newStatus === 'SERVED') updateData.servedAt = now;

    if (notes && String(notes).trim()) {
      const existingNotes = kot.notes || '';
      updateData.notes = existingNotes
        ? `${existingNotes} | ${String(notes).trim()}`
        : String(notes).trim();
    }

    const updatedKot = await kotRepository.updateById(kotId, updateData);

    const orderId = kot.orderId;
    const tableId = kot.tableId;
    const branchId = kot.branchId;

    if (newStatus === 'PREPARING') {
      if (tableId) {
        await tableRepository.updateById(tableId, { status: 'PREPARING' });
      }
      if (orderId) {
        await orderRepository.updateStatus(orderId, 'PREPARING');
        await orderEventRepository.recordEvent({
          orderId,
          branchId,
          eventType: 'KOT_PREPARING',
          fromStatus: currentStatus,
          toStatus: newStatus,
          actorId,
          metadata: { kotId, kotNumber: kot.kotNumber },
        });
      }
    } else if (newStatus === 'READY') {
      if (tableId) {
        await tableRepository.updateById(tableId, { status: 'READY' });
      }
      if (orderId) {
        await orderRepository.updateStatus(orderId, 'READY');
        await orderEventRepository.recordEvent({
          orderId,
          branchId,
          eventType: 'KOT_READY',
          fromStatus: currentStatus,
          toStatus: newStatus,
          actorId,
          metadata: { kotId, kotNumber: kot.kotNumber },
        });
      }

      await notificationService.notify({
        branchId,
        eventType: 'KOT_READY',
        title: `Order Ready: Table ${kot.tableNumber || ''}`,
        message: `KOT ${kot.kotNumber} is ready to serve for Table ${kot.tableNumber || ''}.`,
        recipientRole: 'CAPTAIN',
        recipientUserId: kot.captainId || null,
        metadata: {
          kotId,
          orderId,
          tableNumber: kot.tableNumber,
        },
      });
    } else if (newStatus === 'SERVED') {
      if (orderId) {
        const allKots = await kotRepository.findByOrder(orderId);
        const activeKots = allKots.filter((k) => k.status !== 'CANCELLED');
        const allServed = activeKots.every((k) => k.status === 'SERVED' || k._id === kotId);

        if (allServed) {
          await orderRepository.updateStatus(orderId, 'SERVED', { servedAt: now });
          if (tableId) {
            await tableRepository.updateById(tableId, { status: 'SERVED' });
          }
        }

        await orderEventRepository.recordEvent({
          orderId,
          branchId,
          eventType: 'KOT_SERVED',
          fromStatus: currentStatus,
          toStatus: newStatus,
          actorId,
          metadata: { kotId, kotNumber: kot.kotNumber },
        });
      }
    }

    await auditService.logAction({
      branchId,
      actorId,
      actorName,
      action: 'KOT_STATUS_UPDATED',
      entityType: 'KOT',
      entityId: kotId,
      reason: `Transitioned from ${currentStatus} to ${newStatus}`,
      metadata: { kotNumber: kot.kotNumber, orderId },
    });

    return updatedKot;
  }
}

export const kotService = new KOTService();
export const kitchenService = new KitchenService();
