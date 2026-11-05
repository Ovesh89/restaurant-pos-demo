/**
 * Server-Side Master Data Revision Tracking Service
 * Tracks monotonic revisions for each master-data domain per branch.
 * Allows clients to detect changes without polling full datasets.
 */

import { getDatabase } from '../../config/database.js';

const COLLECTION_NAME = 'master_data_revisions';

export const DEFAULT_REVISIONS = {
  branches: 1,
  areas: 1,
  tables: 1,
  categories: 1,
  products: 1,
  kitchenStations: 1,
  settings: 1,
  roles: 1,
  users: 1,
};

export class RevisionService {
  getBranchKey(branchId) {
    return branchId || 'branch-main';
  }

  /**
   * Retrieves current master data revision versions for a specific branch.
   */
  async getMasterDataVersions(branchId) {
    const branchKey = this.getBranchKey(branchId);
    const db = await getDatabase();
    const doc = await db.collection(COLLECTION_NAME).findOne({ branchId: branchKey });

    const versions = {
      branches: doc?.branches || DEFAULT_REVISIONS.branches,
      areas: doc?.areas || DEFAULT_REVISIONS.areas,
      tables: doc?.tables || DEFAULT_REVISIONS.tables,
      categories: doc?.categories || DEFAULT_REVISIONS.categories,
      products: doc?.products || DEFAULT_REVISIONS.products,
      kitchenStations: doc?.kitchenStations || DEFAULT_REVISIONS.kitchenStations,
      settings: doc?.settings || DEFAULT_REVISIONS.settings,
      roles: doc?.roles || DEFAULT_REVISIONS.roles,
      users: doc?.users || DEFAULT_REVISIONS.users,
    };

    return {
      branchId: branchKey,
      versions,
      timestamp: doc?.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
    };
  }

  /**
   * Atomically increments the revision counter for a specific resource.
   */
  async bumpRevision(branchId, resourceType) {
    const branchKey = this.getBranchKey(branchId);
    const db = await getDatabase();
    const now = new Date();

    const existing = await db.collection(COLLECTION_NAME).findOne({ branchId: branchKey });
    if (!existing) {
      const initialDoc = {
        branchId: branchKey,
        ...DEFAULT_REVISIONS,
        [resourceType]: (DEFAULT_REVISIONS[resourceType] || 1) + 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection(COLLECTION_NAME).insertOne(initialDoc);
      return initialDoc[resourceType];
    }

    const currentVal = existing[resourceType] !== undefined ? existing[resourceType] : (DEFAULT_REVISIONS[resourceType] || 1);
    const newVal = currentVal + 1;

    await db.collection(COLLECTION_NAME).updateOne(
      { branchId: branchKey },
      {
        $set: {
          [resourceType]: newVal,
          updatedAt: now,
        },
      }
    );

    return newVal;
  }

  /**
   * Generates a weak ETag string for a resource's current version
   */
  generateETag(branchId, resourceType, version) {
    const branchKey = this.getBranchKey(branchId);
    return `W/"${resourceType}-${branchKey}-v${version}"`;
  }
}

export const revisionService = new RevisionService();
