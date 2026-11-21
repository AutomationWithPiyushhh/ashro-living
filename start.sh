#!/usr/bin/env bash
set -e

# Change to project root directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Ensure data directory exists
mkdir -p data

# Initialize and seed database if missing
if [ ! -f "data/ashroliving.db" ]; then
    echo "📦 Initializing and seeding SQLite database..."
    python3 -m backend.seed
fi

echo "🚀 Starting Ashro Living server on port ${PORT:-8000}..."
exec python3 -m backend.server
