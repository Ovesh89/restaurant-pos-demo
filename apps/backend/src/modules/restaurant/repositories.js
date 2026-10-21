import { BaseMongoRepository, serializeMongoDoc } from '../../repositories/BaseMongoRepository.js';

export class BranchRepository extends BaseMongoRepository {
  constructor() {
    super('branches', 'branch');
  }

  async findByCode(code) {
    if (!code) return null;
    return this.findOne({ code: String(code).trim().toUpperCase() });
  }
}

export class AreaRepository extends BaseMongoRepository {
  constructor() {
    super('areas', 'area');
  }

  async findByBranch(branchId, isActiveOnly = false) {
    const query = { branchId };
    if (isActiveOnly) query.isActive = true;
    return this.findMany(query, { sort: [['sortOrder', 1], ['name', 1]] });
  }
}

export class TableRepository extends BaseMongoRepository {
  constructor() {
    super('tables', 'tbl');
  }

  /**
   * Resolves both tbl-XX and table-XX interchangeably, matching
   * Django apps/restaurant/repositories.py TableRepository.find_by_id().
   */
  async findById(docId, projection = null) {
    if (!docId) return null;
    const strId = String(docId);
    const col = await this.collection();
    let doc = await col.findOne(
      { _id: strId },
      projection ? { projection } : undefined
    );

    if (!doc) {
      let altId = null;
      if (strId.startsWith('table-')) {
        altId = `tbl-${strId.slice('table-'.length)}`;
      } else if (strId.startsWith('tbl-')) {
        altId = `table-${strId.slice('tbl-'.length)}`;
      }
      if (altId) {
        doc = await col.findOne(
          { _id: altId },
          projection ? { projection } : undefined
        );
      }
    }

    return serializeMongoDoc(doc);
  }

  async updateById(docId, updateFields, extraOperators = null) {
    if (!docId) return null;
    const strId = String(docId);
    let updated = await super.updateById(strId, updateFields, extraOperators);
    if (!updated) {
      let altId = null;
      if (strId.startsWith('table-')) {
        altId = `tbl-${strId.slice('table-'.length)}`;
      } else if (strId.startsWith('tbl-')) {
        altId = `table-${strId.slice('tbl-'.length)}`;
      }
      if (altId) {
        updated = await super.updateById(altId, updateFields, extraOperators);
      }
    }
    return updated;
  }

  async findByBranch(branchId, { areaId = null, status = null, isActive = null } = {}) {
    const query = { branchId };
    if (areaId) query.areaId = areaId;
    if (status) query.status = status;
    if (isActive !== null && isActive !== undefined) query.isActive = Boolean(isActive);
    return this.findMany(query, { sort: [['tableNumber', 1]] });
  }

  async findByBranchAndNumber(branchId, tableNumber) {
    if (!branchId || !tableNumber) return null;
    return this.findOne({
      branchId,
      tableNumber: String(tableNumber).trim(),
    });
  }
}

export const branchRepository = new BranchRepository();
export const areaRepository = new AreaRepository();
export const tableRepository = new TableRepository();

export class KitchenStationRepository extends BaseMongoRepository {
  constructor() {
    super('kitchen_stations', 'station');
  }

  async findByBranch(branchId, isActiveOnly = false) {
    const query = { branchId };
    if (isActiveOnly) query.isActive = true;
    return this.findMany(query, { sort: [['sortOrder', 1], ['name', 1]] });
  }

  async findByName(branchId, name) {
    if (!branchId || !name) return null;
    return this.findOne({
      branchId,
      name: String(name).trim(),
    });
  }
}

export const kitchenStationRepository = new KitchenStationRepository();

