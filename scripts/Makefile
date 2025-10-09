# Ritual Blockchain Explorer - Comprehensive Makefile
# Advanced Docker deployment, development, and management
# Usage: make <target>

# Variables
APP_NAME := ritual-scan
PACKAGE_NAME := ritual-scan
VERSION := $(shell cat package.json | grep '"version"' | sed 's/.*"version": "\(.*\)".*/\1/')
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
DOCKER_REGISTRY := ghcr.io
DOCKER_USERNAME := $(shell whoami)
IMAGE_NAME := $(DOCKER_REGISTRY)/$(DOCKER_USERNAME)/$(APP_NAME)
CONTAINER_NAME := $(APP_NAME)-container
NETWORK_NAME := $(APP_NAME)-network

# Ports
DEV_PORT := 3010
PROD_PORT := 3010
HEALTH_PORT := 3001

# Environment
NODE_ENV := development
COMPOSE_FILE := docker-compose.yml

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

##@ General

.PHONY: help
help: ## Display this help message
	@echo "$(BLUE)🔮 Ritual Blockchain Explorer - Advanced Management$(NC)"
	@echo "Version: $(VERSION) | Commit: $(GIT_COMMIT) | Built: $(BUILD_DATE)"
	@echo "Network: RETH (35.185.40.237:8545) | WebSocket: :8546"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: version
version: ## Show application version
	@echo "$(GREEN)$(APP_NAME) version: $(VERSION)$(NC)"

##@ Development

.PHONY: install
install: ## Install dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	npm ci

.PHONY: dev
dev: ## Start development server
	@echo "$(GREEN)Starting development server...$(NC)"
	npm run dev

.PHONY: build
build: ## Build the application
	@echo "$(YELLOW)Building application...$(NC)"
	npm run build

.PHONY: lint
lint: ## Run linting
	@echo "$(YELLOW)Running linter...$(NC)"
	npm run lint

.PHONY: test
test: ## Run tests
	@echo "$(YELLOW)Running tests...$(NC)"
	npm run test

.PHONY: clean
clean: ## Clean build artifacts and dependencies
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf .next
	rm -rf out
	rm -rf dist
	rm -rf node_modules

##@ Docker Development

.PHONY: docker-dev-build
docker-dev-build: ## Build development Docker image
	@echo "$(YELLOW)Building development Docker image...$(NC)"
	docker build -f Dockerfile.dev -t $(APP_NAME):dev .

.PHONY: docker-dev-run
docker-dev-run: docker-dev-build ## Run development container
	@echo "$(GREEN)Starting development container...$(NC)"
	docker run -it --rm \
		-p 3010:3000 \
		-v $(PWD):/app \
		-v /app/node_modules \
		-v /app/.next \
		--name $(APP_NAME)-dev \
		$(APP_NAME):dev

.PHONY: docker-dev-compose
docker-dev-compose: ## Start development with docker-compose
	@echo "$(GREEN)Starting development with docker-compose...$(NC)"
	docker-compose --profile dev up --build

.PHONY: docker-dev-stop
docker-dev-stop: ## Stop development containers
	@echo "$(YELLOW)Stopping development containers...$(NC)"
	docker-compose --profile dev down

##@ Docker Production

.PHONY: docker-build
docker-build: ## Build production Docker image
	@echo "$(YELLOW)Building production Docker image...$(NC)"
	docker build -t $(APP_NAME):$(VERSION) -t $(APP_NAME):latest .

.PHONY: docker-run
docker-run: docker-build ## Run production container
	@echo "$(GREEN)Starting production container...$(NC)"
	docker run -d \
		-p 3010:3000 \
		--name $(CONTAINER_NAME) \
		--restart unless-stopped \
		--env-file .env.production \
		$(APP_NAME):latest

.PHONY: docker-prod-compose
docker-prod-compose: ## Start production stack with docker-compose
	@echo "$(GREEN)Starting production stack...$(NC)"
	docker-compose --profile prod up -d --build

