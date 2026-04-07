#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ROOT_DIR}/api/.venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Missing ${PYTHON_BIN}. Create the backend virtualenv first." >&2
  exit 1
fi

cd "${ROOT_DIR}/api"
PYTHONPATH=. "${PYTHON_BIN}" "${ROOT_DIR}/scripts/export_openapi.py"

cd "${ROOT_DIR}/web"
npx openapi-typescript ./src/lib/generated/openapi.json -o ./src/lib/generated/api-types.d.ts
