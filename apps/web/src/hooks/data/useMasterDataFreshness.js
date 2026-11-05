/**
 * Master Data Freshness Monitor Hook
 * Automatically detects backend changes made by other users, tabs, or processes
 * and selectively refreshes only the affected resources.
 */

import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../../services/api/apiClient.js';
import { APP_CONFIG } from '../../config/appConfig.js';
import { cacheInvalidationService } from '../../services/cache/cacheInvalidationService.js';

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

export function useMasterDataFreshness(branchId = 'branch-main', enabled = true) {
  const currentBranch = branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main';
  const knownVersionsRef = useRef(null);
  const isCheckingRef = useRef(false);

  const checkFreshness = useCallback(async () => {
    if (!enabled || isCheckingRef.current || APP_CONFIG.DATA_PROVIDER !== 'api') {
      return;
    }

    try {
      isCheckingRef.current = true;
      const response = await apiClient.get(`/meta/master-data-versions?branchId=${currentBranch}`);
      const serverVersions = response?.versions || response?.data?.versions || response;

      if (!serverVersions || typeof serverVersions !== 'object') {
        return;
      }

      if (!knownVersionsRef.current) {
        // Initial baseline capture
        knownVersionsRef.current = { ...serverVersions };
        return;
      }

      const prev = knownVersionsRef.current;
      const changedResources = [];

      Object.keys(serverVersions).forEach((resource) => {
        const prevVer = prev[resource] || 0;
        const newVer = serverVersions[resource] || 0;
        if (newVer > prevVer) {
          changedResources.push(resource);
        }
      });

      if (changedResources.length > 0) {
        console.info('[Freshness] Server updates detected for resources:', changedResources);
        changedResources.forEach((resource) => {
          switch (resource) {
            case 'products':
              cacheInvalidationService.invalidateProducts(currentBranch);
              break;
            case 'categories':
              cacheInvalidationService.invalidateCategories(currentBranch);
              break;
            case 'tables':
              cacheInvalidationService.invalidateTables(currentBranch);
              break;
            case 'areas':
              cacheInvalidationService.invalidateAreas(currentBranch);
              break;
            case 'kitchenStations':
              cacheInvalidationService.invalidateKitchenStations(currentBranch);
              break;
            case 'settings':
              cacheInvalidationService.invalidateSettings(currentBranch);
              break;
            case 'branches':
              cacheInvalidationService.invalidateBranches();
              break;
            case 'roles':
              cacheInvalidationService.invalidateRoles();
              break;
            default:
              break;
          }
        });
      }

      // Update baseline
      knownVersionsRef.current = { ...serverVersions };
    } catch (err) {
      // Non-blocking: background check failure should never disturb active POS workflow
      console.debug('[Freshness] Background check skipped/failed:', err.message);
    } finally {
      isCheckingRef.current = false;
    }
  }, [currentBranch, enabled]);

  // Periodic polling & Window focus listener
  useEffect(() => {
    if (!enabled || APP_CONFIG.DATA_PROVIDER !== 'api') return;

    // Check immediately on mount/branch change
    checkFreshness();

    // Check on window focus and document visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkFreshness();
      }
    };
    const handleFocus = () => {
      checkFreshness();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Periodic timer
    const intervalId = setInterval(checkFreshness, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [checkFreshness, enabled]);

  return {
    checkFreshness,
  };
}
