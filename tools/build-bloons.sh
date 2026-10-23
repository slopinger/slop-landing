#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
wat2wasm assembly/bloons.wat -o site/arcade/bloons/engine.wasm
wasm-validate site/arcade/bloons/engine.wasm
cp assembly/bloons.wat site/arcade/bloons/engine.wat