.PHONY: docker-stop
docker-stop: ## Stop and remove production container
	@echo "$(YELLOW)Stopping production container...$(NC)"
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

.PHONY: docker-prod-stop
docker-prod-stop: ## Stop production docker-compose stack
	@echo "$(YELLOW)Stopping production stack...$(NC)"
	docker-compose --profile prod down

##@ Registry Operations

.PHONY: docker-tag
docker-tag: ## Tag image for registry
	@echo "$(YELLOW)Tagging image for registry...$(NC)"
	docker tag $(APP_NAME):$(VERSION) $(IMAGE_NAME):$(VERSION)
	docker tag $(APP_NAME):$(VERSION) $(IMAGE_NAME):latest

.PHONY: docker-push
docker-push: docker-build docker-tag ## Build and push to registry
	@echo "$(GREEN)Pushing to registry...$(NC)"
	docker push $(IMAGE_NAME):$(VERSION)
	docker push $(IMAGE_NAME):latest

.PHONY: docker-pull
docker-pull: ## Pull from registry
	@echo "$(GREEN)Pulling from registry...$(NC)"
	docker pull $(IMAGE_NAME):latest

##@ Maintenance

.PHONY: docker-logs
docker-logs: ## Show container logs
	@echo "$(BLUE)Showing container logs...$(NC)"
	docker logs -f $(CONTAINER_NAME)

.PHONY: docker-shell
docker-shell: ## Access container shell
	@echo "$(BLUE)Accessing container shell...$(NC)"
	docker exec -it $(CONTAINER_NAME) /bin/sh

.PHONY: docker-inspect
docker-inspect: ## Inspect container
	@echo "$(BLUE)Inspecting container...$(NC)"
	docker inspect $(CONTAINER_NAME)

.PHONY: docker-stats
docker-stats: ## Show container statistics
	@echo "$(BLUE)Container statistics:$(NC)"
	docker stats $(CONTAINER_NAME) --no-stream

.PHONY: docker-health
docker-health: ## Check container health
	@echo "$(BLUE)Checking container health...$(NC)"
	docker exec $(CONTAINER_NAME) curl -f http://localhost:3000 || echo "$(RED)Health check failed$(NC)"

##@ Cleanup

.PHONY: docker-clean
docker-clean: ## Clean up Docker resources
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker system prune -f
	docker volume prune -f

.PHONY: docker-clean-all
docker-clean-all: ## Clean up all Docker resources (destructive)
	@echo "$(RED)Warning: This will remove all unused Docker resources!$(NC)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	docker system prune -af --volumes
	docker image prune -af

.PHONY: docker-remove-images
docker-remove-images: ## Remove application Docker images
	@echo "$(YELLOW)Removing application Docker images...$(NC)"
	docker rmi $(APP_NAME):latest $(APP_NAME):$(VERSION) $(APP_NAME):dev 2>/dev/null || true
	docker rmi $(IMAGE_NAME):latest $(IMAGE_NAME):$(VERSION) 2>/dev/null || true

##@ Environment Setup

.PHONY: env-setup
env-setup: ## Set up environment files
	@echo "$(YELLOW)Setting up environment files...$(NC)"
	@if [ ! -f .env.local ]; then \
		cp env.example .env.local; \
		echo "$(GREEN)Created .env.local from template$(NC)"; \
		echo "$(YELLOW)Please edit .env.local with your configuration$(NC)"; \
	else \
		echo "$(BLUE).env.local already exists$(NC)"; \
	fi
	@if [ ! -f .env.production ]; then \
		cp env.example .env.production; \
		echo "$(GREEN)Created .env.production from template$(NC)"; \
		echo "$(YELLOW)Please edit .env.production with your production configuration$(NC)"; \
	else \
		echo "$(BLUE).env.production already exists$(NC)"; \
	fi

