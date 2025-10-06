# Ritual Scan

A blockchain explorer for Ritual Chain with support for async transactions, scheduled jobs, and real-time updates.

![Ritual Scan](https://img.shields.io/badge/Ritual-Scan-84cc16?style=for-the-badge&logo=blockchain&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue?style=for-the-badge&logo=typescript)
![Real-time](https://img.shields.io/badge/WebSocket-Real--time-84cc16?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

## Features

**Ritual Chain Support**
- Async transaction flow visualization
- Scheduled transaction monitoring  
- System account recognition (0x...fa7e, fa8e, fa9e)
- Transaction types: Legacy, EIP-1559, Scheduled, AsyncCommitment, AsyncSettlement
- Search by Call ID, origin transaction, or precompile address

**Real-Time Updates**
- WebSocket connection to RETH nodes with smart caching
- Instant page navigation with 0ms load times
- Live mempool monitoring
- Connection status indicators with auto-reconnection

**Performance**
- Smart caching system for instant navigation
- Real-time validator statistics
- Progressive data loading
- Mobile-responsive design

## Quick Start

```bash
git clone https://github.com/ritual-net/ritual-scan.git
cd ritual-scan
npm install
cp .env.example .env.local
# Edit .env.local with your RPC endpoints
npm run dev
```

Visit `http://localhost:3000` to see the explorer.

## Screenshots

### Async Settlement Transaction (Type 0x12)

![Async Settlement Transaction (Type 0x12)](./docs/screenshots/tx-async-settlement.png)

Final settlement transaction with fee distribution in Ritual Chain async execution

### EIP-1559 Transaction (Type 0x2)

![EIP-1559 Transaction (Type 0x2)](./docs/screenshots/tx-eip1559.png)

Modern EIP-1559 transaction with priority fee and base fee mechanism

### Scheduled Transaction (Type 0x10)

![Scheduled Transaction (Type 0x10)](./docs/screenshots/tx-scheduled.png)

Ritual Chain scheduled transaction with Call ID tracking and cron-like execution

## Production Deployment

### GKE Deployment with Makefile

The project includes a comprehensive Makefile for production deployments to Google Kubernetes Engine.

```bash
# Navigate to scripts directory
cd scripts

# Show all available targets
make help

# Build and deploy to GKE
make gke-deploy

# Build Docker image
make docker-build

# Push to container registry
make docker-push

# Deploy to Cloud Run
make cloud-run-deploy
```

### Manual GKE Deployment

If you prefer manual deployment control:

```bash
# Set up Google Cloud project
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Build and push container
gcloud builds submit --config cloudbuild.yaml

# Deploy using kubectl (if using GKE cluster)
kubectl apply -f k8s/

# Or deploy to Cloud Run
gcloud run deploy ritual-scan \
  --image gcr.io/$PROJECT_ID/ritual-scan:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2
```

### Environment Configuration

Create the required environment files for your deployment target:

**Local Development:**
```bash
cp .env.example .env.local
# Edit .env.local with your RPC endpoints
```

**Production (Cloud Run/GKE):**
```bash
cp .env.example .env.production
# Configure production RPC endpoints and settings
```

**Kubernetes:**
```bash
cp .env.gke.template .env.gke
# Configure for GKE deployment with secrets
```

### Required Infrastructure

Before deploying, ensure you have:

1. **RETH Node Access**: Running RETH nodes with RPC (8545) and WebSocket (8546) endpoints
2. **Google Cloud Project**: With Container Registry and Cloud Run/GKE enabled
3. **Service Account**: With appropriate permissions for deployment
4. **Secrets**: Configure RPC URLs in Google Secret Manager

### Health Checks

The application includes health check endpoints:

- `GET /api/health` - Basic health status
- Application automatically validates RPC connectivity on startup
- WebSocket connections include auto-reconnection logic

## Docker

### Local Docker Build

```bash
# Build the image
docker build -t ritual-scan .

# Run locally
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_RETH_RPC_URL=http://your-rpc:8545 \
  -e NEXT_PUBLIC_RETH_WS_URL=ws://your-rpc:8546 \
  ritual-scan
```

### Docker Compose

```bash
# Run with docker-compose
docker-compose up --build

# Run in detached mode
docker-compose up -d
```

## Monitoring

The application includes built-in monitoring features:

- Real-time WebSocket connection status
- RPC endpoint health validation  
- Performance metrics for smart caching
- Error tracking and reconnection attempts

## Makefile Commands

The project includes a comprehensive Makefile in the `scripts/` directory with the following targets:

### Development
- `make dev` - Start development server
- `make build` - Build the application  
- `make test` - Run tests
- `make lint` - Run linting
- `make clean` - Clean build artifacts and dependencies
- `make install` - Install dependencies

### Environment Setup
- `make env-setup` - Create environment files from templates
- `make env-validate` - Validate environment configuration

### Docker Development  
- `make docker-dev-build` - Build development Docker image
- `make docker-dev-run` - Run development container with hot reload
- `make docker-dev-compose` - Start development with docker-compose
- `make docker-dev-stop` - Stop development containers

### Docker Production
- `make docker-build` - Build production Docker image
- `make docker-run` - Run production container
- `make docker-prod-compose` - Start production stack with docker-compose
- `make docker-stop` - Stop and remove production container

### Registry Operations
- `make docker-push` - Build and push to registry
- `make docker-pull` - Pull from registry
- `make docker-tag` - Tag image for registry

### GKE Deployment
- `make setup-gke PROJECT_ID=your-project` - Setup GKE cluster
- `make deploy-gke PROJECT_ID=your-project` - Deploy to GKE cluster
- `make gke-status` - Check GKE deployment status
- `make gke-logs` - View GKE pod logs
- `make gke-scale REPLICAS=3` - Scale GKE deployment

### Container Management
- `make docker-logs` - Show container logs
- `make docker-shell` - Access container shell
- `make docker-health` - Check container health
- `make docker-stats` - Show container statistics

### Cleanup
- `make docker-clean` - Clean up Docker resources
- `make docker-clean-all` - Clean up all Docker resources (destructive)
- `make gke-cleanup` - Delete GKE resources

### Utilities
- `make version` - Show version information
- `make help` - Display all available commands
- `make security-scan` - Run security scan on Docker image

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Clean and rebuild
make clean && make build

# Check TypeScript errors
npm run type-check
```

**WebSocket Connection Issues:**
```bash
# Test WebSocket endpoint
wscat -c ws://your-rpc:8546

# Check RPC connectivity  
curl -X POST http://your-rpc:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Deployment Issues:**
```bash
# Check Cloud Build logs
gcloud builds list --limit=5

# Verify service status
gcloud run services describe ritual-scan --region=us-central1

# Check container logs
gcloud logs read --service=ritual-scan --limit=50
```

**Performance Issues:**
- Check RPC endpoint latency
- Verify WebSocket connection stability
- Monitor memory usage with smart caching enabled
- Review browser console for client-side errors

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Local development
NEXT_PUBLIC_DEBUG_MODE=true npm run dev

# Production deployment
gcloud run services update ritual-scan \
  --set-env-vars="NEXT_PUBLIC_DEBUG_MODE=true"
```

## Documentation

- [Environment Setup](./docs/environment.md) - Configuration options
- [Deployment](./docs/DEPLOYMENT.md) - Production deployment guide

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript
- Styling: Tailwind CSS, Radix UI components  
- Real-time: WebSocket connections, smart caching
- State: Zustand, React Query
- Charts: Plotly.js for data visualization
- Testing: Playwright end-to-end tests
- Deployment: Docker, Kubernetes, Vercel

## Ritual Chain Features

### Transaction Types Supported

| Type | Description | System Account | Features |
|------|-------------|----------------|----------|
| 0x0 | Legacy | N/A | Standard Ethereum transactions |
| 0x2 | EIP-1559 | N/A | Enhanced gas mechanism |
| 0x10 | Scheduled | 0x...fa7e | Cron-like execution, Call ID tracking |
| 0x11 | AsyncCommitment | 0x...fa8e | TEE execution commitment |
| 0x12 | AsyncSettlement | 0x...fa9e | Final settlement with fee distribution |

### Enhanced Search Patterns

- **callId:10567** - Search scheduled transactions by Call ID
- **origin:0x...** - Find transactions by origin hash
- **10567** - Numeric Call ID search
- System account detection (fa7e, fa8e, fa9e)
- Precompile addresses (0x...0801, etc.)

### Pages & Features

#### Core Pages
- **Homepage** - Network overview, latest blocks/transactions, stats
- **Blocks** - Real-time block explorer with detailed views
- **Transactions** - Live transaction feed with type filtering
- **Mempool** - Real-time mempool monitoring with WebSocket updates

#### Ritual-Specific Pages
- **Scheduled** - Scheduled transaction pool with Call ID filtering
- **Ritual Analytics** - Advanced Ritual Chain metrics and adoption
- **Transaction Details** - Enhanced with async flow visualization
- **System Accounts** - Special pages for Ritual system addresses

## Project Structure

```
ritual-scan/
├── src/                      # Application source code
│   ├── app/                  # Next.js App Router pages
│   ├── components/           # React components
│   ├── hooks/                # Custom hooks
│   └── lib/                  # Core libraries (reth-client, websocket manager)
├── docs/                     # Documentation
│   ├── admin/                # Admin API docs
│   ├── architecture/         # Architecture decisions
│   ├── deployment/           # Deployment guides
│   └── *.md                  # System design, development logs
├── k8s/                      # Kubernetes manifests
├── scripts/                  # Build and deployment scripts
├── tools/                    # Development utilities
│   ├── debug/                # Debug scripts
│   └── test/                 # Test scripts
├── tests/                    # Playwright E2E tests
├── archive/                  # Old configs and scripts
├── public/                   # Static assets
├── FRONTEND_ONBOARDING.md    # Start here for new engineers
├── README.md                 # This file
├── deploy-to-ding-fish.sh    # Production deployment
└── package.json              # Dependencies
```

## Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) for development setup and guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and test
4. Commit using conventional commits: `git commit -m "feat: add feature"`
5. Push to your branch: `git push origin feature/your-feature`
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
