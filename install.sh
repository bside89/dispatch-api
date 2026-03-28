#!/bin/bash

cp .env.example .env.docker

docker compose up --build