.PHONY: env-validate
env-validate: ## Validate environment configuration
	@echo "$(BLUE)Validating environment configuration...$(NC)"
	@if [ -f .env.local ]; then \
		echo "$(GREEN)✓ .env.local exists$(NC)"; \
	else \
		echo "$(RED)✗ .env.local missing$(NC)"; \
	fi
	@if [ -f .env.production ]; then \
		echo "$(GREEN)✓ .env.production exists$(NC)"; \
	else \
		echo "$(RED)✗ .env.production missing$(NC)"; \
	fi

##@ Deployment

.PHONY: deploy-staging
deploy-staging: docker-build docker-push ## Deploy to staging
	@echo "$(GREEN)Deploying to staging...$(NC)"
	# Add your staging deployment commands here
	# Example: kubectl apply -f k8s/staging/
	# Example: docker-compose -f docker-compose.staging.yml up -d

.PHONY: deploy-production
deploy-production: docker-build docker-push ## Deploy to production
	@echo "$(GREEN)Deploying to production...$(NC)"
	# Add your production deployment commands here
	# Example: kubectl apply -f k8s/production/
	# Example: docker-compose -f docker-compose.production.yml up -d

.PHONY: rollback
rollback: ## Rollback to previous version
	@echo "$(YELLOW)Rolling back to previous version...$(NC)"
	# Add rollback logic here

##@ GKE Deployment

.PHONY: setup-gke
setup-gke: ## Setup GKE cluster (requires PROJECT_ID)
	@echo "$(BLUE)Setting up GKE cluster...$(NC)"
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "$(RED)Error: PROJECT_ID not set$(NC)"; \
		echo "$(YELLOW)Usage: make setup-gke PROJECT_ID=your-project-id$(NC)"; \
		exit 1; \
	fi
	./scripts/setup-gke.sh $(PROJECT_ID)

.PHONY: docker-build-gcr
docker-build-gcr: docker-build ## Build and tag for Google Container Registry
	@echo "$(YELLOW)Tagging image for GCR...$(NC)"
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "$(RED)Error: PROJECT_ID not set$(NC)"; \
		echo "$(YELLOW)Usage: make docker-build-gcr PROJECT_ID=your-project-id$(NC)"; \
		exit 1; \
	fi
	docker tag $(APP_NAME):$(VERSION) gcr.io/$(PROJECT_ID)/$(APP_NAME):$(VERSION)
	docker tag $(APP_NAME):$(VERSION) gcr.io/$(PROJECT_ID)/$(APP_NAME):latest

.PHONY: docker-push-gcr
docker-push-gcr: docker-build-gcr ## Push image to Google Container Registry
	@echo "$(GREEN)Pushing to GCR...$(NC)"
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "$(RED)Error: PROJECT_ID not set$(NC)"; \
		echo "$(YELLOW)Usage: make docker-push-gcr PROJECT_ID=your-project-id$(NC)"; \
		exit 1; \
	fi
	docker push gcr.io/$(PROJECT_ID)/$(APP_NAME):$(VERSION)
	docker push gcr.io/$(PROJECT_ID)/$(APP_NAME):latest

.PHONY: deploy-gke
deploy-gke: docker-push-gcr ## Deploy to GKE cluster
	@echo "$(GREEN)Deploying to GKE...$(NC)"
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "$(RED)Error: PROJECT_ID not set$(NC)"; \
		echo "$(YELLOW)Usage: make deploy-gke PROJECT_ID=your-project-id$(NC)"; \
		exit 1; \
	fi
	# Replace PROJECT_ID placeholder in deployment
	sed 's/PROJECT_ID/$(PROJECT_ID)/g' k8s/deployment.yaml | kubectl apply -f -
	kubectl rollout status deployment/ritual-explorer -n default
	@echo "$(GREEN)✅ Deployment complete!$(NC)"

.PHONY: gke-status
gke-status: ## Check GKE deployment status
	@echo "$(BLUE)GKE Deployment Status:$(NC)"
	kubectl get pods -l app=ritual-explorer
	kubectl get services ritual-explorer-service
	kubectl get ingress ritual-explorer-ingress

