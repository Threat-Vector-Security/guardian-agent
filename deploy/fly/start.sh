#!/bin/sh
set -eu

config_path="${GUARDIAN_CONFIG_PATH:-/data/config.yaml}"
config_dir="$(dirname "$config_path")"

mkdir -p "$config_dir"
if [ ! -f "$config_path" ]; then
  cp /app/deploy/fly/config.yaml "$config_path"
fi

exec node /app/dist/index.js "$config_path"
