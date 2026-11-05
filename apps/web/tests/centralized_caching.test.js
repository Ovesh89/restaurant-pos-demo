import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../src/constants/queryKeys.js';
import { CACHE_POLICIES, PERSISTENT_QUERY_KEYS } from '../src/config/cachePolicies.js';
import { shouldDehydrateQuery } from '../src/config/queryClient.js';

describe('Centralized Master Data Cache & Query Client Architecture', () => {
  let client;
  let apiCallCount;

  const mockApiFetcher = async (data = { items: ['item1', 'item2'] }) => {
    apiCallCount += 1;
    return data;
  };

  beforeEach(() => {
    apiCallCount = 0;
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 24 * 60 * 60 * 1000,
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    if (client) {
      client.clear();
    }
  });

  it('1. First visit fetches data from API; second screen reuses cached data without duplicate network calls', async () => {
    const key = queryKeys.categories('branch-main', true);

    // Screen A: Fetch data for the first time
    const screenAData = await client.fetchQuery({
      queryKey: key,
      queryFn: () => mockApiFetcher({ categories: [{ id: 'cat-1', name: 'Curry' }] }),
      staleTime: CACHE_POLICIES.CATEGORIES.staleTime,
    });

    assert.equal(apiCallCount, 1, 'Screen A should trigger 1 API call');
    assert.equal(screenAData.categories[0].name, 'Curry');

    // Screen B: Navigates and needs the same data
    const screenBData = await client.fetchQuery({
      queryKey: key,
      queryFn: () => mockApiFetcher({ categories: [{ id: 'cat-1', name: 'Curry' }] }),
      staleTime: CACHE_POLICIES.CATEGORIES.staleTime,
    });

    assert.equal(apiCallCount, 1, 'Screen B should reuse cached data with ZERO additional network calls');
    assert.deepEqual(screenBData, screenAData);

    // Screen C: Repeated navigation
    const screenCData = await client.fetchQuery({
      queryKey: key,
      queryFn: () => mockApiFetcher(),
      staleTime: CACHE_POLICIES.CATEGORIES.staleTime,
    });

    assert.equal(apiCallCount, 1, 'Repeated navigation must not make duplicate requests');
    assert.deepEqual(screenCData, screenAData);
  });

  it('2. Cache invalidation marks resource as stale and forces refetch on subsequent query', async () => {
    const key = queryKeys.products('branch-main', { onlyAvailable: true });

    // Initial fetch
    await client.fetchQuery({
      queryKey: key,
      queryFn: () => mockApiFetcher({ products: [{ id: 'prod-1', name: 'Naan', price: 50 }] }),
      staleTime: CACHE_POLICIES.PRODUCTS.staleTime,
    });
    assert.equal(apiCallCount, 1);

    // Mutation occurs -> invalidate products for branch-main
    client.invalidateQueries({
      predicate: (query) => {
        const qKey = query.queryKey;
        return qKey[0] === 'products' && (qKey[1] === 'branch-main' || qKey[1] === 'all');
      },
    });

    // Next screen access triggers refetch
    await client.fetchQuery({
      queryKey: key,
      queryFn: () => mockApiFetcher({ products: [{ id: 'prod-1', name: 'Naan', price: 60 }] }),
      staleTime: CACHE_POLICIES.PRODUCTS.staleTime,
    });

    assert.equal(apiCallCount, 2, 'Invalidated query should trigger fresh background network fetch');
  });

  it('3. Branch isolation guarantees data cannot leak between branches', async () => {
    const mainBranchKey = queryKeys.tables('branch-main');
    const branch2Key = queryKeys.tables('branch-rooftop');

    await client.fetchQuery({
      queryKey: mainBranchKey,
      queryFn: () => mockApiFetcher({ tables: [{ id: 'tbl-1', tableNumber: 'T-01' }] }),
    });

    await client.fetchQuery({
      queryKey: branch2Key,
      queryFn: () => mockApiFetcher({ tables: [{ id: 'tbl-roof-1', tableNumber: 'R-01' }] }),
    });

    assert.equal(apiCallCount, 2, 'Each branch must have independent query keys');

    const mainData = client.getQueryData(mainBranchKey);
    const rooftopData = client.getQueryData(branch2Key);

    assert.notDeepEqual(mainData, rooftopData);
    assert.equal(mainData.tables[0].tableNumber, 'T-01');
    assert.equal(rooftopData.tables[0].tableNumber, 'R-01');
  });

  it('4. Persistent filter whitelist restricts storage strictly to Master Data and denies Operational Data', () => {
    // Master data queries must be allowed in IndexedDB
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.branches() }), true);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.categories('branch-main') }), true);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.products('branch-main') }), true);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.tables('branch-main') }), true);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.settings('branch-main') }), true);

    // Operational and sensitive data queries must NEVER be persisted to disk
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.orders('branch-main') }), false);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.kotQueue('branch-main') }), false);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.pendingSettlement('branch-main') }), false);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.bills('branch-main') }), false);
    assert.equal(shouldDehydrateQuery({ queryKey: queryKeys.notifications('usr-1') }), false);
  });

  it('5. Operational data uses short staleTime and does not retain stale orders/KOTs', () => {
    assert.ok(CACHE_POLICIES.ACTIVE_ORDERS.staleTime <= 20000, 'Active orders stale time must be <= 20s');
    assert.ok(CACHE_POLICIES.KOT_QUEUE.staleTime <= 10000, 'KOT queue stale time must be <= 10s');
    assert.ok(CACHE_POLICIES.PENDING_SETTLEMENT.staleTime <= 20000, 'Pending settlement stale time must be <= 20s');

    // Master data retention is long-lived
    assert.ok(CACHE_POLICIES.CATEGORIES.staleTime >= 5 * 60 * 1000, 'Categories stale time must be at least 5m');
    assert.ok(CACHE_POLICIES.BRANCHES.staleTime >= 10 * 60 * 1000, 'Branches stale time must be at least 10m');
  });

  it('6. Failed background refresh preserves previously valid cached data without UI crash', async () => {
    const key = queryKeys.categories('branch-main', true);

    // Initial successful fetch
    await client.fetchQuery({
      queryKey: key,
      queryFn: () => mockApiFetcher({ categories: [{ id: 'cat-1', name: 'Curry' }] }),
      staleTime: 0, // Mark immediately stale
    });

    // Background fetch fails with network error
    try {
      await client.fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error('Network timeout (transient error)');
        },
      });
    } catch (e) {
      // expected error
    }

    // Previously valid cached data should still be retained in cache
    const retainedData = client.getQueryData(key);
    assert.ok(retainedData, 'Cached data must not be destroyed by a transient network error');
    assert.equal(retainedData.categories[0].name, 'Curry');
  });

  it('7. Session purge on logout clears all cached data', async () => {
    const key1 = queryKeys.products('branch-main');
    const key2 = queryKeys.tables('branch-main');

    await client.fetchQuery({ queryKey: key1, queryFn: () => mockApiFetcher('prods') });
    await client.fetchQuery({ queryKey: key2, queryFn: () => mockApiFetcher('tables') });

    assert.ok(client.getQueryData(key1));
    assert.ok(client.getQueryData(key2));

    // User logs out -> clear cache
    client.clear();

    assert.equal(client.getQueryData(key1), undefined);
    assert.equal(client.getQueryData(key2), undefined);
  });
});