.PHONY: gke-logs
gke-logs: ## View GKE pod logs
	@echo "$(BLUE)GKE Pod Logs:$(NC)"
	kubectl logs -l app=ritual-explorer --tail=50 -f

.PHONY: gke-shell
gke-shell: ## Access GKE pod shell
	@echo "$(BLUE)Accessing GKE pod shell...$(NC)"
	kubectl exec -it $$(kubectl get pods -l app=ritual-explorer -o jsonpath='{.items[0].metadata.name}') -- /bin/sh

.PHONY: gke-scale
gke-scale: ## Scale GKE deployment (usage: make gke-scale REPLICAS=5)
	@echo "$(YELLOW)Scaling GKE deployment...$(NC)"
	kubectl scale deployment ritual-explorer --replicas=$(REPLICAS)

.PHONY: gke-cleanup
gke-cleanup: ## Delete GKE resources
	@echo "$(YELLOW)Cleaning up GKE resources...$(NC)"
	kubectl delete -f k8s/deployment.yaml || true

##@ Security

.PHONY: security-scan
security-scan: ## Run security scan on Docker image
	@echo "$(BLUE)Running security scan...$(NC)"
	@command -v trivy >/dev/null 2>&1 || { echo "$(RED)trivy is required but not installed$(NC)"; exit 1; }
	trivy image $(APP_NAME):latest

.PHONY: audit
audit: ## Run npm audit
	@echo "$(BLUE)Running npm audit...$(NC)"
	npm audit --audit-level moderate

##@ Browser Testing & Automation

.PHONY: test-install
test-install: ## Install Playwright browsers and dependencies
	@echo "$(BLUE)Installing Playwright browsers...$(NC)"
	npm install
	npx playwright install --with-deps

.PHONY: test-systematic
test-systematic: ## Run systematic navigation and functionality tests
	@echo "$(BLUE)🤖 Running systematic browser automation tests...$(NC)"
	@echo "$(YELLOW)Testing all 9 navigation tabs + functionality$(NC)"
	npm run test

.PHONY: test-visual
test-visual: ## Run tests with visual browser (headed mode)
	@echo "$(BLUE)🎭 Running visual browser tests...$(NC)"
	npm run test:headed

.PHONY: test-ui
test-ui: ## Launch Playwright UI for interactive testing
	@echo "$(BLUE)🎮 Launching Playwright UI...$(NC)"
	npm run test:ui

.PHONY: test-debug
test-debug: ## Debug tests with step-by-step execution
	@echo "$(BLUE)🔍 Running debug mode tests...$(NC)"
	npm run test:debug

.PHONY: test-report
test-report: ## View last test report
	@echo "$(BLUE)📊 Opening test report...$(NC)"
	npm run test:report

.PHONY: test-console-errors
test-console-errors: ## Comprehensive console error analysis
	@echo "$(BLUE)🔍 Running console error analysis...$(NC)"
	@echo "This will:"
	@echo "  • Test all 9 navigation tabs"
	@echo "  • Monitor WebSocket connections"
	@echo "  • Capture console errors"
	@echo "  • Generate error report"
	@echo "  • Take screenshots of issues"
	npm run test -- --grep "Console Errors"

.PHONY: test-websocket
test-websocket: ## Test WebSocket real-time functionality
	@echo "$(BLUE)🔌 Testing WebSocket connectivity...$(NC)"
	npm run test -- --grep "WebSocket"

.PHONY: test-performance
test-performance: ## Run performance analysis on all pages
	@echo "$(BLUE)⚡ Running performance tests...$(NC)"
	npm run test -- --grep "Performance"

.PHONY: test-reth
test-reth: ## Test RETH network connectivity
	@echo "$(BLUE)🌐 Testing RETH network integration...$(NC)"
	npm run test -- --grep "RETH Network"

