#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d .venv ]]; then
  uv venv --python 3.11 .venv
fi

source .venv/bin/activate
uv pip install -e '.[dev]'
python run_server.py
