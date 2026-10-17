import { getCollection } from '../config/database.js';

/**
 * Atomic sequence generator using MongoDB 'counters' collection.
 * Mirrors apps/common/sequence.py in Django backend 1:1.
 *
 * Counter document structure:
 *   _id: "{counterName}_{branchCode}_{year}" (e.g. "ord_MAIN_2026")
 *   branchId: branchCode
 *   year: year
 *   seq: integer
 *
 * Output format: "{PREFIX}-{YEAR}-{seq:06d}" (e.g. "ORD-2026-000001")
 */
export async function getNextSequence(
  counterName,
  prefix,
  branchCode = 'MAIN',
  year = null
) {
  const currentYear = year || new Date().getUTCFullYear();
  const counterId = `${counterName}_${branchCode}_${currentYear}`;
  const collection = await getCollection('counters');

  const result = await collection.findOneAndUpdate(
    { _id: counterId },
    {
      $inc: { seq: 1 },
      $setOnInsert: {
        branchId: branchCode,
        year: currentYear,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );

  // MongoDB Node driver v6 returns the document directly from findOneAndUpdate
  const doc = result?.value !== undefined ? result.value : result;
  const seq = Number(doc?.seq || 1);
  return `${prefix}-${currentYear}-${String(seq).padStart(6, '0')}`;
}