.PHONY: test-mobile
test-mobile: ## Test mobile responsiveness
	@echo "$(BLUE)📱 Testing mobile compatibility...$(NC)"
	npx playwright test --project="Mobile Chrome"

.PHONY: test-browsers
test-browsers: ## Test across all browsers (Chrome, Firefox, Safari)
	@echo "$(BLUE)🌐 Testing cross-browser compatibility...$(NC)"
	npx playwright test --project="chromium" --project="firefox" --project="webkit"

.PHONY: test-full-suite
test-full-suite: test-install test-systematic test-performance test-reth ## Complete test suite
	@echo "$(GREEN)✅ Full test suite completed!$(NC)"
	@echo "$(BLUE)📊 Check test-results/ folder for detailed reports$(NC)"

##@ Utilities

.PHONY: size
size: ## Show Docker image sizes
	@echo "$(BLUE)Docker image sizes:$(NC)"
	docker images $(APP_NAME) --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

.PHONY: info
info: ## Show system information
	@echo "$(BLUE)System Information:$(NC)"
	@echo "Docker version: $$(docker --version)"
	@echo "Docker Compose version: $$(docker-compose --version)"
	@echo "Node version: $$(node --version)"
	@echo "NPM version: $$(npm --version)"
	@echo "Application version: $(VERSION)"

.PHONY: full-setup
full-setup: env-setup install build docker-build ## Complete setup for new environment
	@echo "$(GREEN)Full setup completed!$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "1. Edit .env.local with your configuration"
	@echo "2. Run 'make docker-dev-compose' to start development"
	@echo "3. Run 'make docker-prod-compose' for production"

##@ Quick Commands

.PHONY: up
up: docker-dev-compose ## Quick start development (alias for docker-dev-compose)

.PHONY: down
down: docker-dev-stop ## Quick stop development (alias for docker-dev-stop)

.PHONY: restart
restart: down up ## Quick restart development

.PHONY: prod-up
prod-up: docker-prod-compose ## Quick start production

.PHONY: prod-down
prod-down: docker-prod-stop ## Quick stop production

##@ Advanced Operations

.PHONY: network-create
network-create: ## Create Docker network
	@echo "$(YELLOW)Creating Docker network...$(NC)"
	docker network create $(NETWORK_NAME) 2>/dev/null || true

.PHONY: network-remove
network-remove: ## Remove Docker network
	@echo "$(YELLOW)Removing Docker network...$(NC)"
	docker network rm $(NETWORK_NAME) 2>/dev/null || true

.PHONY: backup
backup: ## Backup application data
	@echo "$(BLUE)Creating backup...$(NC)"
	@mkdir -p backups
	@tar -czf backups/$(APP_NAME)-$(VERSION)-$(shell date +%Y%m%d-%H%M%S).tar.gz \
		--exclude=node_modules --exclude=.next --exclude=.git --exclude=backups .
	@echo "$(GREEN)Backup created in backups/$(NC)"

.PHONY: monitor
monitor: ## Monitor application resources
	@echo "$(BLUE)Monitoring application resources...$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop monitoring$(NC)"
	@while true; do \
		clear; \
		echo "$(GREEN)🔮 Ritual Explorer - Resource Monitor$(NC)"; \
		echo "Time: $$(date)"; \
		echo ""; \
		docker stats $(CONTAINER_NAME) --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" 2>/dev/null || echo "Container not running"; \
		echo ""; \
		echo "$(BLUE)Network Connectivity:$(NC)"; \
		curl -s -o /dev/null -w "RETH RPC (8545): %{http_code} - %{time_total}s\n" http://35.185.40.237:8545 || echo "RETH RPC: Failed"; \
		echo ""; \
		sleep 5; \
	done

.PHONY: benchmark
benchmark: ## Run performance benchmark
	@echo "$(BLUE)Running performance benchmark...$(NC)"
	@echo "Testing RETH connectivity..."
	@time curl -s -X POST -H "Content-Type: application/json" \
		--data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
		http://35.185.40.237:8545
	@echo ""
	@echo "Testing WebSocket connectivity..."
	@timeout 5 curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
		-H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
		http://35.185.40.237:8546 2>/dev/null || echo "WebSocket test completed"

