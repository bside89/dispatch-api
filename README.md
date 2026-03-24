# OrderFlow

**A production-ready API for intelligent order processing** built with NestJS, featuring advanced JWT authentication, event-driven architecture with Design Patterns (Factory & Strategy), PostgreSQL with TypeORM, Redis caching, and BullMQ queues for enterprise-grade asynchronous processing.

## 🚀 Features

### Core Functionality

- **Complete CRUD for Orders** with Order Items and advanced entity relationships
- **Complete CRUD for Users** with enterprise-grade idempotency support
- **Advanced pagination** and intelligent filtering for all endpoints
- **Event-driven architecture** with sophisticated status management
- **Design Patterns Implementation** - Factory and Strategy patterns for extensible job processing
- **Enterprise-grade Cache Strategy** with Redis and pattern-based invalidation

### Authentication & Security

- **Advanced JWT Authentication** with dual-token system (Access 15min/Refresh 7days)
- **Enterprise Role-based Authorization** (USER, ADMIN) with custom decorators and guards
- **Military-grade Password Security** with Argon2ID algorithm (quantum-resistant)
- **Multi-layered Protection** - Rate limiting, DDoS protection, request throttling
- **Security Headers** - Helmet middleware with CSP, HSTS, and XSS protection
- **Idempotency Framework** for critical operations with Redis-backed caching
- **Basic Auth Protection** for admin dashboards with configurable credentials
- **Input Sanitization** - Global validation pipes with whitelist and forbidNonWhitelisted

### Performance & Monitoring

- **Intelligent Redis Caching** - Pattern-based invalidation, TTL optimization, and session management
- **Advanced Asynchronous Processing** - BullMQ with Factory/Strategy patterns for job handling
- **Enterprise Queue Monitoring** - BullBoard dashboard with real-time metrics and job analytics
- **Auto-generated API Documentation** - Enhanced Swagger/OpenAPI 3.0 with organized tags
- **Production-grade Logging** - Structured logging with context tracking and job monitoring
- **Performance Optimization** - Connection pooling, horizontal scaling readiness
- **Health Monitoring** - Built-in health checks and observability features

### Data & Validation

- **Data validation** with class-validator and transformation
- **TypeORM** for PostgreSQL with entity relationships
- **Global validation pipes** with whitelist and transformation

## 🛠️ Technologies

### Core Framework

- **NestJS** - Progressive Node.js framework with TypeScript
- **TypeORM** - TypeScript-first ORM for PostgreSQL

### Database & Cache

- **PostgreSQL** - Robust relational database
- **Redis** - In-memory cache and queue backend
- **Cache Manager** - Intelligent caching with Redis store

### Authentication & Security

- **Advanced JWT Strategy** - Dual-token authentication with Passport.js integration
- **Passport.js Framework** - JWT and refresh token strategies for enterprise security
- **Argon2ID Encryption** - Quantum-resistant password hashing algorithm
- **Helmet Security Suite** - Comprehensive HTTP security headers framework
- **@nestjs/throttler** - Enterprise-grade rate limiting and DDoS protection
- **Custom Guards & Decorators** - JwtAuthGuard, RolesGuard, @Public(), @Roles()

### Queues & Background Jobs

- **BullMQ (Latest)** - Advanced Redis-based queue system (migrated from Bull)
- **BullBoard Dashboard** - Real-time queue monitoring and job management interface
- **Design Patterns Integration** - Factory and Strategy patterns for job processing
- **Job Processing Strategies** - ProcessOrderStrategy, StatusUpdateStrategy, CancelOrderStrategy

### API & Documentation

- **Swagger/OpenAPI** - Interactive API documentation
- **class-validator/transformer** - Request validation and transformation

### Deployment & Infrastructure

- **Docker & Docker Compose** - Containerization
- **Environment Configuration** - Flexible env-based setup

## 🏗️ Architecture & Design Patterns

### Enterprise Design Patterns

#### 🏭 **Factory Pattern Implementation**

