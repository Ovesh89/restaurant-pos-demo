/**
 * Centralized Reusable Master Data React Query Hooks for GTS Restaurant POS
 * Connects standard repositories to TanStack Query client with shared cache
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../constants/queryKeys.js';
import { CACHE_POLICIES } from '../../config/cachePolicies.js';
import { categoryRepository } from '../../services/repositories/categoryRepository.js';
import { productRepository } from '../../services/repositories/productRepository.js';
import { tableRepository } from '../../services/repositories/tableRepository.js';
import { branchRepository } from '../../services/repositories/branchRepository.js';
import { kitchenStationRepository } from '../../services/repositories/kitchenStationRepository.js';
import { settingsRepository } from '../../services/repositories/settingsRepository.js';
import { roleRepository } from '../../services/repositories/roleRepository.js';

// --- Branches ---
export function useBranches(options = {}) {
  return useQuery({
    queryKey: queryKeys.branches(),
    queryFn: () => branchRepository.getBranches(),
    staleTime: CACHE_POLICIES.BRANCHES.staleTime,
    gcTime: CACHE_POLICIES.BRANCHES.gcTime,
    ...options,
  });
}

// --- Areas ---
export function useAreas(branchId = 'branch-main', options = {}) {
  return useQuery({
    queryKey: queryKeys.areas(branchId),
    queryFn: () => branchRepository.getAreas(branchId),
    staleTime: CACHE_POLICIES.AREAS.staleTime,
    gcTime: CACHE_POLICIES.AREAS.gcTime,
    ...options,
  });
}

// --- Tables ---
export function useTables(branchId = 'branch-main', params = {}, options = {}) {
  const areaId = params?.areaId || null;
  return useQuery({
    queryKey: queryKeys.tables(branchId, { areaId }),
    queryFn: () => tableRepository.getTables(branchId, areaId),
    staleTime: CACHE_POLICIES.TABLES.staleTime,
    gcTime: CACHE_POLICIES.TABLES.gcTime,
    ...options,
  });
}

export function useTable(tableId, options = {}) {
  return useQuery({
    queryKey: queryKeys.table(tableId),
    queryFn: () => tableRepository.getTableById(tableId),
    enabled: Boolean(tableId),
    staleTime: CACHE_POLICIES.TABLES.staleTime,
    gcTime: CACHE_POLICIES.TABLES.gcTime,
    ...options,
  });
}

// --- Categories ---
export function useCategories(branchId = 'branch-main', includeInactive = false, options = {}) {
  return useQuery({
    queryKey: queryKeys.categories(branchId, includeInactive),
    queryFn: () => categoryRepository.getCategories(includeInactive),
    staleTime: CACHE_POLICIES.CATEGORIES.staleTime,
    gcTime: CACHE_POLICIES.CATEGORIES.gcTime,
    ...options,
  });
}

export function useCategory(categoryId, options = {}) {
  return useQuery({
    queryKey: queryKeys.category(categoryId),
    queryFn: () => categoryRepository.getCategoryById(categoryId),
    enabled: Boolean(categoryId),
    staleTime: CACHE_POLICIES.CATEGORIES.staleTime,
    gcTime: CACHE_POLICIES.CATEGORIES.gcTime,
    ...options,
  });
}

// --- Products ---
export function useProducts(branchId = 'branch-main', filters = {}, options = {}) {
  const normalizedFilters = {
    ...filters,
    branchId: branchId || 'branch-main',
  };

  return useQuery({
    queryKey: queryKeys.products(branchId, normalizedFilters),
    queryFn: () => productRepository.getProducts(normalizedFilters),
    staleTime: CACHE_POLICIES.PRODUCTS.staleTime,
    gcTime: CACHE_POLICIES.PRODUCTS.gcTime,
    ...options,
  });
}

export function useProduct(productId, options = {}) {
  return useQuery({
    queryKey: queryKeys.product(productId),
    queryFn: () => productRepository.getProductById(productId),
    enabled: Boolean(productId),
    staleTime: CACHE_POLICIES.PRODUCTS.staleTime,
    gcTime: CACHE_POLICIES.PRODUCTS.gcTime,
    ...options,
  });
}

// --- Kitchen Stations ---
export function useKitchenStations(branchId = 'branch-main', isActiveOnly = false, options = {}) {
  return useQuery({
    queryKey: queryKeys.kitchenStations(branchId),
    queryFn: () => kitchenStationRepository.getStations(isActiveOnly),
    staleTime: CACHE_POLICIES.KITCHEN_STATIONS.staleTime,
    gcTime: CACHE_POLICIES.KITCHEN_STATIONS.gcTime,
    ...options,
  });
}

// --- Restaurant Settings & Branding ---
export function useRestaurantSettings(branchId = 'branch-main', options = {}) {
  return useQuery({
    queryKey: queryKeys.settings(branchId),
    queryFn: () => settingsRepository.getSettings(),
    staleTime: CACHE_POLICIES.SETTINGS.staleTime,
    gcTime: CACHE_POLICIES.SETTINGS.gcTime,
    ...options,
  });
}

// --- Roles & Permissions ---
export function useRoles(options = {}) {
  return useQuery({
    queryKey: queryKeys.roles(),
    queryFn: () => roleRepository.getRoles(),
    staleTime: CACHE_POLICIES.ROLES_PERMISSIONS.staleTime,
    gcTime: CACHE_POLICIES.ROLES_PERMISSIONS.gcTime,
    ...options,
  });
}

export function usePermissions(options = {}) {
  return useQuery({
    queryKey: queryKeys.permissions(),
    queryFn: () => roleRepository.getPermissions(),
    staleTime: CACHE_POLICIES.ROLES_PERMISSIONS.staleTime,
    gcTime: CACHE_POLICIES.ROLES_PERMISSIONS.gcTime,
    ...options,
  });
}
