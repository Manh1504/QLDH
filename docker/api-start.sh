#!/bin/sh
set -e
# Migrate DB rồi mới chạy API (an toàn chạy nhiều lần)
npx prisma migrate deploy --schema packages/db/schema.prisma
node apps/api/dist/main.js
