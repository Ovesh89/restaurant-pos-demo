import crypto from 'node:crypto';
import { getCollection } from '../config/database.js';
import { Decimal } from '../utils/decimal.js';

/**
 * Recursively serialize MongoDB documents so:
 * - _id is preserved as string AND copied to id as string
 * - Date objects are converted to ISO-8601 strings
 * - Decimal instances are converted to 2-decimal strings
 * Mirrors serialize_mongo_doc in apps/common/repositories.py 1:1.
 */
export function serializeMongoDoc(doc) {
  if (doc === null || doc === undefined) {
    return null;
  }
  if (Array.isArray(doc)) {
    return doc.map((item) => serializeMongoDoc(item));
  }
  if (doc instanceof Date) {
    return doc.toISOString();
  }
  if (doc instanceof Decimal) {
    return doc.toFixed(2);
  }
  if (typeof doc === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(doc)) {
      if (key === '_id') {
        const strId = String(value);
        out._id = strId;
        if (!('id' in doc)) {
          out.id = strId;
        }
      } else if (value instanceof Date) {
        out[key] = value.toISOString();
      } else if (value instanceof Decimal) {
        out[key] = value.toFixed(2);
      } else if (Array.isArray(value)) {
        out[key] = value.map((v) =>
          v && typeof v === 'object' ? serializeMongoDoc(v) : v
        );
      } else if (value && typeof value === 'object' && value.constructor === Object) {
        out[key] = serializeMongoDoc(value);
      } else {
        out[key] = value;
      }
    }
    if ('_id' in out && !('id' in out)) {
      out.id = out._id;
    }
    return out;
  }
  return doc;
}

export function utcNowIso() {
  return new Date().toISOString();
}

/**
 * Paginate a MongoDB query and return { items, pagination }.
 * Mirrors paginate_mongo_query in apps/common/pagination.py 1:1.
 */
export async function paginateMongoQuery(
  collectionOrRepo,
  query = {},
  {
    page = 1,
    limit = 50,
    sort = { createdAt: -1 },
    projection = null,
  } = {}
) {
  const collection =
    typeof collectionOrRepo?.collection === 'function'
      ? await collectionOrRepo.collection()
      : collectionOrRepo;

  let pageNum = parseInt(page, 10);
  if (Number.isNaN(pageNum) || pageNum < 1) pageNum = 1;

  let limitNum = parseInt(limit, 10);
  if (Number.isNaN(limitNum) || limitNum < 1) limitNum = 50;
  if (limitNum > 200) limitNum = 200;

  const total = await collection.countDocuments(query);
  const skip = (pageNum - 1) * limitNum;

  let cursor = collection.find(query, projection ? { projection } : undefined);
  if (sort && (Array.isArray(sort) ? sort.length > 0 : Object.keys(sort).length > 0)) {
    cursor = cursor.sort(sort);
  }
  const rawDocs = await cursor.skip(skip).limit(limitNum).toArray();
  const items = rawDocs.map((d) => serializeMongoDoc(d));
  const totalPages = limitNum > 0 ? Math.max(1, Math.ceil(total / limitNum)) : 1;

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    },
  };
}

/**
 * Base MongoDB Repository mirroring apps/common/repositories.py BaseMongoRepository.
 */
export class BaseMongoRepository {
  constructor(collectionName, idPrefix = null) {
    this.collectionName = collectionName;
    this.idPrefix = idPrefix;
  }

  async collection() {
    return getCollection(this.collectionName);
  }

  static utcNowIso() {
    return utcNowIso();
  }

  serializeMany(docs = []) {
    return (docs || []).map((d) => serializeMongoDoc(d));
  }

  generateId(prefix = null) {
    const p = prefix || this.idPrefix;
    const hex = crypto.randomUUID().replace(/-/g, '');
    return p ? `${p}_${hex}` : crypto.randomUUID();
  }

  async findById(docId, projection = null) {
    if (!docId) return null;
    const col = await this.collection();
    const doc = await col.findOne(
      { _id: String(docId) },
      projection ? { projection } : undefined
    );
    return serializeMongoDoc(doc);
  }

  async findOne(query, projection = null) {
    const col = await this.collection();
    const doc = await col.findOne(query, projection ? { projection } : undefined);
    return serializeMongoDoc(doc);
  }

  async findMany(
    query = {},
    { sort = null, limit = 0, skip = 0, projection = null } = {}
  ) {
    const col = await this.collection();
    let cursor = col.find(query, projection ? { projection } : undefined);
    if (sort) {
      cursor = cursor.sort(sort);
    }
    if (skip > 0) {
      cursor = cursor.skip(skip);
    }
    if (limit > 0) {
      cursor = cursor.limit(limit);
    }
    const docs = await cursor.toArray();
    return docs.map((d) => serializeMongoDoc(d));
  }

  async findPaginated(
    query = {},
    {
      page = 1,
      limit = 50,
      sort = [['createdAt', -1]],
      projection = null,
    } = {}
  ) {
    const col = await this.collection();
    return paginateMongoQuery(col, query, { page, limit, sort, projection });
  }

  async insertOne(document, prefix = null) {
    const now = BaseMongoRepository.utcNowIso();
    const doc = { ...document };
    if (!doc._id) {
      doc._id = doc.id || this.generateId(prefix || this.collectionName);
    }
    doc._id = String(doc._id);
    doc.id = doc._id;
    if (!doc.createdAt) doc.createdAt = now;
    if (!doc.updatedAt) doc.updatedAt = now;

    const col = await this.collection();
    await col.insertOne(doc);
    return serializeMongoDoc(doc);
  }

  async updateById(docId, updateFields, extraOperators = null) {
    const now = BaseMongoRepository.utcNowIso();
    const setPayload = { ...updateFields, updatedAt: now };
    delete setPayload._id;
    delete setPayload.id;

    const updateDoc = { $set: setPayload };
    if (extraOperators) {
      for (const [op, val] of Object.entries(extraOperators)) {
        if (op === '$set') {
          Object.assign(updateDoc.$set, val);
        } else {
          updateDoc[op] = val;
        }
      }
    }

    const col = await this.collection();
    const res = await col.findOneAndUpdate(
      { _id: String(docId) },
      updateDoc,
      { returnDocument: 'after' }
    );
    const updated = res?.value !== undefined ? res.value : res;
    return serializeMongoDoc(updated);
  }

  async deleteById(docId) {
    const col = await this.collection();
    const res = await col.deleteOne({ _id: String(docId) });
    return res.deletedCount > 0;
  }

  async count(query = {}) {
    const col = await this.collection();
    return col.countDocuments(query);
  }
}
