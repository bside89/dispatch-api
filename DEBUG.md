# 🐞 Local Debug Guide

This guide shows how to configure and use the local development environment for debugging the OrderFlow API.

## ⚡ Quick Debug Setup

### **Option 1: Automatic Script (Recommended)**

```bash
npm run debug
```

This script will:

- ✅ Check if Docker is running
- ✅ Start infrastructure services (PostgreSQL, Redis)
- ✅ Wait for services to be ready
- ✅ Ask if you want to start the application automatically

### **Option 2: Manual**

```bash
# 1. Start infrastructure services
npm run docker:up

# 2. Start application in debug mode
npm run start:debug
```

### **Option 3: Ultra Fast**

```bash
# Combines both commands
npm run debug:local
```

## 🎯 Debug Commands

| Command               | Description                                    |
| --------------------- | ---------------------------------------------- |
| `npm run debug`       | Complete setup + asks if you want to start app |
| `npm run debug:local` | Containers + app in debug mode                 |
| `npm run start:debug` | App only in debug mode (port 9229)             |
| `npm run start:dev`   | App in development mode (watch)                |

## 🔧 VS Code Debug Setup

### **1. Use the existing configuration:**

- Press `F5` or go to **Run and Debug**
- Select **"Debug NestJS"**
- The application will start in debug mode

### **2. Available configurations:**

- **Debug NestJS**: Starts the application in debug mode
- **Attach to NestJS**: Connects to an already running application

### **3. Breakpoints:**

- Click on the left margin of the editor to create breakpoints
- Breakpoints work on any `.ts` file in the project
- Use `debugger;` in code for hard breakpoints

## 🐳 Container Control

```bash
# Container status
npm run docker:status

# Container logs
npm run docker:logs

# Stop containers
npm run docker:down

# Restart containers
npm run docker:down && npm run docker:up
```

## 🌐 Important URLs

During local development:

| Service        | URL                            | Credentials       |
| -------------- | ------------------------------ | ----------------- |
| **API**        | http://localhost:3000          | -                 |
| **Swagger**    | http://localhost:3000/api/docs | -                 |
| **PostgreSQL** | localhost:5432                 | postgres/postgres |
| **Redis**      | localhost:6379                 | -                 |

## 🔍 Queue Debug (Bull)

### **Monitor Jobs:**

```javascript
// In code, add logs to the processor
console.log('Processing job:', job.data);
```

### **View queues in Redis:**

```bash
# Connect to Redis container
docker exec -it $(docker-compose ps -q redis) redis-cli

# List all queue keys
KEYS *order-processing*

# View queue details
LRANGE bull:order-processing:waiting 0 -1
```

## 📊 Logs and Monitoring

### **Structured logs:**

- The application is already configured with NestJS Logger
- Logs appear in terminal with colors and context

### **Environment variables for debug:**

Add to `.env`:

```bash
# More verbose logs
LOG_LEVEL=debug

# Show SQL queries
TYPEORM_LOGGING=true

# Redis Cache debug
CACHE_DEBUG=true
```

## 🎯 Typical Debug Workflow

### **1. Start environment:**

```bash
npm run debug    # Or npm run debug:local for direct
```

### **2. Configure breakpoints:**

- Open the files you want to debug
- Click on the left margin to create breakpoints
- Or add `debugger;` in the code

### **3. Make requests:**

- Use the `api-examples.http` file
- Or access http://localhost:3000/api/docs (Swagger)
- Or use Postman/Insomnia

### **4. Debug:**

- The application will pause at breakpoints
- Use F10 (step over), F11 (step into), F5 (continue)
- Inspect variables in VS Code panel

## 🚨 Troubleshooting

### **Problem: Containers won't start**

```bash
# Check if Docker is running
docker info

# View error logs
docker-compose logs

# Complete reset
npm run reset
```

### **Problem: Application doesn't connect to DB**

```bash
# Check if PostgreSQL is running
docker-compose ps

# Test manual connection
docker exec -it $(docker-compose ps -q postgres) psql -U postgres -d order_processing
```

### **Problem: Hot reload doesn't work**

```bash
# Check if you're using npm run start:dev
npm run start:dev

# Check if file is being watched
# See logs when saving a file
```

### **Problem: Debugger doesn't stop at breakpoints**

1. Check if you're using `npm run start:debug`
2. Make sure VS Code is connected (port 9229)
3. Try using `debugger;` in code instead of visual breakpoints

## 💡 Advanced Tips

### **1. Test Debug:**

```bash
# Debug unit tests
npm run test:debug

# Debug e2e tests
npm run test:e2e -- --runInBand
```

### **2. Workers/Jobs Debug:**

```typescript
// In order.processor.ts, add detailed logs
@Process('process-order')
async processOrder(job: Job<OrderProcessJob>): Promise<void> {
  console.log('🔄 Starting job:', job.id, job.data);
  // your code here
  console.log('✅ Job completed:', job.id);
}
```

### **3. Cache Debug:**

```typescript
// Check what's in cache
const cached = await this.cacheManager.get('order:123');
console.log('Cache value:', cached);
```

### **4. TypeORM Debug:**

In `.env`, add:

```bash
TYPEORM_LOGGING=true
```

To see all executed SQL queries.

## 🎨 Recommended VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "editor.formatOnSave": true,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

This will automatically format and save, triggering hot reload.

---

## 🚀 Start now:

```bash
npm run debug
```

Then press `F5` in VS Code to start debugging! 🎯
