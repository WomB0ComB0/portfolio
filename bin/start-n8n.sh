#!/bin/bash

# Copyright (c) 2026 Mike Odnis
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

# Start n8n AI Content Automation
# This script ensures n8n is running and provides helpful information

set -e

echo "🚀 Starting n8n AI Content Automation..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running."
    echo "Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found."
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please configure your API keys."
    else
        echo "❌ Error: .env.example not found."
        exit 1
    fi
fi

# Check for required environment variables
source .env

missing_vars=()

if [ -z "$SANITY_API_TOKEN" ]; then
    missing_vars+=("SANITY_API_TOKEN")
fi

if [ -z "$NEXT_PUBLIC_SANITY_PROJECT_ID" ]; then
    missing_vars+=("NEXT_PUBLIC_SANITY_PROJECT_ID")
fi

if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    missing_vars+=("OPENAI_API_KEY or ANTHROPIC_API_KEY")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "⚠️  Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please update your .env file and try again."
    echo "See docs/N8N_SETUP_GUIDE.md for details."
    exit 1
fi

# Create n8n directories if they don't exist
mkdir -p n8n_data n8n_workflows

# Start n8n container
echo "🐳 Starting n8n container..."
docker-compose up -d n8n

# Wait for n8n to be ready
echo "⏳ Waiting for n8n to start..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker exec portfolio-n8n n8n --version > /dev/null 2>&1; then
        echo "✅ n8n is ready!"
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Error: n8n failed to start within 30 seconds."
    echo "Check logs with: docker-compose logs n8n"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ n8n is now running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Access n8n at: http://localhost:5678"
echo ""
echo "📚 Next steps:"
echo "   1. Open http://localhost:5678 in your browser"
echo "   2. Create your n8n account (local only)"
echo "   3. Import the workflow from: n8n_workflows/sanity-content-bot.json"
echo "   4. Configure OpenAI credentials in the workflow"
echo "   5. Start automating your content!"
echo ""
echo "📖 Full guide: docs/N8N_SETUP_GUIDE.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Useful commands:"
echo "   View logs:     docker-compose logs -f n8n"
echo "   Stop n8n:      docker-compose stop n8n"
echo "   Restart n8n:   docker-compose restart n8n"
echo ""
