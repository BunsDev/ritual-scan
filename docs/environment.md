# Environment Configuration

This guide covers all environment variables and configuration options for Ritual Scan.

## Environment Files

### `.env.local` (Development)

```bash
# Copy from template
cp .env.example .env.local
```

### `.env.production` (Production)

Used for production deployments. Never commit sensitive data!

### `.env.gke.template` (Kubernetes)

Template for GKE/Kubernetes deployments with ConfigMaps and Secrets.

## Environment Variables

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_RETH_RPC_URL` | Primary RPC endpoint | `http://35.196.101.134:8545` | ✅ |
| `NEXT_PUBLIC_RETH_WS_URL` | WebSocket endpoint | `ws://35.196.101.134:8546` | ✅ |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_RETH_RPC_BACKUP` | Backup RPC endpoint | Same as primary | `http://backup-node:8545` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `Ritual Scan` | `My Explorer` |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID for validation | `1` | `31337` |
| `NEXT_PUBLIC_NETWORK_NAME` | Network display name | `Ritual Chain` | `Testnet` |

### Performance Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS` | Max reconnection attempts | `10` | Auto-reconnection |
| `NEXT_PUBLIC_CACHE_TTL` | Cache time-to-live (ms) | `30000` | Smart caching |
| `NEXT_PUBLIC_POLLING_INTERVAL` | Polling interval (ms) | `2000` | Fallback polling |

### Development Variables

| Variable | Description | Default | Development Only |
|----------|-------------|---------|------------------|
| `NEXT_PUBLIC_DEBUG_MODE` | Enable debug logging | `false` | ✅ |
| `NEXT_PUBLIC_MOCK_DATA` | Use mock data | `false` | ✅ |
| `NEXT_PUBLIC_DISABLE_CACHE` | Disable smart caching | `false` | ✅ |

## Quick Setup

### Local Development

```bash
# 1. Copy template
cp .env.example .env.local

# 2. Edit with your values
nano .env.local

# 3. Required: Set RPC endpoints
NEXT_PUBLIC_RETH_RPC_URL=http://your-node:8545
NEXT_PUBLIC_RETH_WS_URL=ws://your-node:8546

# 4. Start development
npm run dev
```

### Production Deployment

```bash
# 1. Set production variables
export NEXT_PUBLIC_RETH_RPC_URL=https://mainnet-rpc.ritual.net
export NEXT_PUBLIC_RETH_WS_URL=wss://mainnet-ws.ritual.net

# 2. Build and start
npm run build
npm start
```

### Docker Deployment

```bash
# 1. Create .env file
cat > .env << EOF
NEXT_PUBLIC_RETH_RPC_URL=http://ritual-node:8545
NEXT_PUBLIC_RETH_WS_URL=ws://ritual-node:8546
EOF

# 2. Run with docker-compose
docker-compose up --build
```

## Configuration Examples

### Mainnet Configuration

```bash
# Mainnet Ritual Chain
NEXT_PUBLIC_RETH_RPC_URL=https://rpc.ritual.net
NEXT_PUBLIC_RETH_WS_URL=wss://ws.ritual.net
NEXT_PUBLIC_NETWORK_NAME=Ritual Mainnet
NEXT_PUBLIC_CHAIN_ID=7000
```

### Testnet Configuration

```bash
# Testnet Ritual Chain  
NEXT_PUBLIC_RETH_RPC_URL=https://testnet-rpc.ritual.net
NEXT_PUBLIC_RETH_WS_URL=wss://testnet-ws.ritual.net
NEXT_PUBLIC_NETWORK_NAME=Ritual Testnet
NEXT_PUBLIC_CHAIN_ID=7001
```

### Local Node Configuration

```bash
# Local RETH node
NEXT_PUBLIC_RETH_RPC_URL=http://localhost:8545
NEXT_PUBLIC_RETH_WS_URL=ws://localhost:8546
NEXT_PUBLIC_NETWORK_NAME=Local Development
NEXT_PUBLIC_CHAIN_ID=31337
```

### High-Performance Configuration

```bash
# Optimized for performance
NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS=5
NEXT_PUBLIC_CACHE_TTL=60000
NEXT_PUBLIC_POLLING_INTERVAL=1000
NEXT_PUBLIC_DEBUG_MODE=false
```

## Validation

The application validates configuration on startup:

### RPC Endpoint Validation

```typescript
// Automatic validation
const isValidRPC = await testConnection(rpcUrl)
if (!isValidRPC) {
  console.error('❌ RPC endpoint unreachable')
}
```

### WebSocket Validation

```typescript
// Connection test with timeout
const wsConnection = new WebSocket(wsUrl)
wsConnection.onopen = () => console.log('✅ WebSocket connected')
wsConnection.onerror = () => console.error('❌ WebSocket failed')
```

## Kubernetes Configuration

### ConfigMap Example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ritual-scan-config
data:
  NEXT_PUBLIC_RETH_RPC_URL: "http://ritual-rpc-service:8545"
  NEXT_PUBLIC_RETH_WS_URL: "ws://ritual-ws-service:8546"
  NEXT_PUBLIC_NETWORK_NAME: "Ritual Chain"
```

### Secret Example

```yaml  
apiVersion: v1
kind: Secret
metadata:
  name: ritual-scan-secrets
type: Opaque
stringData:
  API_KEY: "your-secret-api-key"
  DATABASE_URL: "postgresql://user:pass@db:5432/ritual"
```

## Troubleshooting

### Common Issues

#### RPC Connection Failed

```bash
# Check connectivity
curl -X POST http://your-node:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Expected response:
{"jsonrpc":"2.0","id":1,"result":"0x1234"}
```

#### WebSocket Connection Failed

```bash
# Test WebSocket endpoint
wscat -c ws://your-node:8546

# Expected: Connection successful
```

#### Environment Variables Not Loading

1. **Check file location**: `.env.local` in project root
2. **Restart dev server**: `npm run dev`
3. **Verify syntax**: No spaces around `=`
4. **Check prefixes**: Use `NEXT_PUBLIC_` for client-side variables

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
# Enable debug mode
NEXT_PUBLIC_DEBUG_MODE=true npm run dev

# Check browser console for detailed logs
```

## Additional Resources

- **[Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)**
- **[RETH Node Configuration](https://paradigmxyz.github.io/reth/)**
- **[Docker Environment Variables](https://docs.docker.com/compose/environment-variables/)**

Need help? Check our troubleshooting guide or open an issue.
