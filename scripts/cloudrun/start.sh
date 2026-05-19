#!/bin/sh
set -e
echo "Starting CMS (PORT=${PORT:-unset}, NODE_ENV=${NODE_ENV:-unset})"
echo "PAYLOAD_SECRET: $([ -n "${PAYLOAD_SECRET:-}" ] && echo set || echo MISSING)"
echo "DATABASE_URL: $([ -n "${DATABASE_URL:-}" ] && echo set || echo MISSING)"
exec node server.js
