import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ProtectedRoute } from './ProtectedRoute';
import { PermissionGuard } from './PermissionGuard';
import { PERMISSIONS } from '../constants/permissions';

// Layouts
import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Phase 1 Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { ProfilePage } from '../pages/auth/ProfilePage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { CategoriesPage } from '../pages/menu/CategoriesPage';
import { ProductsPage } from '../pages/menu/ProductsPage';
import { TablesPage } from '../pages/tables/TablesPage';
import { UsersPage } from '../pages/users/UsersPage';
import { RolesPage } from '../pages/users/RolesPage';
import { AuditPage } from '../pages/audit/AuditPage';
import { UnauthorizedPage } from '../pages/error/UnauthorizedPage';
import { NotFoundPage } from '../pages/error/NotFoundPage';

// Phase 2 Pages
import { OrdersPage } from '../pages/orders/OrdersPage';
import { CreateOrderPage } from '../pages/orders/CreateOrderPage';
import { OrderHistoryPage } from '../pages/orders/OrderHistoryPage';
import { ReceptionPage } from '../pages/reception/ReceptionPage';
import { KitchenPage } from '../pages/kitchen/KitchenPage';

// Phase 3 Pages
import { BillingPage } from '../pages/billing/BillingPage';
import { CustomersPage } from '../pages/customers/CustomersPage';
import { ReportsPage } from '../pages/reports/ReportsPage';

// Phase 4 Pages
import { ShiftsPage } from '../pages/shifts/ShiftsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

export const AppRoutes = () => {
  const { user, role } = useAuth();
  const isCaptain = role === 'captain' || user?.role === 'captain';
  const defaultHome = isCaptain ? '/tables' : '/dashboard';

  return (
    <Routes>
      {/* Auth Public Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to={defaultHome} replace />} />
        <Route path="/dashboard" element={isCaptain ? <Navigate to="/tables" replace /> : <DashboardPage />} />

        {/* Phase 2: Operations Workflow */}
        <Route
          path="/orders"
          element={
            <PermissionGuard permissions={[PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CONFIRM, PERMISSIONS.TABLE_VIEW]}>
              <OrdersPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/orders/new"
          element={
            <PermissionGuard permission={PERMISSIONS.ORDER_CREATE}>
              <CreateOrderPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/orders/history"
          element={
            <PermissionGuard permissions={[PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CONFIRM, PERMISSIONS.REPORT_VIEW, PERMISSIONS.BILLING_GENERATE]}>
              <OrderHistoryPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/reception"
          element={
            <PermissionGuard permission={PERMISSIONS.ORDER_CONFIRM}>
              <ReceptionPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/kitchen"
          element={
            <PermissionGuard permission={PERMISSIONS.KOT_VIEW}>
              <KitchenPage />
            </PermissionGuard>
          }
        />

        {/* Phase 3: Billing, Customers & Reports */}
        <Route
          path="/billing"
          element={
            <PermissionGuard permissions={[PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]}>
              <BillingPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/customers"
          element={
            <PermissionGuard permission={PERMISSIONS.CUSTOMER_VIEW}>
              <CustomersPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/reports"
          element={
            <PermissionGuard permission={PERMISSIONS.REPORT_VIEW}>
              <ReportsPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/shifts"
          element={
            <PermissionGuard permissions={[PERMISSIONS.PAYMENT_COLLECT, PERMISSIONS.BILLING_GENERATE, PERMISSIONS.REPORT_VIEW]}>
              <ShiftsPage />
            </PermissionGuard>
          }
        />

        {/* Tables */}
        <Route
          path="/tables"
          element={
            <PermissionGuard permission={PERMISSIONS.TABLE_VIEW}>
              <TablesPage />
            </PermissionGuard>
          }
        />

        {/* Menu */}
        <Route
          path="/menu/categories"
          element={
            <PermissionGuard permission={PERMISSIONS.MENU_VIEW}>
              <CategoriesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/menu/products"
          element={
            <PermissionGuard permission={PERMISSIONS.MENU_VIEW}>
              <ProductsPage />
            </PermissionGuard>
          }
        />

        {/* Administration */}
        <Route
          path="/users"
          element={
            <PermissionGuard permission={PERMISSIONS.USER_MANAGE}>
              <UsersPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/roles"
          element={
            <PermissionGuard permission={PERMISSIONS.ROLE_MANAGE}>
              <RolesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/audit"
          element={
            <PermissionGuard permission={PERMISSIONS.AUDIT_VIEW}>
              <AuditPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <PermissionGuard permission={PERMISSIONS.SETTINGS_MANAGE}>
              <SettingsPage />
            </PermissionGuard>
          }
        />

        {/* Account Profile */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Error States */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
