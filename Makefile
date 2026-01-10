.PHONY: help build dev prod up down logs clean restart shell health test lint format typecheck

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make dev         - Run development server locally (no Docker)"
	@echo "    make lint        - Run linters (Biome + Stylelint)"
	@echo "    make format      - Format code with Prettier"
	@echo "    make typecheck   - Run TypeScript type checking"
	@echo ""
	@echo "  Testing:"
	@echo "    make test        - Run unit tests"
	@echo "    make test-e2e    - Run E2E tests in container"
	@echo "    make test-watch  - Run tests in watch mode"
	@echo ""
	@echo "  Docker:"
	@echo "    make build       - Build the Docker image"
	@echo "    make prod        - Build and run production container"
	@echo "    make up          - Start all services with Docker Compose"
	@echo "    make down        - Stop all services"
	@echo "    make logs        - View logs from all services"
	@echo "    make clean       - Remove containers, images, and volumes"
	@echo "    make restart     - Restart all services"
	@echo "    make shell       - Open shell in running container"
	@echo "    make health      - Check container health status"
	@echo ""
	@echo "  Utilities:"
	@echo "    make analyze     - Analyze bundle size"
	@echo "    make audit       - Run security audit"
	@echo "    make gen         - Generate GraphQL types"

# Build Docker image
build:
	@echo "Building Docker image..."
	docker build -t portfolio:latest .

# Build with no cache
build-no-cache:
	@echo "Building Docker image (no cache)..."
	docker build --no-cache -t portfolio:latest .

# Development (local, no Docker)
dev:
	@echo "Starting development server..."
	bun run dev

# Linting
lint:
	@echo "Running linters..."
	bun run lint

# Format code
format:
	@echo "Formatting code..."
	bun run format

# TypeScript type checking
typecheck:
	@echo "Running type check..."
	bun run typecheck

# Run unit tests locally
test-local:
	@echo "Running tests..."
	bun run test

# Run tests in watch mode
test-watch:
	@echo "Running tests in watch mode..."
	bun run test:watch

# Run tests with UI
test-ui:
	@echo "Opening Vitest UI..."
	bun run test:ui

# Run E2E tests locally
e2e:
	@echo "Running E2E tests..."
	bun run e2e:headless

# Analyze bundle
analyze:
	@echo "Analyzing bundle..."
	bun run analyze

# Security audit
audit:
	@echo "Running security audit..."
	bun run security:audit

# Generate GraphQL types
gen:
	@echo "Generating GraphQL types..."
	bun run gen

# Production container
prod:
	@echo "Building and starting production container..."
	docker build -t portfolio:latest .
	docker run -d \
		-p 3000:3000 \
		--name portfolio-web \
		--env-file .env \
		portfolio:latest

# Start services with Docker Compose
up:
	@echo "Starting services..."
	docker compose --env-file .env.docker up -d

# Start services in foreground
up-fg:
	@echo "Starting services (foreground)..."
	docker compose --env-file .env.docker up

# Stop services
down:
	@echo "Stopping services..."
	docker compose down

# View logs
logs:
	docker compose logs -f

# View logs for specific service
logs-web:
	docker compose logs -f web

logs-jaeger:
	docker compose logs -f jaeger

# Restart services
restart:
	@echo "Restarting services..."
	docker compose restart

# Restart specific service
restart-web:
	docker compose restart web

# Clean up everything
clean:
	@echo "Cleaning up Docker resources..."
	docker compose down -v
	docker rmi portfolio:latest 2>/dev/null || true
	docker system prune -f

# Deep clean (remove all unused Docker resources)
deep-clean:
	@echo "Performing deep clean..."
	docker compose down -v
	docker rmi portfolio:latest 2>/dev/null || true
	docker system prune -af --volumes

# Open shell in running container
shell:
	docker exec -it portfolio-web /bin/sh

# Open shell in web service (compose)
shell-compose:
	docker compose exec web /bin/sh

# Check health status
health:
	@echo "Container health status:"
	@docker ps --filter name=portfolio-web --format "table {{.Names}}\t{{.Status}}"
	@echo "\nHealth check endpoint:"
	@curl -s http://localhost:3000/api/health | grep -q "ok" && echo "✅ Healthy" || echo "❌ Unhealthy"

# Run tests in container
test:
	docker run --rm portfolio:latest bun run test

# Run specific test
test-e2e:
	docker run --rm portfolio:latest bun run e2e:ci

# View container stats
stats:
	docker stats portfolio-web --no-stream

# Inspect container
inspect:
	docker inspect portfolio-web

# Export logs
export-logs:
	@mkdir -p logs
	docker logs portfolio-web > logs/docker-$(shell date +%Y%m%d-%H%M%S).log
	@echo "Logs exported to logs/ directory"

# Build for specific platform (useful for M1/M2 Macs deploying to x86)
build-x86:
	docker buildx build --platform linux/amd64 -t portfolio:latest .

build-arm:
	docker buildx build --platform linux/arm64 -t portfolio:latest .

# Multi-platform build
build-multi:
	docker buildx build --platform linux/amd64,linux/arm64 -t portfolio:latest .

# Start only Jaeger
jaeger:
	docker compose up -d jaeger

# Stop only Jaeger
jaeger-down:
	docker compose stop jaeger

# Quick deploy (build, stop old, start new)
deploy: build down up
	@echo "Deployment complete!"
	@make health

# Development with hot reload (volume mount)
dev-docker:
	docker run -it --rm \
		-p 3000:3000 \
		-v $(PWD)/src:/app/src:ro \
		--env-file .env \
		portfolio:latest \
		bun dev

# Pull latest base image
pull:
	docker pull oven/bun:1-alpine

# Security scan (requires trivy)
scan:
	@command -v trivy >/dev/null 2>&1 || { echo "Error: trivy not installed. Install from: https://aquasecurity.github.io/trivy/"; exit 1; }
	trivy image portfolio:latest

# Analyze image size
analyze:
	@echo "Image size analysis:"
	@docker images portfolio:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
	@echo "\nImage layers:"
	@docker history portfolio:latest --no-trunc

# Backup (export image)
backup:
	@mkdir -p backups
	docker save portfolio:latest | gzip > backups/portfolio-$(shell date +%Y%m%d-%H%M%S).tar.gz
	@echo "Backup saved to backups/ directory"

# Restore from backup (specify file with BACKUP_FILE)
restore:
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Usage: make restore BACKUP_FILE=path/to/backup.tar.gz"; exit 1; fi
	gunzip -c $(BACKUP_FILE) | docker load

# Setup environment files
setup-env:
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi
	@if [ ! -f .env.docker ]; then cp .env.docker.example .env.docker; echo "Created .env.docker from .env.docker.example"; fi
	@echo "Please edit .env and .env.docker with your configuration"

# Verify Docker and Docker Compose installation
verify:
	@echo "Verifying Docker installation..."
	@docker --version
	@docker compose version
	@echo "✅ Docker is properly installed"
