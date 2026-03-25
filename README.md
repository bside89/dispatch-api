
# 🚀 Order Flow API

## 🚀 TL;DR
API de pedidos construída com NestJS utilizando arquitetura orientada a eventos, filas com BullMQ e padrões Strategy + Factory.

- Processamento assíncrono com filas
- Event Bus desacoplado para notificações
- Idempotência e controle de concorrência
- Logs estruturados com correlação (Pino)
- Observabilidade com Grafana + Loki

👉 Projeto focado em demonstrar arquitetura escalável e boas práticas de backend.

---

## ⚡ Quick Start

```bash
docker-compose up --build
```

Acesse:

- API: http://localhost:3000
- Grafana: http://localhost:3001

---

## 🧠 Arquitetura

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
     Notifications
```

---

## 🤔 Decisões de Arquitetura

- **BullMQ + Redis**: utilizado para processamento assíncrono e resiliência
- **Strategy Pattern**: permite adicionar novos fluxos de negócio sem alterar código existente
- **Event Bus**: desacopla efeitos colaterais (ex: notificações)
- **Idempotência**: evita duplicidade em cenários de retry

---

## 📊 Observabilidade

- Logs estruturados com Pino (JSON)
- Correlation ID para rastreamento de requisições
- Integração com Promtail + Loki
- Visualização via Grafana

Permite rastrear o fluxo completo de um pedido entre múltiplos jobs e eventos.

---

## 🎯 O que este projeto demonstra

- Arquitetura escalável com filas
- Separação de responsabilidades
- Boas práticas de backend
- Processamento assíncrono
- Observabilidade e tracing

---

## 🏗️ Arquitetura (Detalhada)

Este projeto utiliza um estilo **event-driven dentro de um monólito**, garantindo desacoplamento e escalabilidade sem a complexidade de microserviços.

---

## 📦 Stack

- NestJS
- BullMQ + Redis
- PostgreSQL
- Docker
- Grafana + Loki + Promtail
- Pino Logger

---

## 📌 Observações

Projeto focado em demonstrar conhecimento avançado de backend, incluindo:

- Design patterns
- Processamento assíncrono
- Arquitetura desacoplada
- Observabilidade
