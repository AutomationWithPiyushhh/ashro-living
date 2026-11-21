#!/usr/bin/env bash
set -e

# Change to project root directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  🌿 Ashro Living — Luxury Co-Living & PG Management System"
echo "=========================================================="

# Ensure database exists and seed if not yet created
if [ ! -f "data/ashroliving.db" ]; then
    echo "📦 Initializing and seeding SQLite database..."
    python3 -m backend.seed
fi

# Run the threaded web server
echo "🚀 Starting server at http://127.0.0.1:8000"
echo "  • Public Portal:    http://127.0.0.1:8000/"
echo "  • Resident Portal:  http://127.0.0.1:8000/resident"
echo "  • Property Manager: http://127.0.0.1:8000/admin"
echo "=========================================================="

exec python3 -m backend.server
