# 🚀 Order Flow API

![Node](https://img.shields.io/badge/node-20+-green)
![NestJS](https://img.shields.io/badge/nestjs-backend-red)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 🚀 TL;DR

API de pedidos construída com NestJS utilizando arquitetura orientada a eventos (dentro de um monólito), filas com BullMQ e padrões Strategy + Factory.

- Processamento assíncrono com filas
- Event Bus desacoplado
- Idempotência e controle de concorrência
- Logs estruturados com correlationId
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
     Notifications / Side Effects
```

---

## 🤔 Decisões de Arquitetura

- BullMQ + Redis
  → processamento assíncrono e resiliência
- Strategy Pattern
  → facilita extensão de fluxos sem alterar código existente
- Factory Pattern
  → criação dinâmica de handlers
- Event Bus
  → desacopla efeitos colaterais (notificações, logs, etc.)
- Idempotência
  → evita duplicidade em cenários de retry

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
- Processamento assíncrono
- Boas práticas de backend
- Observabilidade e tracing
- Design patterns aplicados na prática

---

## 🏗️ Arquitetura (Detalhada)

Este projeto utiliza um estilo event-driven dentro de um monólito, garantindo:

- Desacoplamento entre fluxos
- Facilidade de evolução
- Menor complexidade operacional que microserviços

---

## ⚙️ Features

- Criação e processamento de pedidos
- Pipeline assíncrono com múltiplos estágios
- Encadeamento de jobs (process → ship → deliver)
- Sistema de notificações desacoplado
- Idempotência em jobs e eventos
- Suporte a múltiplos dispositivos (auth)
- Refresh token com hash
- Logout com invalidação de sessão

---

## ⚖️ Trade-offs

- Monólito vs Microservices
  → Escolhido monólito para reduzir complexidade operacional
- BullMQ vs Kafka
  → BullMQ é mais simples e suficiente para o escopo atual
- Event-driven parcial
  → Aplicado apenas onde agrega valor (jobs e notificações)

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
