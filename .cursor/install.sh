#!/usr/bin/env bash
# Cloud Agent install for ai-class.
#
# The site itself is static HTML/CSS/JS and needs no build step to serve.
# This script prepares the Python content-generation tooling (scripts/,
# cardnews/, quote/) and regenerates the lessons body that the site serves.
# It is idempotent and safe to run repeatedly.
set -euo pipefail

# Ubuntu needs this package before `python3 -m venv` works.
if ! dpkg -s python3.12-venv >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y python3.12-venv
fi

VENV="$HOME/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"

python -m pip install --upgrade pip
pip install -r .cursor/requirements.txt

# Chromium plus its OS libraries for the Playwright-based image generators.
playwright install --with-deps chromium

# Regenerate assets/lessons-content.js from scripts/lesson-*.md.
# Deterministic output, so reruns produce no diff when the source is unchanged.
python scripts/build_lessons.py
