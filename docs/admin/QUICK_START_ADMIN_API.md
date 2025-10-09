# Quick Start: Admin API for Validator Discovery

## TL;DR

**Admin RPC API Status:**
- ✅ `ritual-node-internal`: Already enabled, ready to use
- ✅ `sim-framework`: Just updated, redeploy to activate
- ℹ️ Direct Reth: Add `--http.api admin,net,eth,web3,debug,txpool,trace`

## Test It Now (Local Network)

```bash
# 1. Start your local network
cd ~/repos/ritual-node-internal
make restart-network

# 2. Query connected peers
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}' | jq

# 3. Extract IP addresses
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}' | \
  jq -r '.result[].enode' | \
  grep -oP '@\K[\d.]+(?=:)'
```

## Integration with Ritual Scan

### Backend API Endpoint

```typescript
// GET /api/network/peers
export async function getPeers(rpcUrl: string) {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const peers = await provider.send('admin_peers', [])
  
  return peers.map(p => {
    const ip = p.enode.match(/@(\d+\.\d+\.\d+\.\d+):/)?.[1]
    return { id: p.id, name: p.name, ip, enode: p.enode }
  }).filter(p => p.ip)
}
```

### Frontend Network Map

```typescript
// Fetch and display
const peers = await fetch('/api/network/peers').then(r => r.json())
peers.forEach(peer => console.log(`${peer.name}: ${peer.ip}`))
```

## What Changed

### sim-framework/src/7_chain_deploy/templates/reth-pod.yaml.template

**Before:**
```yaml
- --http.api=net,eth,web3,txpool
- --ws.api=net,eth,web3,txpool
```

**After:**
```yaml
- --http.api=admin,net,eth,web3,debug,txpool,trace
- --ws.api=admin,net,eth,web3,debug,txpool,trace
```

## Next Steps

1. **Test locally:** Use curl to verify admin_peers works
2. **Deploy to sim-framework:** Run deployment with updated template
3. **Add backend endpoint:** Implement `/api/network/peers`
4. **Add GeoIP:** Convert IPs to lat/long for map visualization
5. **Update frontend:** Display geographic network map

See `ENABLE_ADMIN_API.md` for full details and integration examples.
