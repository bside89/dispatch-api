# OrderFlow

**A robust API for intelligent order processing** built with NestJS, implementing event-driven architecture with PostgreSQL, Redis for caching and BullMQ queues for asynchronous processing.

## 🚀 Features

### Core Functionality

- **Complete CRUD for Orders** with Order Items
- **Complete CRUD for Users** with idempotency support
- **Advanced pagination** and filtering for all endpoints
- **Event-driven architecture** for status updates

### Authentication & Security

- **JWT Authentication** with Access and Refresh tokens (15min/7days)
- **Role-based authorization** (USER, ADMIN) with custom decorators
- **Secure password hashing** with Argon2ID algorithm
- **Rate limiting/Throttling** protection (10 req/min configurable)
- **HTTP security headers** with Helmet middleware
- **Idempotency support** for critical operations (with Redis cache)

### Performance & Monitoring

- **Redis caching** with intelligent TTL management
- **Asynchronous processing** with BullMQ job queues
- **Queue monitoring dashboard** (BullBoard) with Basic Auth protection
- **Automatic Swagger documentation** with OpenAPI 3.0
- **Structured logging** with detailed operation tracking

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

- **JWT (JSON Web Tokens)** - Secure authentication with refresh tokens
- **Passport.js** - Authentication middleware with JWT strategy
- **Argon2ID** - Advanced password hashing algorithm
- **Helmet** - Security headers middleware
- **@nestjs/throttler** - Rate limiting and DDoS protection

### Queues & Background Jobs

- **BullMQ** - Redis-based robust queue system
- **BullBoard** - Real-time queue monitoring dashboard

### API & Documentation

- **Swagger/OpenAPI** - Interactive API documentation
- **class-validator/transformer** - Request validation and transformation

### Deployment & Infrastructure

- **Docker & Docker Compose** - Containerization
- **Environment Configuration** - Flexible env-based setup

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

## 📊 Queue Monitoring

### BullBoard Dashboard

Monitor your queue jobs in real-time:

- **URL**: http://localhost:3000/admin/queues
- **Features**:
  - View active, completed, and failed jobs
  - Retry failed jobs
  - Real-time job statistics
  - Queue performance metrics
- **Protected**: Requires Basic Authentication (see API Documentation section)

### Monitored Queues

- **order-processing**: Handles all order-related background jobs
  - `process-order`: Process new orders asynchronously
  - `status-update`: Handle order status changes
  - `cancel-order`: Process order cancellations

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

## 🎯 Cache & Queue Strategy

### Cache Strategy
- **Individual resource cache**: Orders and Users by ID
- **Collection cache**: Customer orders, user listings
- **Paginated results cache**: Filtered and sorted data
- **Idempotency key cache**: Orders (24h TTL), Users (1h TTL)
- **Intelligent TTL**: Orders (5min), Users (1h), configurable per resource
- **Pattern-based invalidation**: Efficient cache cleanup on updates
- **Redis backend**: `cache-manager` with Redis store for persistence

### Authentication Cache Strategy
- **JWT token cache**: Access token validation (in-memory)
- **User session cache**: Active user data for performance
- **Refresh token rotation**: Secure token management

### Queue Strategy
- **BullMQ** for reliable job processing with Redis persistence
- **Strategy Pattern**: Modular job handlers (process-order, status-update, cancel-order)
- **Factory Pattern**: Dynamic job handler creation and routing
- **Retry policies**: 3 attempts with exponential backoff (3s base delay)
- **Job prioritization**: High priority for critical operations
- **Delayed execution**: Scheduled jobs for time-based processing
- **Real-time monitoring**: BullBoard dashboard with job details
- **Graceful cleanup**: Failed jobs auto-removed after 24h

## 🧪 Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
````

## 🔧 Useful Scripts

```bash
# Setup and Development
npm run setup         # First time: install deps + start containers
npm run dev           # Start infrastructure + app in watch mode

# Queue Dashboard Access
# After starting the app, visit http://localhost:3000/admin/queues
# Default credentials: admin / admin123 (configurable via .env)

# Local Debug 🐞
npm run debug         # Complete debug setup + asks if you want to start
npm run debug:local   # Containers + app in debug mode (port 9229)
npm run start:debug   # App only with debugger enabled

# Development
npm run start:dev     # Start in watch mode
npm run start:debug   # Start with debugger

# Build
npm run build         # Compile the project

# Database
npm run migration:generate  # Generate new migration
npm run migration:run       # Run migrations
npm run migration:revert    # Revert last migration

# Docker
npm run docker:up     # Start infrastructure containers
npm run docker:down   # Stop containers
npm run docker:logs   # View container logs
npm run docker:status # Container status

# Environment Control
npm run stop          # Stop all services
npm run reset         # Complete reset (remove data)

# Linting and Tests
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
npm test              # Unit tests
npm run test:e2e      # E2E tests
npm run test:cov      # Coverage
```

## 🐛 Debug and Logs

- Structured logs with context
- Different log levels per environment
- Performance monitoring with metrics
- **Queue monitoring** via BullBoard dashboard at `/admin/queues`
- **Job debugging**: View job payloads, execution times, and failure reasons
- **Real-time updates**: Monitor queue performance in real-time

## 📁 Project Structure

```
src/
├── config/          # Configurations (DB, Redis, BullMQ)
├── controllers/     # Admin controllers (queue dashboard auth)
├── middleware/      # Custom middleware (Basic Auth)
├── modules/
│   ├── auth/        # JWT Authentication module
│   │   ├── decorators/  # @Public, @Roles decorators
│   │   ├── dto/         # Login DTOs
│   │   ├── enums/       # JWT strategy enums
│   │   ├── guards/      # JWT guards, roles guard
│   │   ├── strategies/  # JWT & refresh strategies
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── cache/       # Redis cache module
│   │   ├── cache.service.ts
│   │   └── cache.module.ts
│   ├── common/      # Shared enums and utilities
│   ├── user/        # Users module with CRUD & idempotency
│   │   ├── dto/         # User DTOs
│   │   ├── entities/    # User entity
│   │   ├── enums/       # User roles and status
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.module.ts
│   └── order/       # Orders module
│       ├── dto/     # Data Transfer Objects
│       ├── entities/ # TypeORM entities
│       ├── enums/   # Order status and job enums
│       ├── factories/ # Job and strategy factories
│       ├── interfaces/ # Job interfaces
│       ├── strategies/ # Order processing strategies
│       ├── order.controller.ts
│       ├── order.service.ts
│       ├── order.processor.ts  # BullMQ job processor
│       └── order.module.ts
├── app.module.ts    # Main module (includes auth, throttling, BullBoard)
└── main.ts         # Entry point with security middleware
```

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
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=15m
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

## �🚀 Deploy

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
