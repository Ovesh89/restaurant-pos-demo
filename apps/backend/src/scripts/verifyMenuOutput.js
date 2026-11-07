import { connectDatabase, disconnectDatabase, getCollection } from '../config/database.js';
import { menuService } from '../modules/menu/service.js';

async function main() {
  await connectDatabase();

  const user = { id: 'user-001', role: 'admin', branchIds: ['branch-main'] };

  console.log('--- Checking Categories ---');
  const allCats = await menuService.listCategories('branch-main', user, false);
  console.log(`listCategories(isActiveOnly=false): total ${allCats.length}`);
  
  const activeOnlyCats = await menuService.listCategories('branch-main', user, true);
  console.log(`listCategories(isActiveOnly=true): total ${activeOnlyCats.length}`);

  console.log('--- Checking Products ---');
  const p1 = await menuService.listProducts({
    branchId: 'branch-main',
    user,
    isActive: true,
    page: 1,
    limit: 20
  });
  console.log(`Page 1 products: items=${p1.items.length}, total=${p1.pagination.total}, totalPages=${p1.pagination.totalPages}`);

  const p2 = await menuService.listProducts({
    branchId: 'branch-main',
    user,
    isActive: true,
    page: 2,
    limit: 20
  });
  console.log(`Page 2 products: items=${p2.items.length}, total=${p2.pagination.total}, totalPages=${p2.pagination.totalPages}`);

  await disconnectDatabase();
}

main().catch(console.error);
