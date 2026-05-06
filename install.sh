#!/bin/bash

cp .env.example.local .env.local
cp .env.example.production .env.production

docker compose --env-file .env.production up --build
