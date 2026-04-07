#!/bin/bash

echo "Resetting database and Redis..."
npx ts-node -r tsconfig-paths/register scripts/reset-db.ts