.PHONY: status
status: ## Show comprehensive status
	@echo "$(BLUE)🔮 Ritual Explorer - System Status$(NC)"
	@echo "Application: $(GREEN)$(APP_NAME)$(NC)"
	@echo "Version: $(VERSION) ($(GIT_COMMIT))"
	@echo "Built: $(BUILD_DATE)"
	@echo ""
	@echo "$(YELLOW)🐳 Docker Status:$(NC)"
	@docker ps -a --filter name=$(CONTAINER_NAME) --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers found"
	@echo ""
	@echo "$(YELLOW)🌐 Network Status:$(NC)"
	@echo -n "RETH RPC (8545): "; curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://35.185.40.237:8545 | grep -o '"result":"[^"]*"' | cut -d'"' -f4 | xargs printf "Block %d\n" 2>/dev/null || echo "❌ Failed"
	@echo -n "RETH WebSocket (8546): "; timeout 2 bash -c "</dev/tcp/35.185.40.237/8546" && echo "✅ Connected" || echo "❌ Failed"
	@echo ""
	@echo "$(YELLOW)📦 Resources:$(NC)"
	@docker images $(APP_NAME) --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" 2>/dev/null || echo "No images found"

.PHONY: ritual-test
ritual-test: ## Test Ritual network connectivity and features
	@echo "$(BLUE)🔮 Testing Ritual Network Features...$(NC)"
	@echo ""
	@echo "$(YELLOW)Testing System Accounts:$(NC)"
	@curl -s -X POST -H "Content-Type: application/json" \
		--data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x000000000000000000000000000000000000fa7e","latest"],"id":1}' \
		http://35.185.40.237:8545 | jq '.result' | xargs printf "Scheduled System (fa7e): %s\n"
	@curl -s -X POST -H "Content-Type: application/json" \
		--data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x000000000000000000000000000000000000fa8e","latest"],"id":1}' \
		http://35.185.40.237:8545 | jq '.result' | xargs printf "Async Commitment (fa8e): %s\n"
	@curl -s -X POST -H "Content-Type: application/json" \
		--data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x000000000000000000000000000000000000fa9e","latest"],"id":1}' \
		http://35.185.40.237:8545 | jq '.result' | xargs printf "Async Settlement (fa9e): %s\n"
	@echo ""
	@echo "$(YELLOW)Testing Active Contract:$(NC)"
	@curl -s -X POST -H "Content-Type: application/json" \
		--data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0xd2ea7eb42516F8A260A774b5F7B99DbEF313dDb7","latest"],"id":1}' \
		http://35.185.40.237:8545 | jq -r '.result' | cut -c1-20 | xargs printf "PrecompileConsumer: %s...\n"

.PHONY: logs-follow
logs-follow: ## Follow application logs in real-time
	@echo "$(BLUE)Following logs for $(CONTAINER_NAME)...$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop$(NC)"
	@docker logs -f $(CONTAINER_NAME) 2>/dev/null || echo "Container not running"

.PHONY: shell-dev
shell-dev: ## Access development container shell
	@echo "$(BLUE)Accessing development container shell...$(NC)"
	@docker exec -it $(APP_NAME)-dev /bin/sh 2>/dev/null || echo "Development container not running"

.PHONY: reset-all
reset-all: docker-stop docker-remove-images clean ## Complete reset (destructive)
	@echo "$(RED)⚠️  Complete reset performed$(NC)"
	@echo "$(YELLOW)Run 'make full-setup' to reinitialize$(NC)"

.PHONY: quick-deploy
quick-deploy: clean install build docker-build docker-run ## Quick full deployment
	@echo "$(GREEN)🚀 Quick deployment completed!$(NC)"
	@echo "$(YELLOW)Application running at: http://localhost:$(PROD_PORT)$(NC)"
