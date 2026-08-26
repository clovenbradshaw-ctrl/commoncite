#!/bin/bash
# Runs the local import service (scripts/import-server.mjs) alongside vite,
# so the browser's own import UI has something real to talk to. vite proxies
# /local-import/* to it (see vite.config.ts). Killed automatically when vite
# exits or this script is interrupted.
set -e

node scripts/import-server.mjs &
IMPORT_SERVER_PID=$!
trap 'kill "$IMPORT_SERVER_PID" 2>/dev/null' EXIT INT TERM

WRANGLER_LOG_PATH=.wrangler/wrangler.log vite