- **JobHandlerFactory** - Dynamic creation of job processing strategies
- **StatusActionFactory** - Status-specific action handler creation
- **Extensible Registration** - Easy addition of new job types without code modification
- **Runtime Strategy Selection** - Intelligent handler selection based on job type

#### 🎯 **Strategy Pattern Implementation**

- **JobProcessingStrategy** - Base interface for all job processing strategies
- **BaseJobStrategy** - Abstract foundation with common functionality
- **Concrete Strategies:**
  - `ProcessOrderStrategy` - New order processing logic
  - `StatusUpdateStrategy` - Order status transition management
  - `CancelOrderStrategy` - Order cancellation workflows
  - `Status-specific Actions` - Confirmed, Shipped, Delivered, Cancelled handlers

#### 📦 **Repository Pattern with TypeORM**

- **Entity-based Architecture** - Clean separation of data access
- **Advanced Relationships** - User ↔ Order ↔ OrderItem mappings
- **Query Optimization** - Indexed fields and connection pooling

### Architectural Benefits

- ✅ **High Maintainability** - Each component has single responsibility
- ✅ **Easy Testing** - Mockable strategies and isolated unit testing
- ✅ **Horizontal Scalability** - Event-driven processing with queue distribution
- ✅ **Code Extensibility** - Add new features without modifying existing code

## 📋 Prerequisites

- Node.js (v18+)
- npm or yarn
- Docker and Docker Compose

## 🔧 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/bside89/order-flow-api.git
   cd order-flow-api
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   ```bash
   cp .env.example .env
   # Edit the .env file as needed
   # Important: Configure ADMIN_USERNAME and ADMIN_PASSWORD for queue dashboard security
   ```

4. **Start infrastructure services:**

   ```bash
   docker-compose up -d
   ```

5. **Run database migrations:**

   ```bash
   npm run migration:run
   ```

6. **Start the application:**

   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

## 🐞 **Local Debug**

For local development and debugging, we have specific commands:

```bash
# Complete debug setup (recommended)
npm run debug

# Or direct command
npm run debug:local
```

📖 **[See Complete Debug Guide](DEBUG.md)** - Detailed instructions for VS Code debugging, breakpoints, queue monitoring, etc.

## 📚 API Documentation

After starting the application, access the documentation and monitoring tools at:

- **Swagger UI**: http://localhost:3000/api/docs
- **Queue Dashboard**: http://localhost:3000/admin/queues (requires authentication)

### 🔐 Queue Dashboard Authentication

The BullBoard dashboard is protected with Basic Authentication:

- **Username**: `admin` (configurable via `ADMIN_USERNAME`)
- **Password**: `admin123` (configurable via `ADMIN_PASSWORD`)

⚠️ **Security Note**: Change these credentials in production by updating the environment variables.

## 🐳 Docker Services

The `docker-compose.yml` file includes:

- **PostgreSQL** (port 5432) - Main database
- **Redis** (port 6379) - Cache and BullMQ queues

## 🔌 Main Endpoints

### Authentication

- `POST /auth/login` - User authentication (returns access + refresh tokens)
- `POST /auth/refresh` - Refresh access token using refresh token
- `POST /auth/logout` - Logout and invalidate tokens

### Users

- `POST /users` - Create a new user (with idempotency support)
- `GET /users` - List users with pagination and filters
- `GET /users/:id` - Get user by ID
- `PATCH /users/:id` - Update user information
- `PATCH /users/:id/login` - Update user login credentials
- `DELETE /users/:id` - Delete user

### Orders

- `POST /orders` - Create a new order (with idempotency support)
- `GET /orders` - List orders with pagination and filters
- `GET /orders/:id` - Get order by ID
- `GET /orders/customer/:customerId` - Get orders of a customer
- `PATCH /orders/:id` - Update order
- `PATCH /orders/:id/status` - Update status only
- `DELETE /orders/:id` - Delete order

