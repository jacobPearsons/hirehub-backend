#!/bin/bash
set -euo pipefail

echo "Resetting database..."

cd "$(dirname "$0")/.."

echo "Dropping and recreating database..."
npx prisma migrate reset --force

echo "Seeding default roles..."
npx prisma db seed

echo "Database reset complete."
