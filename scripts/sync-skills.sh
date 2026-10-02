#!/usr/bin/env bash
# Copies the canonical skills (plugins/viral-app/skills) to the repository-root
# skills/ directory, which Gemini CLI, Qwen Code and Agent Plugins hosts load
# (they read skills only from the extension or repository root).
#
#   scripts/sync-skills.sh          # copy
#   scripts/sync-skills.sh --check  # fail if the copies differ (for CI)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/plugins/viral-app/skills"
dst="$root/skills"

if [[ "${1:-}" == "--check" ]]; then
  if diff -r "$src" "$dst" >/dev/null; then
    echo "skills/ matches plugins/viral-app/skills/"
  else
    diff -r "$src" "$dst" || true
    echo "skills/ is out of date: run scripts/sync-skills.sh" >&2
    exit 1
  fi
  exit 0
fi

rm -rf "$dst"
mkdir -p "$dst"
cp -R "$src"/. "$dst"/
echo "copied $(find "$dst" -name SKILL.md | wc -l | tr -d ' ') skills to skills/"