### Example Payload to Create User

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "role": "USER"
}
```

### Example Authentication Flow

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!"
  }'

# Response includes:
# {
#   "access_token": "eyJ...",
#   "refresh_token": "eyJ...",
#   "user": { "id": "uuid", "name": "John Doe", ... }
# }

# 2. Use access token for protected routes
curl -X GET http://localhost:3000/orders \
  -H "Authorization: Bearer <access_token>"

# 3. Refresh when access token expires
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer <refresh_token>"
```

### Example Payload to Create Order

```json
{
  "customerId": "customer-123",
  "items": [
    {
      "productId": "product-456",
      "quantity": 2,
      "price": 149.99
    },
    {
      "productId": "product-789",
      "quantity": 1,
      "price": 79.99
    }
  ]
}
```

## 🔒 Idempotency

Both `POST /orders` and `POST /users` endpoints implement idempotency to prevent creation of duplicate resources.

### How to Use

1. **Required header**: Include the `Idempotency-Key` header with a unique key (UUID recommended)
2. **Cache**: Response is stored in Redis with appropriate TTL (24h for orders, 1h for users)
3. **Behavior**: If the same key is used again, the original resource is returned

### Example with cURL (Orders)

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "customerId": "customer-123",
    "items": [
      {
        "productId": "product-456",
        "quantity": 1,
        "price": 99.99
      }
    ]
  }'
```

### Example with cURL (Users)

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440001" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "role": "USER"
  }'
```

### Expected Behavior

- ✅ **First request**: Creates the resource and returns Status 201
- ✅ **Subsequent requests** (same key): Returns the same resource (Status 201)

### Benefits

- **Avoids duplicate resources** in case of client application retries
- **Security on unstable networks** where requests can be lost
- **REST API compatibility** following idempotency standards

````

## 📀 Advanced Queue Monitoring & Job Processing

### Enterprise BullBoard Dashboard

Powered by the latest BullMQ technology with comprehensive monitoring:

- **URL**: http://localhost:3000/admin/queues
- **Advanced Features**:
  - 📊 Real-time job performance analytics
  - 🔍 Advanced filtering and search capabilities
  - 🕑 Detailed execution timelines and bottleneck analysis
  - 🔄 Smart retry policies and failure root-cause analysis
  - 📍 Job payload inspection for debugging
  - 📈 Queue throughput and latency metrics
- **Security**: Enhanced Basic Authentication with environment-configurable credentials

### Smart Job Processing Architecture

#### Design Pattern Integration
- **Factory Pattern**: `JobHandlerFactory` dynamically creates appropriate handlers
- **Strategy Pattern**: Modular, interchangeable job processing strategies
- **Event-driven**: Loose coupling between job creation and processing
- **Extensible**: Add new job types without modifying existing code

#### Production-grade Queue Configuration

**order-processing** queue with intelligent job routing:
- ⚙️ `process-order` - Handles new orders using ProcessOrderStrategy
- 🔄 `status-update` - Manages status transitions using StatusUpdateStrategy
- ❌ `cancel-order` - Processes cancellations using CancelOrderStrategy

#### Enterprise Job Features
- **Retry Policies**: Exponential backoff with 3 intelligent retry attempts
- **Job Prioritization**: Critical operations get high priority processing
- **Delayed Execution**: Schedule jobs for future processing
- **Graceful Cleanup**: Auto-removal of failed jobs after 24 hours
- **Error Analytics**: Detailed failure tracking with root cause identification
- **Circuit Breaker**: Fail-fast mechanism for cascading failure prevention

## 🛡️ Rate Limiting & Security

### Rate Limiting (Throttling)

The API includes built-in rate limiting to prevent abuse:

- **Default limit**: 10 requests per minute per IP
- **Window**: 60 seconds (rolling window)
- **Response**: HTTP 429 (Too Many Requests) when exceeded
- **Headers**: Includes rate limit information in response headers

#### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
```

#### Custom Rate Limits

Some endpoints may have custom limits:

```typescript
@Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 req/min for sensitive operations
@Post('/auth/login')
async login() { ... }
```

### Security Features

- **Helmet middleware**: Adds security headers (HSTS, CSP, etc.)
- **CORS protection**: Configured for allowed origins
- **Input validation**: All requests validated and sanitized
- **JWT security**: Tokens with configurable expiration
- **Password security**: Argon2ID hashing with salt

## ⚡ Event-Driven Features

### Workers/Processors

The application uses BullMQ queues for asynchronous processing:

1. **process-order** - Validates and processes new orders
2. **status-update** - Handles order status transitions and notifications
3. **cancel-order** - Processes order cancellations and cleanup

**Queue Configuration:**
- **Retry Policy**: 3 attempts with 3-second backoff
- **Job Cleanup**: Failed jobs removed after 24 hours
- **Monitoring**: All jobs visible in BullBoard dashboard

### Order Status

- `PENDING` - Awaiting processing
- `CONFIRMED` - Confirmed
- `PROCESSING` - Being processed
- `SHIPPED` - Shipped
- `DELIVERED` - Delivered
- `CANCELLED` - Cancelled
- `REFUNDED` - Refunded

## 🎯 Enterprise Cache & Queue Strategy

### Advanced Caching Architecture

#### Intelligent Cache Management
- **Multi-layer Caching**: Individual resources, collections, and computed results
- **Smart TTL Strategy**:
  - Orders: 5 minutes (frequently changing data)
  - Users: 1 hour (stable data)
  - Sessions: 15 minutes (security balance)
  - Paginated Results: Custom TTL based on query complexity
- **Pattern-based Invalidation**: Efficient cache cleanup using Redis patterns (`user:*`, `order:*`)
- **Cache Warming**: Pre-population of frequently accessed data

#### Redis-powered Performance
- **Custom CacheService**: Sophisticated wrapper around cache-manager
- **Connection Pooling**: Optimized Redis connections for high throughput
- **Memory Management**: Automatic cleanup and LRU eviction policies
- **Idempotency Support**: 24h TTL for orders, 1h for users

### Production Queue Strategy

#### BullMQ Advanced Features
- **Event-driven Processing**: Decoupled job creation and execution
- **Design Patterns Integration**:
  - **Strategy Pattern**: Pluggable job processing algorithms
  - **Factory Pattern**: Dynamic handler creation and registration
  - **State Pattern**: Order status transition management

#### Reliability & Scalability
- **Exponential Backoff**: 3 attempts with progressive delay (3s base)
- **Job Prioritization**: Critical operations processed first
- **Dead Letter Queue**: Analysis of permanently failed jobs
- **Horizontal Scaling**: Multiple worker processes for high throughput
- **Graceful Shutdown**: Clean job completion during deployments

### Authentication Cache Strategy
- **JWT Token Validation**: In-memory cache for performance
- **Session Management**: Redis-backed user session storage
- **Refresh Token Rotation**: Automatic token refresh with security
- **Blacklist Management**: Invalid token tracking for security

## 🚀 Recent Updates & Migrations

### 🔄 **Bull to BullMQ Migration**
- ✅ **Successfully migrated** from deprecated Bull to modern BullMQ
- ✅ **Performance boost** with improved Redis connection handling
- ✅ **Enhanced reliability** with better error handling and job recovery
- ✅ **API compatibility** maintained for seamless transition
- 📚 **[Complete Migration Guide](tmp/MIGRATION-BULLMQ.md)** - Detailed documentation

### 🎨 **Design Patterns Implementation**
- ✅ **Factory Pattern** - Dynamic job handler creation system
- ✅ **Strategy Pattern** - Pluggable job processing algorithms
- ✅ **Repository Pattern** - Clean data access layer with TypeORM
- ✅ **Decorator Pattern** - Enhanced authentication and authorization
- 📚 **[Design Patterns Guide](tmp/DESIGN_PATTERNS.md)** - Architecture documentation

### 🔒 **Security Enhancements**
- ✅ **Argon2ID Implementation** - Quantum-resistant password hashing
- ✅ **Advanced JWT Strategy** - Dual-token system with refresh mechanism
- ✅ **Multi-layered Rate Limiting** - DDoS protection and request throttling
- ✅ **Enhanced Validation** - Global pipes with whitelist and sanitization
- ✅ **Security Headers** - Comprehensive HTTP security with Helmet

### ⚙️ **Infrastructure Improvements**
- ✅ **Docker Configuration** - Optimized containers with health checks
- ✅ **Development Scripts** - Automated setup, debug, and reset workflows
- ✅ **Database Migrations** - Type-safe migrations with TypeORM
- ✅ **Connection Pooling** - Performance optimization for high load
- ✅ **Environment Configuration** - Flexible and secure config management

## 🧪 Enterprise Testing Suite

### Production-Ready Testing

```bash
# Unit Tests - Comprehensive service and controller testing
npm run test

