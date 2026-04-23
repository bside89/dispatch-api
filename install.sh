#!/bin/bash

cp .env.example .env.local
cp .env.example .env.production

docker compose up --build
