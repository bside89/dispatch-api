# OrderFlow

**A robust API for intelligent order processing** built with NestJS, implementing event-driven architecture with PostgreSQL, Redis for caching and BullMQ queues for asynchronous processing.

## 🚀 Features

- **Complete CRUD for Orders** with Order Items
- **Automatic Swagger documentation**
- **Redis caching** for performance optimization
- **Asynchronous order processing** with Bull queues
- **Data validation** with class-validator
- **Pagination** and advanced filtering
- **Event-driven architecture** for status updates
- **TypeORM** for PostgreSQL ORM

## 🛠️ Technologies

- **NestJS** - Progressive Node.js framework
- **PostgreSQL** - Relational database
- **TypeORM** - TypeScript ORM
- **Redis** - In-memory cache
- **Bull** - Redis-based queue system
- **Swagger/OpenAPI** - API documentation
- **Docker** - Containerization

## 📋 Prerequisites

- Node.js (v18+)
- npm or yarn
- Docker and Docker Compose

## 🔧 Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd orderflow
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   ```bash
   cp .env.example .env
   # Edit the .env file as needed
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

After starting the application, access the Swagger documentation at:

- **Swagger UI**: http://localhost:3000/api/docs

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

## ⚡ Event-Driven Features

### Workers/Processors

The application uses Bull queues for asynchronous processing:

1. **process-order** - Processes new orders
2. **status-update** - Handles status changes
3. **cancel-order** - Processes cancellations

### Order Status

- `PENDING` - Awaiting processing
- `CONFIRMED` - Confirmed
- `PROCESSING` - Being processed
- `SHIPPED` - Shipped
- `DELIVERED` - Delivered
- `CANCELLED` - Cancelled
- `REFUNDED` - Refunded

## 🎯 Cache Strategy

- Individual order cache by ID
- Customer orders cache
- Paginated lists cache
- Configurable TTL (default: 5 minutes)

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

## 📁 Project Structure

```
src/
├── config/          # Configurations (DB, Redis, Bull)
├── modules/
│   └── order/       # Orders module
│       ├── dto/     # Data Transfer Objects
│       ├── entities/ # TypeORM entities
│       ├── enums/   # Enumerations
│       ├── order.controller.ts
│       ├── order.service.ts
│       ├── order.processor.ts
│       └── order.module.ts
├── app.module.ts    # Main module
└── main.ts         # Entry point
```

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
