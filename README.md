# 🚀 Order Flow API

![Node](https://img.shields.io/badge/node-20+-green)
![NestJS](https://img.shields.io/badge/nestjs-backend-red)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 💡 Overview

A production-inspired Order Management API built with NestJS, designed to demonstrate scalable backend architecture using asynchronous processing, event-driven design, and industry-standard patterns.

This project simulates a real-world order lifecycle, focusing on performance, resilience, and observability.

---

## 🚀 Why this project matters

Modern backend systems require:

- Handling high throughput asynchronously
- Decoupling services for scalability
- Observability across distributed flows
- Safe retries without duplication

This project demonstrates how to achieve all of the above **without the complexity of microservices**.

---

## ⚡ Quick Start

**Create a .env.docker file** (you can copy the .env.example one available in the code)

In the Terminal, type:

```bash
docker-compose up --build
```

Access:

- API: http://localhost:3000
- Bull Board: http://localhost:3000/bull-board
- Grafana: http://localhost:3001

---

## 🧠 Architecture Overview

```
Client → API (NestJS)
        ↓
     Orders Module
        ↓
     BullMQ Queue
        ↓
     Workers (Strategies)
        ↓
     Event Bus
        ↓
     Notifications / Side Effects
```

---

## 🧩 Architecture Highlights

- **Event-driven within a monolith**  
  Achieves decoupling without operational overhead

- **Queue-based processing (BullMQ)**  
  Enables retries, backoff strategies, and scalability

- **Strategy + Factory patterns**  
  Flexible and extensible workflow handling

- **Idempotent job execution**  
  Guarantees safe retries and consistency

- **Centralized logging with correlationId**  
  Full traceability across async flows

---

## 🔄 Order Processing Flow

1. Order is created via API
2. Job is added to queue
3. Worker processes using strategy
4. Events are emitted
5. Side effects are triggered (notifications, logs)

---

## 📊 Observability & Monitoring

- Structured logging with Pino (JSON)
- Correlation ID for end-to-end tracing
- Log aggregation via Promtail + Loki
- Visualization with Grafana

✔ Track a single order across multiple async steps  
✔ Debug failures in distributed flows

---

## ⚙️ Features

- Order creation and lifecycle processing
- Multi-stage async pipeline (process → ship → deliver)
- Job chaining and orchestration
- Decoupled notification system
- Idempotency for jobs and events
- Authentication with multi-device support
- Refresh token hashing
- Secure logout (session invalidation)

---

## ⚖️ Engineering Trade-offs

| Decision                    | Reason                                |
| --------------------------- | ------------------------------------- |
| Monolith over Microservices | Reduced operational complexity        |
| BullMQ over Kafka           | Simpler setup, sufficient for scale   |
| Partial Event-Driven        | Applied only where it adds real value |

---

## 📦 Tech Stack

- NestJS
- BullMQ + Redis
- PostgreSQL
- Docker
- Grafana + Loki + Promtail
- Pino Logger

---

## 🧪 Production Considerations

This project includes patterns commonly used in production systems:

- Retry strategies with backoff
- Failure isolation via queues
- Observability-first design
- Scalable processing pipelines

---

## 📌 What this demonstrates

- Real-world backend architecture
- Clean code and separation of concerns
- Practical use of design patterns
- Async workflows and resilience
- Monitoring and debugging strategies

---

## 📬 Final Notes

This project was built to showcase backend engineering skills at a professional level, focusing on scalability, maintainability, and real-world applicability.
