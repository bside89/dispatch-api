# OrderFlow

**A robust API for intelligent order processing** built with NestJS, implementing event-driven architecture with PostgreSQL, Redis for caching and BullMQ queues for asynchronous processing.

## 🚀 Features

- **Complete CRUD for Orders** with Order Items
- **Automatic Swagger documentation**
- **Redis caching** for performance optimization
- **Asynchronous order processing** with BullMQ queues
- **Queue monitoring** with BullBoard dashboard (protected with Basic Auth)
- **Data validation** with class-validator
- **Pagination** and advanced filtering
- **Event-driven architecture** for status updates
- **TypeORM** for PostgreSQL ORM

## 🛠️ Technologies

- **NestJS** - Progressive Node.js framework
- **PostgreSQL** - Relational database
- **TypeORM** - TypeScript ORM
- **Redis** - In-memory cache
- **BullMQ** - Redis-based queue system for job processing
- **BullBoard** - Queue monitoring dashboard
- **Swagger/OpenAPI** - API documentation
- **Docker** - Containerization

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

### Orders

- `POST /orders` - Create a new order
- `GET /orders` - List orders with pagination and filters
- `GET /orders/:id` - Get order by ID
- `GET /orders/customer/:customerId` - Get orders of a customer
- `PATCH /orders/:id` - Update order
- `PATCH /orders/:id/status` - Update status only
- `DELETE /orders/:id` - Delete order

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

The `POST /orders` endpoint implements idempotency to prevent creation of duplicate orders.

### How to Use

1. **Required header**: Include the `Idempotency-Key` header with a unique key (UUID recommended)
2. **Cache**: Response is stored in Redis for 24 hours
3. **Behavior**: If the same key is used again, the original order is returned

### Example with cURL

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
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

### Expected Behavior

- ✅ **First request**: Creates the order and returns Status 201
- ✅ **Subsequent requests** (same key): Returns the same order (Status 201)

### Benefits

- **Avoids duplicate orders** in case of client application retries
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
- Individual order cache by ID
- Customer orders cache
- Paginated lists cache
- Idempotency key cache (24h TTL)
- Configurable TTL (default: 5 minutes)

### Queue Strategy
- **BullMQ** for reliable job processing
- **Redis** as the queue backend
- **Retry policies** with exponential backoff
- **Job prioritization** and delayed execution
- **Real-time monitoring** via BullBoard dashboard

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
│   ├── cache/       # Redis cache module
│   ├── common/      # Shared enums and utilities
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
├── app.module.ts    # Main module (includes BullBoard setup)
└── main.ts         # Entry point
```

## � Environment Variables

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
```

### Admin Security

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

⚠️ **Security Warning**: Always use strong, unique credentials in production environments!

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
