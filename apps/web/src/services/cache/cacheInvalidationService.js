/**
 * Centralized Cache Invalidation Service for GTS Restaurant POS
 * Features:
 * - Granular invalidation per entity domain and branch scope
 * - Multi-Tab synchronization using BroadcastChannel API
 * - Loop-detection guard to prevent infinite invalidation broadcast loops
 * - Session purge on logout
 */

import { queryClient } from '../../config/queryClient.js';
import { queryKeys } from '../../constants/queryKeys.js';
import { clearAllMasterDataCache } from '../../config/queryClient.js';

const BROADCAST_CHANNEL_NAME = 'gts_pos_cache_bus';

class CacheInvalidationService {
  constructor() {
    this.channel = null;
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.initBroadcastChannel();
  }

  initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data);
        };
      } catch (err) {
        console.warn('[CacheInvalidationService] BroadcastChannel not supported or blocked:', err);
      }
    }
  }

  broadcast(action, payload = {}) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          senderTabId: this.tabId,
          timestamp: Date.now(),
          action,
          payload,
        });
      } catch (err) {
        console.warn('[CacheInvalidationService] Failed to broadcast cache event:', err);
      }
    }
  }

  handleIncomingBroadcast(data) {
    if (!data || data.senderTabId === this.tabId) {
      return; // Ignore messages originating from this tab
    }

    const { action, payload } = data;
    console.debug(`[CacheSync] Cross-tab invalidation received: ${action}`, payload);

    switch (action) {
      case 'INVALIDATE_PRODUCTS':
        this.invalidateProductsLocally(payload.branchId, payload.productId);
        break;
      case 'INVALIDATE_CATEGORIES':
        this.invalidateCategoriesLocally(payload.branchId);
        break;
      case 'INVALIDATE_TABLES':
        this.invalidateTablesLocally(payload.branchId);
        break;
      case 'INVALIDATE_AREAS':
        this.invalidateAreasLocally(payload.branchId);
        break;
      case 'INVALIDATE_KITCHEN_STATIONS':
        this.invalidateKitchenStationsLocally(payload.branchId);
        break;
      case 'INVALIDATE_SETTINGS':
        this.invalidateSettingsLocally(payload.branchId);
        break;
      case 'INVALIDATE_BRANCHES':
        this.invalidateBranchesLocally();
        break;
      case 'INVALIDATE_ROLES':
        this.invalidateRolesLocally();
        break;
      case 'INVALIDATE_ORDERS':
        this.invalidateOrdersLocally(payload.branchId);
        break;
      case 'INVALIDATE_BILLS':
        this.invalidateBillsLocally(payload.branchId);
        break;
      case 'INVALIDATE_ALL_MASTER_DATA':
        this.invalidateAllMasterDataLocally(payload.branchId);
        break;
      default:
        break;
    }
  }

  // --- Products ---
  invalidateProductsLocally(branchId, productId = null) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'products') return false;
        if (productId && key[1] === 'detail' && key[2] === productId) return true;
        if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        return false;
      },
    });
  }

  invalidateProducts(branchId, productId = null) {
    this.invalidateProductsLocally(branchId, productId);
    this.broadcast('INVALIDATE_PRODUCTS', { branchId, productId });
  }

  // --- Categories ---
  invalidateCategoriesLocally(branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'categories') return false;
        if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        return false;
      },
    });
  }

  invalidateCategories(branchId) {
    this.invalidateCategoriesLocally(branchId);
    this.broadcast('INVALIDATE_CATEGORIES', { branchId });
  }

  // --- Tables ---
  invalidateTablesLocally(branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'tables') return false;
        if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        return false;
      },
    });
  }

  invalidateTables(branchId) {
    this.invalidateTablesLocally(branchId);
    this.broadcast('INVALIDATE_TABLES', { branchId });
  }

  // --- Areas ---
  invalidateAreasLocally(branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'areas') return false;
        if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        return false;
      },
    });
  }

  invalidateAreas(branchId) {
    this.invalidateAreasLocally(branchId);
    this.broadcast('INVALIDATE_AREAS', { branchId });
  }

  // --- Kitchen Stations ---
  invalidateKitchenStationsLocally(branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'kitchenStations') return false;
        if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        return false;
      },
    });
  }

  invalidateKitchenStations(branchId) {
    this.invalidateKitchenStationsLocally(branchId);
    this.broadcast('INVALIDATE_KITCHEN_STATIONS', { branchId });
  }

  // --- Settings & Branding ---
  invalidateSettingsLocally(branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] === 'settings' || key[0] === 'branding') {
          if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        }
        return false;
      },
    });
  }

  invalidateSettings(branchId) {
    this.invalidateSettingsLocally(branchId);
    this.broadcast('INVALIDATE_SETTINGS', { branchId });
  }

  // --- Branches ---
  invalidateBranchesLocally() {
    queryClient.invalidateQueries({ queryKey: queryKeys.branches() });
  }

  invalidateBranches() {
    this.invalidateBranchesLocally();
    this.broadcast('INVALIDATE_BRANCHES');
  }

  // --- Roles & Permissions ---
  invalidateRolesLocally() {
    queryClient.invalidateQueries({ queryKey: queryKeys.roles() });
    queryClient.invalidateQueries({ queryKey: queryKeys.permissions() });
  }

  invalidateRoles() {
    this.invalidateRolesLocally();
    this.broadcast('INVALIDATE_ROLES');
  }

  // --- Orders ---
  invalidateOrdersLocally(branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'orders') return false;
        if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        return false;
      },
    });
  }

  invalidateOrders(branchId) {
    this.invalidateOrdersLocally(branchId);
    this.broadcast('INVALIDATE_ORDERS', { branchId });
  }

  // --- Bills ---
  invalidateBillsLocally(branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'bills') return false;
        if (!branchId || key[1] === branchId || key[1] === 'all') return true;
        return false;
      },
    });
  }

  invalidateBills(branchId) {
    this.invalidateBillsLocally(branchId);
    this.broadcast('INVALIDATE_BILLS', { branchId });
  }

  // --- Invalidate All Master Data for Branch ---
  invalidateAllMasterDataLocally(branchId) {
    this.invalidateProductsLocally(branchId);
    this.invalidateCategoriesLocally(branchId);
    this.invalidateTablesLocally(branchId);
    this.invalidateAreasLocally(branchId);
    this.invalidateKitchenStationsLocally(branchId);
    this.invalidateSettingsLocally(branchId);
  }

  invalidateAllMasterData(branchId) {
    this.invalidateAllMasterDataLocally(branchId);
    this.broadcast('INVALIDATE_ALL_MASTER_DATA', { branchId });
  }

  // --- Session Cleanup ---
  async clearOnLogout() {
    try {
      await clearAllMasterDataCache();
    } catch (e) {
      console.warn('[CacheInvalidationService] Cleanup on logout warning:', e);
    }
  }
}

export const cacheInvalidationService = new CacheInvalidationService();
