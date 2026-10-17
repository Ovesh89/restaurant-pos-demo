import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { billRepository, BILL_STATUS } from '../billRepository.js';
import { auditRepository } from '../auditRepository.js';
import { SHIFT_STATUS, CASH_MOVEMENT_TYPE } from '../local/shiftLocalRepository.js';

class ShiftApiRepository {
  async getShifts(filters = {}) {
    const shifts = storageAdapter.getItem(STORAGE_KEYS.SHIFTS) || [];
    let list = [...shifts];

    if (filters.status) {
      list = list.filter((s) => s.status === filters.status);
    }
    if (filters.cashierId) {
      list = list.filter((s) => s.cashierId === filters.cashierId);
    }

    list.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));

    const total = list.length;
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 0);

    const items = limit > 0 ? list.slice((page - 1) * limit, page * limit) : list;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

    items.pagination = {
      total,
      page,
      limit: limit || total,
      totalPages,
      hasNext: limit > 0 ? page < totalPages : false,
      hasPrev: limit > 0 ? page > 1 : false
    };

    return items;
  }

  async getShiftById(id) {
    const shifts = storageAdapter.getItem(STORAGE_KEYS.SHIFTS) || [];
    return shifts.find((s) => s.id === id) || null;
  }

  async getActiveShift(branchId = 'branch-main') {
    const shifts = await this.getShifts();
    return shifts.find((s) => s.status === SHIFT_STATUS.OPEN && (s.branchId === branchId || !branchId)) || null;
  }

  async openShift({
    openingFloat = 0,
    branchId = 'branch-main',
    cashier = { id: 'cashier', name: 'Cashier' }
  }) {
    const active = await this.getActiveShift(branchId);
    if (active) {
      throw new Error(`Shift #${active.shiftNo} is already OPEN by ${active.cashierName}. Please close the active shift first.`);
    }

    const shifts = storageAdapter.getItem(STORAGE_KEYS.SHIFTS) || [];
    const count = shifts.length + 1;
    const shiftNo = `SH-${String(count).padStart(3, '0')}`;
    const floatAmt = Number(openingFloat) || 0;

    const newShift = {
      id: `shift-${Date.now()}`,
      shiftNo,
      branchId,
      cashierId: cashier.id,
      cashierName: cashier.name,
      openedAt: new Date().toISOString(),
      closedAt: null,
      status: SHIFT_STATUS.OPEN,
      openingFloat: floatAmt,
      cashMovements: [],
      actualCash: 0,
      expectedCash: floatAmt,
      cashVariance: 0,
      notes: '',
      closedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    shifts.unshift(newShift);
    storageAdapter.setItem(STORAGE_KEYS.SHIFTS, shifts);

    await auditRepository.logEvent({
      actorId: cashier.id,
      actorName: cashier.name,
      action: 'SHIFT_OPENED',
      entityType: 'Shift',
      entityId: newShift.id,
      details: `Cashier Shift #${newShift.shiftNo} opened with Opening Cash Float ₹${floatAmt}.`
    });

    return newShift;
  }

  async recordCashMovement({ shiftId, type, amount, reason, actor = { id: 'cashier', name: 'Cashier' } }) {
    const numAmt = Number(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      throw new Error('Please enter a valid positive amount.');
    }
    if (!reason || !reason.trim()) {
      throw new Error('Reason is required for cash in/out adjustments.');
    }

    const shifts = storageAdapter.getItem(STORAGE_KEYS.SHIFTS) || [];
    const index = shifts.findIndex((s) => s.id === shiftId);
    if (index === -1) {
      throw new Error('Shift record not found.');
    }

    const shift = shifts[index];
    if (shift.status !== SHIFT_STATUS.OPEN) {
      throw new Error('Cannot add cash movements to a closed shift.');
    }

    const movement = {
      id: `mov-${Date.now()}`,
      type,
      amount: numAmt,
      reason: reason.trim(),
      actorName: actor.name,
      timestamp: new Date().toISOString()
    };

    shift.cashMovements = [...(shift.cashMovements || []), movement];
    shift.updatedAt = new Date().toISOString();

    shifts[index] = shift;
    storageAdapter.setItem(STORAGE_KEYS.SHIFTS, shifts);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: type === CASH_MOVEMENT_TYPE.IN ? 'CASH_IN_RECORDED' : 'CASH_OUT_RECORDED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `${type === CASH_MOVEMENT_TYPE.IN ? 'Cash In' : 'Cash Out'} of ₹${numAmt} recorded. Reason: "${reason.trim()}".`
    });

    return shift;
  }

  async getShiftLiveSummary(shiftId) {
    const shift = await this.getShiftById(shiftId);
    if (!shift) throw new Error('Shift not found.');

    const startTime = new Date(shift.openedAt).getTime();
    const endTime = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();

    // Query live authoritative bills from Django API
    const allBills = await billRepository.getBills();
    const shiftBills = allBills.filter((b) => {
      if (b.status !== BILL_STATUS.PAID) return false;
      const t = new Date(b.settledAt || b.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });

    let totalSales = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let otherSales = 0;

    shiftBills.forEach((b) => {
      totalSales += b.grandTotal || 0;
      (b.payments || []).forEach((p) => {
        const mode = p.mode?.toUpperCase();
        const amt = Number(p.amount) || 0;
        if (mode === 'CASH') cashSales += amt;
        else if (mode === 'UPI') upiSales += amt;
        else if (mode === 'CARD') cardSales += amt;
        else otherSales += amt;
      });
    });

    let totalCashIn = 0;
    let totalCashOut = 0;
    (shift.cashMovements || []).forEach((m) => {
      if (m.type === CASH_MOVEMENT_TYPE.IN) totalCashIn += m.amount;
      else totalCashOut += m.amount;
    });

    const expectedCash = (shift.openingFloat || 0) + cashSales + totalCashIn - totalCashOut;

    return {
      shift,
      billCount: shiftBills.length,
      totalSales,
      cashSales,
      upiSales,
      cardSales,
      otherSales,
      totalCashIn,
      totalCashOut,
      expectedCash
    };
  }

  async closeShift({ shiftId, actualCash, notes = '', actor = { id: 'cashier', name: 'Cashier' } }) {
    const countCash = Number(actualCash);
    if (isNaN(countCash) || countCash < 0) {
      throw new Error('Please enter a valid non-negative physical cash count.');
    }

    const shifts = storageAdapter.getItem(STORAGE_KEYS.SHIFTS) || [];
    const index = shifts.findIndex((s) => s.id === shiftId);
    if (index === -1) throw new Error('Shift not found.');

    const shift = shifts[index];
    if (shift.status === SHIFT_STATUS.CLOSED) {
      throw new Error('Shift is already closed.');
    }

    const summary = await this.getShiftLiveSummary(shiftId);
    const variance = countCash - summary.expectedCash;

    shift.status = SHIFT_STATUS.CLOSED;
    shift.closedAt = new Date().toISOString();
    shift.closedBy = actor.name;
    shift.actualCash = countCash;
    shift.expectedCash = summary.expectedCash;
    shift.cashVariance = variance;
    shift.notes = notes.trim();
    shift.salesSummary = {
      billCount: summary.billCount,
      totalSales: summary.totalSales,
      cashSales: summary.cashSales,
      upiSales: summary.upiSales,
      cardSales: summary.cardSales,
      otherSales: summary.otherSales,
      totalCashIn: summary.totalCashIn,
      totalCashOut: summary.totalCashOut
    };
    shift.updatedAt = new Date().toISOString();

    shifts[index] = shift;
    storageAdapter.setItem(STORAGE_KEYS.SHIFTS, shifts);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'SHIFT_CLOSED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Shift #${shift.shiftNo} closed. Expected Cash: ₹${summary.expectedCash}, Counted: ₹${countCash}, Variance: ${variance >= 0 ? '+' : ''}₹${variance}.`
    });

    return shift;
  }
}

export const shiftApiRepository = new ShiftApiRepository();
