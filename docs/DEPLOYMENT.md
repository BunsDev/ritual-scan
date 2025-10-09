# Ritual Scan - Deployment Guide

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Node.js 18+ (for local development)
- Make (for using the Makefile commands)

### Setup Environment
```bash
# Copy environment template and configure
make env-setup

# Edit your environment files
vi .env.local      # Development environment
vi .env.production # Production environment
```

### Quick Commands

#### Development
```bash
cd scripts
make dev                    # Start development server
make docker-dev-run        # Run development container with hot reload
make docker-dev-compose    # Start development with docker-compose
make docker-dev-stop       # Stop development containers
```

#### Production
```bash
cd scripts
make docker-build          # Build production Docker image
make docker-run            # Run production container
make docker-prod-compose   # Start production stack with docker-compose
make docker-stop           # Stop and remove production container
```

#### Docker Operations
```bash
cd scripts
make docker-logs           # Show container logs
make docker-health         # Check container health
make docker-stats          # Show container statistics
make docker-shell          # Access container shell
```

## Architecture

### Multi-Stage Docker Build
- **deps**: Install production dependencies
- **builder**: Build the application with dev dependencies
- **prod-deps**: Clean production dependencies only
- **runner**: Final runtime image

### Docker Compose Profiles
- **dev**: Development with hot reload
- **prod**: Production with Nginx reverse proxy

## Deployment Options

### 1. Local Docker
```bash
cd scripts
# Build and run production container
make docker-build
make docker-run

# Access at http://localhost:3000
```

### 2. Docker Compose Production
```bash
cd scripts
# Start full production stack
make docker-prod-compose

# Includes:
# - Next.js application (ritual-scan)
# - Smart caching enabled
# - Health checks
# - Auto-restart policies
```

### 3. Google Kubernetes Engine (GKE)
```bash
cd scripts
# Deploy to GKE cluster
make deploy-gke PROJECT_ID=your-project-id

# Check deployment status
make gke-status

# View logs
make gke-logs

# Scale deployment
make gke-scale REPLICAS=3
```

### 4. Cloud Platforms

#### Google Cloud Run (Recommended)
```bash
# Deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or manual deployment
gcloud run deploy ritual-scan \
  --image gcr.io/PROJECT_ID/ritual-scan:latest \
  --region us-central1 \
  --allow-unauthenticated
```

#### Docker Registry Operations
```bash
cd scripts
# Build and push to registry
make docker-push

# For Google Container Registry
make docker-push-gcr PROJECT_ID=your-project-id
```

## Configuration

### Environment Variables

#### Required
```env
NODE_ENV=production
NEXT_PUBLIC_RETH_RPC_URL=http://35.185.40.237:8545
NEXT_PUBLIC_RETH_WS_URL=ws://35.185.40.237:8546
```

#### Optional
```env
NEXT_PUBLIC_RETH_BACKUP_RPC_URL=http://130.211.246.58:8545
NEXT_PUBLIC_NETWORK_NAME=Ritual Chain
NEXT_PUBLIC_CHAIN_ID=7000
NEXT_PUBLIC_CURRENCY_SYMBOL=RITUAL
```

#### Performance & Features
```env
NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS=10
NEXT_PUBLIC_CACHE_TTL=30000
NEXT_PUBLIC_POLLING_INTERVAL=2000
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_DISABLE_CACHE=false
```

#### Production Only
```env
NEXT_TELEMETRY_DISABLED=1
```

## Monitoring & Health Checks

### Health Endpoint
```bash
curl http://localhost:3000/api/health
```

### Monitoring Commands
```bash
cd scripts
make docker-stats      # Container resource usage
make docker-logs       # Application logs  
make security-scan     # Security vulnerability scan
make gke-status       # GKE deployment status
make gke-logs         # GKE pod logs
```

## Security

### Built-in Security Features
- WebSocket connection validation
- RPC endpoint health checks
- Input sanitization for blockchain data
- Rate limiting through smart caching
- Non-root container execution

### Security Scanning
```bash
cd scripts
make security-scan  # Requires trivy installation
```

## Performance

### Optimizations
- Multi-stage Docker build for minimal image size
- Next.js standalone output
- Smart caching system for instant page navigation
- WebSocket connection pooling
- Progressive data loading

### Build Metrics
- Build time: ~3-5 minutes
- Image size: ~200MB
- Cold start: <2 seconds  
- Memory usage: ~256MB with caching

## Troubleshooting

### Common Issues

#### Build Failures
```bash
cd scripts
# Clean and rebuild
make clean
make docker-clean
make docker-build
```

#### WebSocket Connection Issues
```bash
# Test WebSocket endpoint
wscat -c ws://your-rpc:8546

# Check RPC connectivity
curl -X POST http://your-rpc:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

#### GKE Deployment Issues
```bash
cd scripts
# Check deployment status
make gke-status

# View pod logs
make gke-logs

# Restart deployment
kubectl rollout restart deployment/ritual-scan
```

### Debugging
```bash
cd scripts
# Access container shell
make docker-shell

# View container logs
make docker-logs

# Check container health
make docker-health
```

## Updates & Maintenance

### Update Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and redeploy
cd scripts
make docker-stop
make docker-build  
make docker-run
```

### GKE Updates
```bash
cd scripts
# Deploy new version
make deploy-gke PROJECT_ID=your-project-id

# Check rollout status  
kubectl rollout status deployment/ritual-scan
```

## Deployment Checklist

- [ ] Environment variables configured (.env files)
- [ ] RETH node endpoints accessible (RPC + WebSocket)
- [ ] Google Cloud project setup (for GKE)
- [ ] Container registry permissions configured
- [ ] Health checks passing
- [ ] Smart caching verified working
- [ ] WebSocket connections stable
- [ ] Performance metrics acceptable

For more detailed configuration options, see [Environment Setup](./environment.md).