# End-to-End Tests - Full application workflow testing
npm run test:e2e

# Coverage Analysis - Detailed test coverage reporting
npm run test:cov

# Watch Mode - Continuous testing during development
npm run test:watch
```

### Testing Architecture
- **Unit Tests**: Individual service and controller testing with mocking
- **Integration Tests**: Database and external service integration
- **E2E Tests**: Complete API workflow testing with TestingModule
- **Coverage Reports**: Comprehensive code coverage analysis
- **Mocking Strategy**: Clean mocking of dependencies for isolated testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
````

## 🔧 Advanced Development Scripts

### 🚀 **Setup & Environment Management**

```bash
# 🎯 Complete Development Setup
npm run setup         # Automated: deps + containers + migrations
npm run dev           # Full stack: infrastructure + app + hot reload
npm run reset         # Nuclear option: complete environment reset

# 🐞 Advanced Debugging
npm run debug         # Interactive debug setup with VS Code integration
npm run debug:local   # Quick: containers + app in debug mode (port 9229)
npm run start:debug   # App-only debug with breakpoint support
```

### 📈 **Queue & Monitoring Access**

```bash
# After starting the app:
# 📊 Queue Dashboard: http://localhost:3000/admin/queues
# 🔑 Default credentials: admin / admin123 (configurable via .env)
# 📄 API Documentation: http://localhost:3000/api/docs
```

### 📦 **Database Management**

```bash
# 🔄 Migration Workflow
npm run migration:generate -- -n MigrationName  # Generate new migration
npm run migration:run                          # Apply pending migrations
npm run migration:revert                       # Rollback last migration

# 🚑 Database Recovery
npm run fix-db        # Automated database issue resolution
npm run create-db     # Fresh database creation with schema
```

### 🐳 **Docker & Infrastructure**

```bash
# 🏭 Container Management
npm run docker:up     # Start PostgreSQL + Redis containers
npm run docker:down   # Graceful container shutdown
npm run docker:logs   # Real-time container log streaming
npm run docker:status # Health check and status overview
```

### 🧪 **Quality Assurance**

```bash
# 🔍 Code Quality
npm run lint          # ESLint with automated fixes
npm run format        # Prettier code formatting
npm run type-check    # TypeScript strict type checking

