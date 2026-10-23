/**
 * Sync System Roles with Canonical Permission Registry
 * Updates existing default roles in the dev database without affecting custom user accounts.
 */

import { getDatabase, closeMongoConnection } from '../apps/backend/src/config/database.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../apps/backend/src/config/permissions.js';

async function syncRoles() {
  try {
    const db = await getDatabase();
    const rolesColl = db.collection('roles');

    console.log('Synchronizing roles permissions in database...');

    for (const [code, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = `role-${code.toLowerCase()}`;
      const existing = await rolesColl.findOne({ _id: roleId });

      if (existing) {
        // Merge existing permissions with canonical permissions
        const merged = Array.from(new Set([...(existing.permissions || []), ...perms])).sort();
        await rolesColl.updateOne(
          { _id: roleId },
          {
            $set: {
              permissions: merged,
              updatedAt: new Date().toISOString(),
            },
          }
        );
        console.log(`Updated ${code} (${roleId}) with ${merged.length} permissions.`);
      }
    }

    console.log('Role sync completed successfully.');
  } catch (err) {
    console.error('Role sync failed:', err);
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

syncRoles();
