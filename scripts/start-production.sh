#!/bin/sh
set -eu

node scripts/migrate.ts
node scripts/seed.ts
exec node server.ts
