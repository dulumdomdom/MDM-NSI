#!/bin/sh
# MDM NSI: start on an offline Linux / macOS PC.  ./start-linux.sh [port]
cd "$(dirname "$0")" || exit 1
exec python3 serve.py "${1:-8080}"
