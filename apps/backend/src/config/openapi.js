/**
 * OpenAPI 3.0.3 Specification for Restaurant POS & KOT Management System (MERN)
 *
 * Full API documentation covering Authentication, Users, Roles, Branches, Areas, Tables,
 * Kitchen Stations, Menu, Orders, KOT & Kitchen, Billing, Payments, Customers, Reports,
 * Notifications, and Audit Logs.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Restaurant POS & KOT Management API',
    version: '1.0.0',
    description:
      'Production-grade Node.js + Express + MongoDB REST API backend for the Restaurant POS & KOT Management System. Fully compatible with Restaurant POS Web and React Native Captain/Kitchen Mobile clients.',
    contact: {
      name: 'Restaurant POS Engineering Team',
    },
  },
  servers: [
    {
      url: 'http://127.0.0.1:8001',
      description: 'Local Development Server (MERN Backend)',
    },
    {
      url: 'http://127.0.0.1:8000',
      description: 'Legacy Django Server (Reference / Read-Only)',
    },
  ],
  tags: [
    { name: 'Health & System', description: 'System health, database connectivity, and readiness probes' },
    { name: 'Auth & Profile', description: 'User login, JWT token refresh, logout, and current user profile' },
    { name: 'Users & Roles', description: 'User account management, role assignment, and permissions' },
    { name: 'Restaurant & Master Data', description: 'Branches, dining areas, tables, kitchen stations, and branding' },
    { name: 'Menu Catalog & Pricing', description: 'Categories, food & beverage products, price updates, and price history' },
    { name: 'Orders & Lifecycle', description: 'Order creation, hold, resume, reception approval, item modification, and status' },
    { name: 'KOT & Kitchen Queue', description: 'Kitchen Order Tickets (KOT), print generation, kitchen queue, and preparation status' },
    { name: 'Billing & Payments', description: 'Bill generation, GST taxes, discounts, split/mixed payments, settlement, and invoices' },
    { name: 'Customers & CRM', description: 'Customer directory, search, profile management, and order history' },
    { name: 'Reports & Analytics', description: 'Sales, item velocity, captain performance, payment breakdown, and cancellations' },
    { name: 'Notifications', description: 'Role-based operational notifications and unread badges' },
    { name: 'Audit Logs', description: 'Security and administrative audit trail with historical tracking' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT access token obtained from `/api/v1/auth/login`. Format: `Bearer <token>`',
      },
    },
    schemas: {
      StandardSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          message: { type: 'string', example: 'Operation completed successfully.' },
        },
      },
      StandardErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                enum: [
                  'VALIDATION_ERROR',
                  'UNAUTHORIZED',
                  'PERMISSION_DENIED',
                  'NOT_FOUND',
                  'CONFLICT',
                  'INVALID_STATE',
                  'CONCURRENT_REQUEST',
                  'INTERNAL_SERVER_ERROR',
                ],
                example: 'VALIDATION_ERROR',
              },
              message: { type: 'string', example: 'Invalid input parameters.' },
              details: { type: 'object' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 100 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 5 },
          hasNext: { type: 'boolean', example: true },
          hasPrev: { type: 'boolean', example: false },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', format: 'password', example: 'admin123' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          tokens: {
            type: 'object',
            properties: {
              access: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
              refresh: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
              tokenType: { type: 'string', example: 'Bearer' },
            },
          },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'usr_001' },
              username: { type: 'string', example: 'admin' },
              displayName: { type: 'string', example: 'System Administrator' },
              email: { type: 'string', example: 'admin@greentandoor.com' },
              mobile: { type: 'string', example: '9876543210' },
              roleIds: { type: 'array', items: { type: 'string' } },
              branchIds: { type: 'array', items: { type: 'string' } },
              isActive: { type: 'boolean', example: true },
            },
          },
          roles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                code: { type: 'string', example: 'ADMIN' },
                name: { type: 'string', example: 'Administrator' },
              },
            },
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            example: ['order.create', 'order.confirm', 'billing.create', 'billing.close'],
          },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refresh'],
        properties: {
          refresh: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'usr_001' },
          _id: { type: 'string', example: 'usr_001' },
          username: { type: 'string', example: 'captain_john' },
          displayName: { type: 'string', example: 'Captain John' },
          email: { type: 'string', example: 'john@greentandoor.com' },
          mobile: { type: 'string', example: '9876543210' },
          roleIds: { type: 'array', items: { type: 'string' } },
          branchIds: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Branch: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'branch-main' },
          _id: { type: 'string', example: 'branch-main' },
          code: { type: 'string', example: 'MAIN' },
          name: { type: 'string', example: 'Main Branch (Gandhinagar)' },
          address: { type: 'string', example: 'Sector 21, Gandhinagar' },
          phone: { type: 'string', example: '9876543210' },
          gstin: { type: 'string', example: '24AAAAA0000A1Z5' },
          requireOrderApproval: { type: 'boolean', example: true },
          isActive: { type: 'boolean', example: true },
        },
      },
      Area: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'area-01' },
          _id: { type: 'string', example: 'area-01' },
          branchId: { type: 'string', example: 'branch-main' },
          name: { type: 'string', example: 'Ground Floor Dining' },
          sortOrder: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
        },
      },
      Table: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'tbl-01' },
          _id: { type: 'string', example: 'tbl-01' },
          branchId: { type: 'string', example: 'branch-main' },
          areaId: { type: 'string', example: 'area-01' },
          tableNumber: { type: 'string', example: 'T-01' },
          capacity: { type: 'integer', example: 4 },
          status: {
            type: 'string',
            enum: ['AVAILABLE', 'ORDER_IN_PROGRESS', 'KOT_SENT', 'PREPARING', 'READY', 'SERVED', 'BILL_PENDING'],
            example: 'AVAILABLE',
          },
          activeOrderId: { type: 'string', nullable: true, example: null },
          isActive: { type: 'boolean', example: true },
        },
      },
      KitchenStation: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ks-tandoor' },
          _id: { type: 'string', example: 'ks-tandoor' },
          branchId: { type: 'string', example: 'branch-main' },
          code: { type: 'string', example: 'TANDOOR' },
          name: { type: 'string', example: 'Tandoor Station' },
          sortOrder: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cat-starters' },
          _id: { type: 'string', example: 'cat-starters' },
          branchId: { type: 'string', example: 'branch-main' },
          code: { type: 'string', example: 'STR' },
          name: { type: 'string', example: 'Tandoori Starters' },
          description: { type: 'string', example: 'Crispy clay oven grilled specialties' },
          kotRequired: { type: 'boolean', example: true },
          sortOrder: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'prod-001' },
          _id: { type: 'string', example: 'prod-001' },
          branchId: { type: 'string', example: 'branch-main' },
          categoryId: { type: 'string', example: 'cat-starters' },
          code: { type: 'string', example: 'PANEER-TIKKA' },
          name: { type: 'string', example: 'Paneer Tikka' },
          description: { type: 'string', example: 'Cottage cheese marinated in spices' },
          currentPrice: { type: 'string', example: '260.00' },
          available: { type: 'boolean', example: true },
          kitchenStation: { type: 'string', example: 'TANDOOR' },
          taxConfig: {
            type: 'object',
            properties: {
              rate: { type: 'string', example: '5.00' },
              mode: { type: 'string', enum: ['EXCLUSIVE', 'INCLUSIVE'], example: 'EXCLUSIVE' },
            },
          },
          isActive: { type: 'boolean', example: true },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ord_123' },
          _id: { type: 'string', example: 'ord_123' },
          orderNumber: { type: 'string', example: 'ORD-29102026-1' },
          branchId: { type: 'string', example: 'branch-main' },
          orderType: { type: 'string', enum: ['DINE_IN', 'TAKE_AWAY', 'ONLINE_ZOMATO', 'ONLINE_SWIGGY'], example: 'DINE_IN' },
          tableId: { type: 'string', nullable: true, example: 'tbl-01' },
          tableNumber: { type: 'string', nullable: true, example: 'T-01' },
          captainId: { type: 'string', example: 'usr_002' },
          captainName: { type: 'string', example: 'Captain Ramesh' },
          customerId: { type: 'string', nullable: true, example: null },
          status: {
            type: 'string',
            enum: ['DRAFT', 'HOLD', 'WAITING_CONFIRMATION', 'KOT_SENT', 'PREPARING', 'READY', 'SERVED', 'BILL_PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED'],
            example: 'KOT_SENT',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                productId: { type: 'string' },
                productName: { type: 'string', example: 'Paneer Tikka' },
                quantity: { type: 'integer', example: 2 },
                unitPrice: { type: 'string', example: '260.00' },
                lineSubtotal: { type: 'string', example: '520.00' },
                lineTotal: { type: 'string', example: '546.00' },
                status: { type: 'string', enum: ['ACTIVE', 'CANCELLED'], example: 'ACTIVE' },
                note: { type: 'string', example: 'Make it spicy' },
              },
            },
          },
          subtotal: { type: 'string', example: '520.00' },
          taxTotal: { type: 'string', example: '26.00' },
          grandTotal: { type: 'string', example: '546.00' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      KOT: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'kot_001' },
          _id: { type: 'string', example: 'kot_001' },
          kotNumber: { type: 'string', example: 'KOT-2026-000001' },
          orderId: { type: 'string', example: 'ord_123' },
          orderNumber: { type: 'string', example: 'ORD-29102026-1' },
          tableNumber: { type: 'string', example: 'T-01' },
          type: { type: 'string', enum: ['NEW', 'MODIFICATION', 'CANCELLATION'], example: 'NEW' },
          revision: { type: 'integer', example: 1 },
          kitchenStation: { type: 'string', example: 'TANDOOR' },
          status: { type: 'string', enum: ['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'], example: 'NEW' },
          printStatus: { type: 'string', enum: ['PENDING', 'PRINTED', 'FAILED'], example: 'PRINTED' },
          items: { type: 'array', items: { type: 'object' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Bill: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'bill_001' },
          _id: { type: 'string', example: 'bill_001' },
          billNumber: { type: 'string', example: 'BILL-2026-000001' },
          orderId: { type: 'string', example: 'ord_123' },
          orderNumber: { type: 'string', example: 'ORD-29102026-1' },
          subtotal: { type: 'string', example: '520.00' },
          discountAmount: { type: 'string', example: '0.00' },
          taxableAmount: { type: 'string', example: '520.00' },
          cgst: { type: 'string', example: '13.00' },
          sgst: { type: 'string', example: '13.00' },
          taxTotal: { type: 'string', example: '26.00' },
          rounding: { type: 'string', example: '0.00' },
          grandTotal: { type: 'string', example: '546.00' },
          paidAmount: { type: 'string', example: '546.00' },
          balanceAmount: { type: 'string', example: '0.00' },
          status: { type: 'string', enum: ['PAYMENT_PENDING', 'PARTIALLY_PAID', 'PAID', 'COMPLETED', 'VOID'], example: 'COMPLETED' },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cust_001' },
          _id: { type: 'string', example: 'cust_001' },
          name: { type: 'string', example: 'Rajesh Patel' },
          phone: { type: 'string', example: '9876543210' },
          email: { type: 'string', example: 'rajesh@example.com' },
          totalVisits: { type: 'integer', example: 5 },
          totalSpend: { type: 'string', example: '3200.00' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'notif_001' },
          _id: { type: 'string', example: 'notif_001' },
          branchId: { type: 'string', example: 'branch-main' },
          type: { type: 'string', example: 'ORDER_SUBMITTED' },
          title: { type: 'string', example: 'New Order Waiting Approval' },
          message: { type: 'string', example: 'Order ORD-29102026-1 on Table T-01 submitted.' },
          recipientRole: { type: 'string', example: 'RECEPTION' },
          isRead: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'audit_001' },
          _id: { type: 'string', example: 'audit_001' },
          branchId: { type: 'string', example: 'branch-main' },
          entityType: { type: 'string', example: 'ORDER' },
          entityId: { type: 'string', example: 'ord_123' },
          action: { type: 'string', example: 'ORDER_CONFIRMED' },
          actorUserId: { type: 'string', example: 'usr_001' },
          actorName: { type: 'string', example: 'Admin User' },
          timestamp: { type: 'string', format: 'date-time' },
          details: { type: 'object' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ==========================================
    // HEALTH & SYSTEM
    // ==========================================
    '/health': {
      get: {
        tags: ['Health & System'],
        summary: 'Liveness & MongoDB health check',
        description: 'Returns health status and active MongoDB connectivity details.',
        security: [],
        responses: {
          200: { description: 'Service is healthy and database is connected' },
          503: { description: 'Database unavailable or degraded' },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health & System'],
        summary: 'Readiness probe',
        description: 'Readiness check for container orchestrators (Kubernetes/Docker).',
        security: [],
        responses: {
          200: { description: 'Service is ready to handle traffic' },
          503: { description: 'Service is not ready' },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Health & System'],
        summary: 'API Health check alias (with /api prefix)',
        security: [],
        responses: { 200: { description: 'Service is healthy' }, 503: { description: 'Degraded' } },
      },
    },
    '/api/ready': {
      get: {
        tags: ['Health & System'],
        summary: 'API Readiness probe alias (with /api prefix)',
        security: [],
        responses: { 200: { description: 'Service is ready' }, 503: { description: 'Not ready' } },
      },
    },
    '/api/schema': {
      get: {
        tags: ['Health & System'],
        summary: 'Get OpenAPI 3.0.3 JSON schema specification',
        security: [],
        responses: { 200: { description: 'OpenAPI JSON specification object' } },
      },
    },

    // ==========================================
    // AUTH & PROFILE
    // ==========================================
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth & Profile'],
        summary: 'User login & JWT issuance',
        description: 'Authenticates username and password. Supports modern Argon2/Bcrypt and legacy Django MD5/PBKDF2 hashes.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Login successful, returns access & refresh tokens and user profile' },
          400: { description: 'Missing username or password' },
          401: { description: 'Invalid credentials' },
          403: { description: 'Account is deactivated' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth & Profile'],
        summary: 'Refresh JWT access token',
        description: 'Issues a new short-lived access token using a valid refresh token.',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: {
          200: { description: 'Access token refreshed successfully' },
          401: { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth & Profile'],
        summary: 'Logout user session',
        description: 'Logs out the current user session and records an audit log event.',
        responses: {
          200: { description: 'Logged out successfully' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/me': {
      get: {
        tags: ['Auth & Profile'],
        summary: 'Get current user profile and effective permissions',
        description: 'Returns profile details, active roles, and flattened permissions array for the authenticated user.',
        responses: {
          200: { description: 'Current authenticated user profile and permissions' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // ==========================================
    // USERS & ROLES
    // ==========================================
    '/api/v1/users': {
      get: {
        tags: ['Users & Roles'],
        summary: 'List users (Paginated)',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          200: { description: 'Paginated user list' },
          403: { description: 'Forbidden (requires user.view permission)' },
        },
      },
      post: {
        tags: ['Users & Roles'],
        summary: 'Create new user account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password', 'displayName', 'roleIds'],
                properties: {
                  username: { type: 'string', example: 'captain_amit' },
                  password: { type: 'string', format: 'password', example: 'secret123' },
                  displayName: { type: 'string', example: 'Captain Amit' },
                  email: { type: 'string', example: 'amit@greentandoor.com' },
                  mobile: { type: 'string', example: '9876543210' },
                  roleIds: { type: 'array', items: { type: 'string' } },
                  branchIds: { type: 'array', items: { type: 'string' } },
                  isActive: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created' },
          409: { description: 'Username already taken' },
        },
      },
    },
    '/api/v1/users/{userId}': {
      get: {
        tags: ['Users & Roles'],
        summary: 'Get user details by ID',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User details' },
          404: { description: 'User not found' },
        },
      },
      patch: {
        tags: ['Users & Roles'],
        summary: 'Update user profile, credentials, or assigned roles',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  displayName: { type: 'string' },
                  email: { type: 'string' },
                  mobile: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                  roleIds: { type: 'array', items: { type: 'string' } },
                  branchIds: { type: 'array', items: { type: 'string' } },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User updated' },
          404: { description: 'User not found' },
        },
      },
    },
    '/api/v1/users/{userId}/activate': {
      post: {
        tags: ['Users & Roles'],
        summary: 'Activate user account',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'User activated' } },
      },
    },
    '/api/v1/users/{userId}/deactivate': {
      post: {
        tags: ['Users & Roles'],
        summary: 'Deactivate user account',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'User deactivated' } },
      },
    },
    '/api/v1/roles': {
      get: {
        tags: ['Users & Roles'],
        summary: 'List all system roles and permissions',
        responses: { 200: { description: 'List of roles' } },
      },
      post: {
        tags: ['Users & Roles'],
        summary: 'Create custom role',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name', 'permissions'],
                properties: {
                  code: { type: 'string', example: 'FLOOR_MANAGER' },
                  name: { type: 'string', example: 'Floor Manager' },
                  description: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Role created' } },
      },
    },
    '/api/v1/roles/{roleId}': {
      get: {
        tags: ['Users & Roles'],
        summary: 'Get role details by ID',
        parameters: [{ name: 'roleId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Role details' } },
      },
      patch: {
        tags: ['Users & Roles'],
        summary: 'Update role permissions and description',
        parameters: [{ name: 'roleId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Role updated' } },
      },
    },

    // ==========================================
    // RESTAURANT & MASTER DATA
    // ==========================================
    '/api/v1/restaurant/branding': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'Get public restaurant branding and workflow settings',
        description: 'Public endpoint returning restaurant name, logos, and requireOrderApproval toggle.',
        security: [],
        parameters: [{ name: 'branchId', in: 'query', schema: { type: 'string', default: 'branch-main' } }],
        responses: { 200: { description: 'Restaurant branding configuration' } },
      },
    },
    '/api/v1/branches': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'List accessible branches',
        responses: { 200: { description: 'List of branches' } },
      },
      post: {
        tags: ['Restaurant & Master Data'],
        summary: 'Create a new branch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name'],
                properties: {
                  code: { type: 'string', example: 'BRANCH-2' },
                  name: { type: 'string', example: 'Kudasan Branch' },
                  address: { type: 'string' },
                  phone: { type: 'string' },
                  gstin: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Branch created' } },
      },
    },
    '/api/v1/branches/{branchId}': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'Get branch settings and profile',
        parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Branch profile and operational settings' } },
      },
      patch: {
        tags: ['Restaurant & Master Data'],
        summary: 'Update branch settings (including order approval workflow and branding)',
        parameters: [{ name: 'branchId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  restaurantName: { type: 'string' },
                  tagline: { type: 'string' },
                  address: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  gstin: { type: 'string' },
                  requireOrderApproval: { type: 'boolean', description: 'Toggle Reception approval workflow' },
                  taxConfig: { type: 'object' },
                  invoiceConfig: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Branch updated' } },
      },
    },
    '/api/v1/areas': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'List dining areas',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'isActiveOnly', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'List of areas' } },
      },
      post: {
        tags: ['Restaurant & Master Data'],
        summary: 'Create dining area',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Rooftop Terrace' },
                  branchId: { type: 'string', example: 'branch-main' },
                  sortOrder: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Area created' } },
      },
    },
    '/api/v1/areas/{areaId}': {
      patch: {
        tags: ['Restaurant & Master Data'],
        summary: 'Update dining area',
        parameters: [{ name: 'areaId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sortOrder: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Area updated' } },
      },
      delete: {
        tags: ['Restaurant & Master Data'],
        summary: 'Delete dining area',
        parameters: [{ name: 'areaId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Area deleted' } },
      },
    },
    '/api/v1/kitchen-stations': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'List kitchen stations',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'isActiveOnly', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'List of kitchen stations' } },
      },
      post: {
        tags: ['Restaurant & Master Data'],
        summary: 'Create kitchen station',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name'],
                properties: {
                  code: { type: 'string', example: 'CHINESE' },
                  name: { type: 'string', example: 'Chinese / Wok Station' },
                  branchId: { type: 'string', example: 'branch-main' },
                  sortOrder: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Kitchen station created' } },
      },
    },
    '/api/v1/kitchen-stations/{stationId}': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'Get kitchen station by ID',
        parameters: [{ name: 'stationId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Kitchen station details' } },
      },
      patch: {
        tags: ['Restaurant & Master Data'],
        summary: 'Update kitchen station',
        parameters: [{ name: 'stationId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sortOrder: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Kitchen station updated' } },
      },
      delete: {
        tags: ['Restaurant & Master Data'],
        summary: 'Delete kitchen station',
        parameters: [{ name: 'stationId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Kitchen station deleted' } },
      },
    },
    '/api/v1/tables': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'List tables & occupancy status',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'areaId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'List of dining tables' } },
      },
      post: {
        tags: ['Restaurant & Master Data'],
        summary: 'Create dining table',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tableNumber', 'capacity'],
                properties: {
                  branchId: { type: 'string', example: 'branch-main' },
                  areaId: { type: 'string', example: 'area-01' },
                  tableNumber: { type: 'string', example: 'T-21' },
                  capacity: { type: 'integer', example: 4 },
                  status: { type: 'string', default: 'AVAILABLE' },
                  isActive: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Table created' },
          409: { description: 'Table number already exists in branch' },
        },
      },
    },
    '/api/v1/tables/{tableId}': {
      get: {
        tags: ['Restaurant & Master Data'],
        summary: 'Get table details by ID (supports tbl-XX and table-XX alias)',
        parameters: [{ name: 'tableId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Table details' } },
      },
      patch: {
        tags: ['Restaurant & Master Data'],
        summary: 'Update table info or occupancy',
        parameters: [{ name: 'tableId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  areaId: { type: 'string' },
                  tableNumber: { type: 'string' },
                  capacity: { type: 'integer' },
                  status: { type: 'string' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Table updated' } },
      },
    },

    // ==========================================
    // MENU CATALOG & PRICING
    // ==========================================
    '/api/v1/menu/categories': {
      get: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'List menu categories',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'isActiveOnly', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'List of menu categories' } },
      },
      post: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Create menu category',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Beverages & Mocktails' },
                  code: { type: 'string', example: 'BEV' },
                  description: { type: 'string' },
                  kotRequired: { type: 'boolean', default: true, description: 'Whether dishes under this category require KOT printing' },
                  sortOrder: { type: 'integer', default: 1 },
                  isActive: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Category created' } },
      },
    },
    '/api/v1/menu/categories/{categoryId}': {
      get: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Get category details',
        parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Category details' } },
      },
      patch: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Update category',
        parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  code: { type: 'string' },
                  description: { type: 'string' },
                  kotRequired: { type: 'boolean' },
                  sortOrder: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Category updated' } },
      },
      delete: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Delete category',
        parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Category deleted' } },
      },
    },
    '/api/v1/menu/products': {
      get: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'List food and beverage products (Paginated)',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'available', in: 'query', schema: { type: 'boolean' } },
          { name: 'isAvailableOnly', in: 'query', schema: { type: 'boolean' } },
          { name: 'station', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'Paginated product list' } },
      },
      post: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Create product',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['categoryId', 'name', 'price'],
                properties: {
                  categoryId: { type: 'string', example: 'cat-starters' },
                  name: { type: 'string', example: 'Paneer Butter Masala' },
                  code: { type: 'string', example: 'PBM-01' },
                  description: { type: 'string' },
                  price: { type: 'string', example: '280.00' },
                  kitchenStation: { type: 'string', example: 'CURRY' },
                  available: { type: 'boolean', default: true },
                  taxConfig: {
                    type: 'object',
                    properties: {
                      rate: { type: 'string', default: '5.00' },
                      mode: { type: 'string', default: 'EXCLUSIVE' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Product created with initial price history record' } },
      },
    },
    '/api/v1/menu/products/{productId}': {
      get: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Get product details by ID',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Product details' } },
      },
      patch: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Update product properties (does not overwrite price)',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  categoryId: { type: 'string' },
                  description: { type: 'string' },
                  available: { type: 'boolean' },
                  kitchenStation: { type: 'string' },
                  sortOrder: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Product updated' } },
      },
      delete: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Delete product',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Product deleted' } },
      },
    },
    '/api/v1/menu/products/{productId}/activate': {
      post: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Activate product',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Product activated' } },
      },
    },
    '/api/v1/menu/products/{productId}/deactivate': {
      post: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Deactivate product',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Product deactivated' } },
      },
    },
    '/api/v1/menu/products/{productId}/price': {
      post: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Update product price (creates immutable price history record)',
        description: 'Accepts `price` or `newPrice` for cross-client compatibility. Appends record to `price_history`.',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: {
                  price: { type: 'string', example: '300.00' },
                  newPrice: { type: 'string', example: '300.00' },
                  reason: { type: 'string', example: 'Ingredient cost revision Q4' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Product price updated' } },
      },
    },
    '/api/v1/menu/products/{productId}/price-history': {
      get: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Get immutable price audit history for product',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'List of historical price adjustments' } },
      },
    },
    '/api/v1/menu/products/{productId}/price-history/{historyId}': {
      delete: {
        tags: ['Menu Catalog & Pricing'],
        summary: 'Delete price history record (Admin/Owner only)',
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'historyId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Price history record deleted' } },
      },
    },

    // ==========================================
    // ORDERS & LIFECYCLE
    // ==========================================
    '/api/v1/orders': {
      get: {
        tags: ['Orders & Lifecycle'],
        summary: 'List orders (Paginated)',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', description: 'Comma-separated statuses supported (e.g. SERVED,READY,KOT_SENT)' } },
          { name: 'tableId', in: 'query', schema: { type: 'string' } },
          { name: 'captainId', in: 'query', schema: { type: 'string' } },
          { name: 'customerId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated order list' } },
      },
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Create new order (Table, Take Away, or Online)',
        description: 'Supports Table Dine-In, Take Away, and Online orders. Auto-approves to KOT if requireOrderApproval is disabled.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  branchId: { type: 'string', example: 'branch-main' },
                  orderType: { type: 'string', enum: ['DINE_IN', 'TAKE_AWAY', 'ONLINE_ZOMATO', 'ONLINE_SWIGGY'], default: 'DINE_IN' },
                  tableId: { type: 'string', example: 'tbl-01' },
                  customerId: { type: 'string' },
                  notes: { type: 'string' },
                  held: { type: 'boolean', default: false },
                  submitImmediately: { type: 'boolean', default: false },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'quantity'],
                      properties: {
                        productId: { type: 'string', example: 'prod-001' },
                        quantity: { type: 'integer', example: 2 },
                        note: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Order created' },
          409: { description: 'Table is already occupied by an active order' },
        },
      },
    },
    '/api/v1/orders/history': {
      get: {
        tags: ['Orders & Lifecycle'],
        summary: 'Order history & sales analytics aggregation',
        description: 'Returns aggregated sales metrics, category breakdown, daily breakdown, and filtered order list.',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'month', in: 'query', schema: { type: 'string', example: '2026-10' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', example: '2026-10-01' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', example: '2026-10-31' } },
          { name: 'customerId', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'Aggregated order history and sales breakdown' } },
      },
    },
    '/api/v1/orders/{orderId}': {
      get: {
        tags: ['Orders & Lifecycle'],
        summary: 'Get order details by ID',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Full order details and captured item snapshots' } },
      },
    },
    '/api/v1/orders/{orderId}/submit': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Submit order for Reception review / confirmation',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Order submitted to Reception' } },
      },
    },
    '/api/v1/orders/{orderId}/hold': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Put order on hold',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Order placed on hold' } },
      },
    },
    '/api/v1/orders/{orderId}/resume': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Resume order from hold',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Order resumed to draft' } },
      },
    },
    '/api/v1/orders/{orderId}/confirm': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Confirm order at Reception & issue KOT to kitchen',
        description: 'Moves order to KOT_SENT, creates initial NEW KOT, and dispatches real-time notifications to kitchen.',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Order confirmed and KOT generated' } },
      },
    },
    '/api/v1/orders/{orderId}/reject': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Reception rejects order with reason',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', example: 'Item out of stock' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Order rejected and table released' } },
      },
    },
    '/api/v1/orders/{orderId}/items': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Add or modify items on order',
        description: 'If order was already confirmed, automatically issues a MODIFICATION KOT (Revision N+1) to kitchen.',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'quantity'],
                      properties: {
                        productId: { type: 'string' },
                        quantity: { type: 'integer' },
                        note: { type: 'string' },
                      },
                    },
                  },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Items modified and modification KOT issued' } },
      },
    },
    '/api/v1/orders/{orderId}/cancel': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Cancel entire order with reason',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', example: 'Customer left' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Order cancelled, table released, and CANCELLATION KOT generated' } },
      },
    },
    '/api/v1/orders/{orderId}/cancel-item': {
      post: {
        tags: ['Orders & Lifecycle'],
        summary: 'Cancel specific order item',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['itemId', 'reason'],
                properties: {
                  itemId: { type: 'string' },
                  reason: { type: 'string', example: 'Customer changed their mind' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Item cancelled and pending bill recalculated' } },
      },
    },
    '/api/v1/orders/{orderId}/events': {
      get: {
        tags: ['Orders & Lifecycle'],
        summary: 'Get immutable order event timeline',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Order timeline events' } },
      },
    },

    // ==========================================
    // KOT & KITCHEN QUEUE
    // ==========================================
    '/api/v1/kots': {
      get: {
        tags: ['KOT & Kitchen Queue'],
        summary: 'List Kitchen Order Tickets (Paginated)',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'orderId', in: 'query', schema: { type: 'string' } },
          { name: 'kitchenStation', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'Paginated KOT list' } },
      },
    },
    '/api/v1/kots/{kotId}': {
      get: {
        tags: ['KOT & Kitchen Queue'],
        summary: 'Get KOT details by ID',
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'KOT details' } },
      },
    },
    '/api/v1/kots/{kotId}/status': {
      post: {
        tags: ['KOT & Kitchen Queue'],
        summary: 'Update KOT status (Kitchen preparation flow)',
        description: 'Transitions KOT status: NEW -> PREPARING -> READY -> SERVED. Creates real-time captain alert when READY.',
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['PREPARING', 'READY', 'SERVED', 'CANCELLED'], example: 'READY' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'KOT status updated' } },
      },
    },
    '/api/v1/kots/{kotId}/print': {
      get: {
        tags: ['KOT & Kitchen Queue'],
        summary: 'Get thermal KOT print payload',
        description: 'Read-only payload formatted for ESC/POS thermal printers.',
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'KOT thermal print payload' } },
      },
    },
    '/api/v1/kots/{kotId}/print-status': {
      post: {
        tags: ['KOT & Kitchen Queue'],
        summary: 'Update KOT print status',
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['printStatus'],
                properties: {
                  printStatus: { type: 'string', enum: ['PENDING', 'PRINTED', 'FAILED'], example: 'PRINTED' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'KOT print status updated' } },
      },
    },
    '/api/v1/kitchen/queue': {
      get: {
        tags: ['KOT & Kitchen Queue'],
        summary: 'Live kitchen preparation queue',
        description: 'Returns active KOTs (status NEW or PREPARING) with computed elapsedMinutes for Kitchen Display System (KDS).',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'kitchenStation', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Active KOTs with elapsed waiting time' } },
      },
    },

    // ==========================================
    // BILLING & PAYMENTS
    // ==========================================
    '/api/v1/orders/{orderId}/bill': {
      post: {
        tags: ['Billing & Payments'],
        summary: 'Generate bill for order (Idempotent)',
        description: 'Generates or recalculates the customer bill for an order with GST and rounding. Transitions table to BILL_PENDING.',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  discount: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['FIXED', 'PERCENTAGE'], example: 'PERCENTAGE' },
                      value: { type: 'string', example: '10' },
                      reason: { type: 'string', example: 'Corporate customer discount' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Active bill retrieved' },
          201: { description: 'New bill generated' },
        },
      },
    },
    '/api/v1/bills': {
      get: {
        tags: ['Billing & Payments'],
        summary: 'List bills (Paginated)',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'orderId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated bill list' } },
      },
    },
    '/api/v1/bills/{billId}': {
      get: {
        tags: ['Billing & Payments'],
        summary: 'Get bill details with payments and taxes',
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Bill details' } },
      },
    },
    '/api/v1/bills/{billId}/discount': {
      post: {
        tags: ['Billing & Payments'],
        summary: 'Apply discount to bill',
        description: 'Percentage discounts above 20% require manager approval permission (discount.approve).',
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'value', 'reason'],
                properties: {
                  type: { type: 'string', enum: ['FIXED', 'PERCENTAGE'], example: 'PERCENTAGE' },
                  value: { type: 'string', example: '15.00' },
                  reason: { type: 'string', example: 'Anniversary celebration' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Discount applied and totals recalculated' },
          403: { description: 'Discount >20% requires manager approval' },
        },
      },
    },
    '/api/v1/bills/{billId}/payments': {
      get: {
        tags: ['Billing & Payments'],
        summary: 'List recorded payments for bill',
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'List of payments' } },
      },
      post: {
        tags: ['Billing & Payments'],
        summary: 'Add payment to bill (Supports Split / Mixed payments)',
        description: 'Records payment via CASH, UPI, CARD, or OTHER. Updates paidAmount and balanceAmount.',
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mode', 'amount'],
                properties: {
                  mode: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'OTHER'], example: 'UPI' },
                  amount: { type: 'string', example: '500.00' },
                  referenceNumber: { type: 'string', example: 'UPI-REF-998822' },
                  idempotencyKey: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Payment recorded' },
          400: { description: 'Payment amount exceeds outstanding balance' },
        },
      },
    },
    '/api/v1/bills/{billId}/close': {
      post: {
        tags: ['Billing & Payments'],
        summary: 'Close bill and complete order',
        description: 'Enforces zero balance due. Marks order COMPLETED, releases table to AVAILABLE, and records customer loyalty visit.',
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Bill closed and table released' },
          409: { description: 'Cannot close bill with outstanding balance' },
        },
      },
    },
    '/api/v1/bills/{billId}/print': {
      get: {
        tags: ['Billing & Payments'],
        summary: 'Get thermal Tax Invoice print payload',
        description: 'Read-only print payload; does not alter payment balance or mark bill closed.',
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Tax Invoice print payload' } },
      },
      post: {
        tags: ['Billing & Payments'],
        summary: 'Get thermal Tax Invoice print payload (POST alias)',
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Tax Invoice print payload' } },
      },
    },

    // ==========================================
    // CUSTOMERS & CRM
    // ==========================================
    '/api/v1/customers': {
      get: {
        tags: ['Customers & CRM'],
        summary: 'Search customer directory (Paginated)',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string', description: 'Name or phone query' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated customer search results' } },
      },
      post: {
        tags: ['Customers & CRM'],
        summary: 'Create customer profile',
        description: 'Normalizes phone to 10 digits and upserts by (branchId, phone) to prevent duplicates.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone'],
                properties: {
                  name: { type: 'string', example: 'Pooja Shah' },
                  phone: { type: 'string', example: '9825012345' },
                  email: { type: 'string', example: 'pooja@example.com' },
                  address: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Customer profile created or updated' } },
      },
    },
    '/api/v1/customers/{customerId}': {
      get: {
        tags: ['Customers & CRM'],
        summary: 'Get customer profile by ID',
        parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Customer profile' } },
      },
      patch: {
        tags: ['Customers & CRM'],
        summary: 'Update customer profile',
        parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  address: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Customer profile updated' } },
      },
    },
    '/api/v1/customers/{customerId}/orders': {
      get: {
        tags: ['Customers & CRM'],
        summary: 'Get customer past order history',
        parameters: [
          { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Past orders for this customer' } },
      },
    },

    // ==========================================
    // REPORTS & ANALYTICS
    // ==========================================
    '/api/v1/reports/sales': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Sales Summary Report',
        description: 'Aggregates settled bills (PAID/COMPLETED) across date ranges with totals, taxes, and discounts.',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', example: '2026-10-01' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', example: '2026-10-31' } },
        ],
        responses: { 200: { description: 'Sales summary report' } },
      },
    },
    '/api/v1/reports/items': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Item Sales & Product Velocity Report',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Item-level sales performance' } },
      },
    },
    '/api/v1/reports/captains': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Captain Performance Report',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Orders and sales per captain' } },
      },
    },
    '/api/v1/reports/payments': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Payment Methods Breakdown Report',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Collections breakdown by payment method' } },
      },
    },
    '/api/v1/reports/discounts': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Discounts Audit Report',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Discounts granted with reasons' } },
      },
    },
    '/api/v1/reports/cancellations': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Cancellations Audit Report',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Cancelled orders and items with reasons' } },
      },
    },

    // ==========================================
    // NOTIFICATIONS
    // ==========================================
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get active notifications for current user/role',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'unreadOnly', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'List of operational notifications' } },
      },
    },
    '/api/v1/notifications/{notificationId}/read': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
        parameters: [{ name: 'notificationId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notification marked as read' } },
      },
    },

    // ==========================================
    // AUDIT LOGS
    // ==========================================
    '/api/v1/audit': {
      get: {
        tags: ['Audit Logs'],
        summary: 'List security and operational audit logs (Paginated)',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'entityId', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'actorId', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated audit logs' } },
      },
    },
    '/api/v1/audit/{id}': {
      get: {
        tags: ['Audit Logs'],
        summary: 'Get audit log entry by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Audit log entry' } },
      },
    },
    '/api/v1/audit/cleanup': {
      post: {
        tags: ['Audit Logs'],
        summary: 'Purge historical audit logs older than N days',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { days: { type: 'integer', default: 30 } },
              },
            },
          },
        },
        responses: { 200: { description: 'Cleanup complete' } },
      },
    },
  },
};
export default openApiSpec;