# 🏃 Testing Suite
npm test              # Unit tests with Jest
npm run test:e2e      # End-to-end integration tests
npm run test:cov      # Coverage analysis and reporting
npm run test:watch    # Continuous testing mode
```

## 🐛 Debug and Logs

- Structured logs with context
- Different log levels per environment
- Performance monitoring with metrics
- **Queue monitoring** via BullBoard dashboard at `/admin/queues`
- **Job debugging**: View job payloads, execution times, and failure reasons
- **Real-time updates**: Monitor queue performance in real-time

## 📁 Enterprise Project Architecture

```
src/
├── config/                    # 🔧 Advanced Configuration Layer
│   ├── bullmq.config.ts          # BullMQ enterprise queue configuration
│   ├── redis.config.ts           # Redis connection pooling + caching
│   └── typeorm.config.ts         # Database configuration + migrations
│
├── controllers/               # 🔐 Administrative Controllers
│   └── admin.controller.ts       # Queue dashboard authentication
│
├── middleware/                # 🛡️ Security & Custom Middleware
│   └── basic-auth.middleware.ts  # Enhanced Basic Auth for admin routes
│
├── modules/                   # 🏢 Feature-based Module Architecture
│   ├── auth/                   # 🔑 Advanced JWT Authentication
│   │   ├── decorators/             # @Public, @Roles custom decorators
│   │   ├── dto/                   # Login/Response DTOs with validation
│   │   ├── enums/                 # JWT strategy type definitions
│   │   ├── guards/                # JWT, Refresh, Roles guards
│   │   ├── interfaces/            # JWT payload type definitions
│   │   ├── strategies/            # Passport JWT + Refresh strategies
│   │   ├── auth.controller.ts     # Authentication endpoints
│   │   ├── auth.service.ts        # Business logic + Argon2ID
│   │   └── auth.module.ts         # Module configuration
│   │
│   ├── cache/                  # ⚡ Intelligent Cache Management
│   │   ├── cache.service.ts       # Custom cache service with patterns
│   │   └── cache.module.ts        # Redis cache configuration
│   │
│   ├── common/                 # 🔧 Shared Components
│   │   ├── enums/                 # Global enumerations
│   │   └── middleware/            # Shared middleware components
│   │
│   ├── user/                   # 👥 User Management Module
│   │   ├── dto/                   # User DTOs with comprehensive validation
│   │   ├── entities/              # TypeORM User entity with relationships
│   │   ├── enums/                 # User roles and status enumerations
│   │   ├── user.controller.ts     # RESTful user endpoints
│   │   ├── user.service.ts        # User business logic + idempotency
│   │   └── user.module.ts         # User module configuration
│   │
│   └── order/                  # 📦 Order Processing with Design Patterns
│       ├── dto/                   # Data Transfer Objects with validation
│       ├── entities/              # Order + OrderItem TypeORM entities
│       ├── enums/                 # Order status and job type enumerations
│       │
│       ├── factories/             # 🏭 Factory Pattern Implementation
│       │   ├── job-handler.factory.ts      # Dynamic job handler creation
│       │   ├── status-action.factory.ts    # Status-specific action factory
│       │   └── index.ts                   # Factory pattern exports
│       │
│       ├── interfaces/            # Type definitions for job contracts
│       │   ├── cancel-order-job.interfaces.ts
│       │   ├── order-process-job.interfaces.ts
│       │   └── status-update-job.interfaces.ts
│       │
│       ├── strategies/            # 🎯 Strategy Pattern Implementation
│       │   ├── job-processing.strategy.ts      # Base strategy interface
│       │   ├── process-order.strategy.ts       # New order processing
│       │   ├── status-update.strategy.ts       # Status transition logic
│       │   ├── cancel-order.strategy.ts        # Cancellation workflows
│       │   ├── status-actions.strategy.ts      # Status-specific actions
│       │   └── index.ts                       # Strategy exports
│       │
│       ├── order.controller.ts    # RESTful order management API
│       ├── order.service.ts       # Order business logic + caching
│       ├── order.processor.ts     # ⚙️ BullMQ job processor with patterns
│       └── order.module.ts        # Order module configuration
│
├── app.module.ts              # 📋 Main application module
└── main.ts                   # 🚀 Application bootstrap with security

# 🚀 Development & Infrastructure
scripts/                      # Automated development workflows
├── setup.sh                    # Complete environment setup
├── dev.sh                      # Development mode with hot reload
├── debug.sh                    # Enhanced debugging setup
├── fix-db.sh                   # Database recovery automation
├── reset.sh                    # Nuclear reset option
└── stop.sh                     # Graceful service shutdown

# 📋 Documentation & Examples
root/
├── api-examples.http           # 📚 Comprehensive API testing scenarios
├── DEBUG.md                    # 🐞 Complete debugging guide
├── docker-compose.yml          # 🐳 Production-ready container setup
└── tmp/
    ├── DESIGN_PATTERNS.md      # 🎨 Architecture documentation
    ├── MIGRATION-BULLMQ.md     # 🔄 Migration detailed guide
    └── PACKAGE-UPDATES.md      # 📦 Dependency update history
