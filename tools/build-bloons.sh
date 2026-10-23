#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/encode-rounds.mjs
wat2wasm site/arcade/bloons/engine.wat -o site/arcade/bloons/engine.wasm
wasm-validate site/arcade/bloons/engine.wasm
