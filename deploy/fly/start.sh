#!/bin/sh
set -eu

config_path="${GUARDIAN_CONFIG_PATH:-/data/config.yaml}"
config_dir="$(dirname "$config_path")"
projects_dir="${GUARDIAN_PROJECTS_DIR:-/data/projects}"

mkdir -p "$config_dir"
mkdir -p "$projects_dir"
if [ ! -e /app/projects ]; then
  ln -s "$projects_dir" /app/projects
fi

if [ ! -f "$config_path" ]; then
  cp /app/deploy/fly/config.yaml "$config_path"
fi

exec node /app/dist/index.js "$config_path"