```

### 🏆 **Architectural Highlights**

- ✅ **Clean Architecture** - Separation of concerns with feature modules
- ✅ **Design Patterns** - Factory, Strategy, Repository, and Decorator patterns
- ✅ **Security First** - Multi-layered authentication and authorization
- ✅ **Enterprise Ready** - Production-grade configuration and monitoring
- ✅ **Developer Experience** - Comprehensive tooling and automation
- ✅ **Type Safety** - Full TypeScript with strict type checking
- ✅ **Testing Support** - Comprehensive test coverage with mocking strategies

## 🌐 Environment Variables

Create a `.env` file based on `.env.example` and configure the following variables:

### Database

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=order_processing
```

### Redis

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
```

### Application

```env
APP_PORT=3000
APP_ENV=development
NODE_ENV=development
```

### Authentication & Security

```env
# JWT Configuration
JWT_ACCESS_SECRET=your-super-access-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-refresh-secret-jwt-key-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=10
```

### Admin Security

```env
# BullBoard Dashboard Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Alternative names (legacy support)
BULLBOARD_USERNAME=admin
BULLBOARD_PASSWORD=admin123
```

### Cache Configuration

```env
# Cache TTL (in seconds)
CACHE_TTL=300
USER_CACHE_TTL=3600
```

⚠️ **Security Warning**: Always use strong, unique credentials and secrets in production environments!

## 🏆 Why This Project is Production-Ready

### 🔒 **Enterprise Security**

- **Military-grade Authentication** - JWT with Argon2ID quantum-resistant hashing
- **Multi-layered Authorization** - Role-based access control with custom guards
- **Security Hardening** - Helmet, rate limiting, input validation, and CORS protection
- **Admin Protection** - Basic Auth for sensitive dashboards with configurable credentials

### ⚡ **Performance & Scalability**

- **Intelligent Caching** - Redis-powered with pattern-based invalidation and TTL optimization
- **Asynchronous Processing** - BullMQ job queues with retry policies and error handling
- **Connection Pooling** - Optimized database connections for high-load environments
- **Horizontal Scaling** - Event-driven architecture ready for microservices deployment

### 🎨 **Clean Architecture**

- **Design Patterns** - Factory and Strategy patterns for maintainable, extensible code
- **Type Safety** - Full TypeScript with strict checking and comprehensive interfaces
- **Clean Code** - SOLID principles, separation of concerns, and feature-based modules
- **Repository Pattern** - Clean data access layer with TypeORM entity relationships

### 🛠️ **Developer Experience**

- **Automated Setup** - One-command environment setup with Docker and script automation
- **Advanced Debugging** - VS Code integration, breakpoints, and comprehensive logging
- **Comprehensive Testing** - Unit, integration, and E2E tests with coverage reporting
- **Live Documentation** - Auto-generated Swagger docs with real-time API examples

### 📊 **Monitoring & Observability**

- **Real-time Queue Monitoring** - BullBoard dashboard with job analytics and performance metrics
- **Structured Logging** - Context-aware logging throughout the application lifecycle
- **Health Checks** - Built-in application and database health monitoring
- **Error Tracking** - Comprehensive error handling with root cause analysis

### 🛡️ **Production Features**

- **Idempotency Support** - Critical operations protected against duplicate execution
- **Graceful Degradation** - Circuit breakers and fallback mechanisms
- **Environment Flexibility** - Comprehensive configuration management
- **Migration Support** - Type-safe database migrations with rollback capabilities

## 🚀 Deploy

1. **Build the application:**

   ```bash
   npm run build
   ```

2. **Configure production variables**

3. **Run in production:**
   ```bash
   npm run start:prod
   ```

## 🤝 Contributing

1. Fork the project
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is under the MIT license.
