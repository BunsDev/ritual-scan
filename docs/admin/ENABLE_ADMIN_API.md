# Enabling Admin RPC API for Validator IP Discovery

This guide explains how to enable Method 1 from `VALIDATOR_IP_DISCOVERY.md` across your different network deployment setups.

## 🎯 Goal

Enable the `admin_peers` RPC API to discover validator IP addresses and network topology for visualization in the Ritual Scan dashboard.

---

## ✅ Status by Repository

### **1. ritual-node-internal (Local Development)**

**Status:** ✅ **ALREADY ENABLED**

**Location:** `/home/ritual/repos/ritual-node-internal/configgen/docker.py` (line 442)

```python
"--http.api=admin,net,eth,web3,debug,txpool,trace",
```

**Usage:** No changes needed! Just use the admin APIs:

```bash
# Get all connected peers with IPs
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}'
```

### **2. sim-framework (GCP Deployments)**

**Status:** ✅ **NOW ENABLED** (updated)

**Location:** `/home/ritual/repos/sim-framework/src/7_chain_deploy/templates/reth-pod.yaml.template`

**Changes Made:**
- Line 30: `--http.api=admin,net,eth,web3,debug,txpool,trace`
- Line 36: `--ws.api=admin,net,eth,web3,debug,txpool,trace`

**Next Steps:**
1. Redeploy your simulation with the updated template
2. The admin APIs will be available on all Reth nodes

### **3. ritual-reth-internal (Reth Binary)**

**Status:** ℹ️ **CLI FLAG**

When running Reth directly, add the flags:

```bash
reth node \
  --http.api admin,net,eth,web3,debug,txpool,trace \
  --ws.api admin,net,eth,web3,debug,txpool,trace \
  # ... other flags
```

---

## 🔧 Using the Admin API

### **Query Connected Peers**

```bash
curl -X POST http://RPC_URL:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"admin_peers",
    "params":[],
    "id":1
  }'
```

### **Expected Response**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "enode": "enode://abc123...@192.168.1.10:30303",
      "id": "abc123...",
      "name": "Reth/v1.0.0",
      "caps": ["eth/68", "eth/67"],
      "network": {
        "localAddress": "192.168.1.5:45678",
        "remoteAddress": "192.168.1.10:30303"
      },
      "protocols": {
        "eth": {
          "version": 68,
          "difficulty": "0x0",
          "head": "0xdef456..."
        }
      }
    }
  ]
}
```

### **Extract IP Addresses**

```javascript
// From enode URL
const peers = result.map(peer => {
  const match = peer.enode.match(/@(\d+\.\d+\.\d+\.\d+):/)
  return match ? match[1] : null
}).filter(Boolean)

// From network.remoteAddress
const peerIPs = result.map(peer => {
  return peer.network.remoteAddress.split(':')[0]
})

console.log('Peer IPs:', peerIPs)
// Output: ['192.168.1.10', '192.168.1.15', '192.168.1.20', ...]
```

---

## 📊 Integration with Ritual Scan

### **1. Add API Endpoint to Backend**

Create a new endpoint in your backend service to query peer data:

```typescript
// backend/src/api/network/peers.ts
import { ethers } from 'ethers'

export async function getPeerData(rpcUrl: string) {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  
  // Query admin_peers
  const peers = await provider.send('admin_peers', [])
  
  // Extract IPs
  const peerIPs = peers.map(peer => {
    const match = peer.enode.match(/@(\d+\.\d+\.\d+\.\d+):/)
    return {
      ip: match ? match[1] : null,
      id: peer.id,
      name: peer.name,
      enode: peer.enode
    }
  }).filter(p => p.ip)
  
  return peerIPs
}
```

### **2. Add Geographic Location Lookup**

```typescript
import MaxMind from 'maxmind'

const reader = await MaxMind.open('/path/to/GeoLite2-City.mmdb')

export async function enrichWithGeoData(peers) {
  return peers.map(peer => {
    const location = reader.get(peer.ip)
    return {
      ...peer,
      geo: {
        lat: location?.location?.latitude,
        lon: location?.location?.longitude,
        city: location?.city?.names?.en,
        country: location?.country?.iso_code
      }
    }
  })
}
```

### **3. Update Frontend Network Map**

```typescript
// frontend/src/components/NetworkMap.tsx
const fetchPeerLocations = async () => {
  const response = await fetch('/api/network/peers')
  const peers = await response.json()
  
  // Plot on map
  peers.forEach(peer => {
    if (peer.geo.lat && peer.geo.lon) {
      addMarkerToMap(peer.geo.lat, peer.geo.lon, peer.name)
    }
  })
}
```

---

## 🔒 Security Considerations

### **Production Deployments**

The `admin` namespace provides sensitive information. In production:

1. **Restrict Access:**
   ```bash
   # Only expose admin API on localhost
   --http.api admin,eth,web3
   --http.addr 127.0.0.1  # localhost only
   ```

2. **Use Reverse Proxy with Auth:**
   ```nginx
   location /admin {
     auth_basic "Admin Access";
     auth_basic_user_file /etc/nginx/.htpasswd;
     proxy_pass http://localhost:8545;
   }
   ```

3. **Firewall Rules:**
   ```bash
   # Only allow admin API from specific IPs
   iptables -A INPUT -p tcp --dport 8545 -s 10.0.0.0/8 -j ACCEPT
   iptables -A INPUT -p tcp --dport 8545 -j DROP
   ```

### **Development/Testing**

For local networks and simulations, the current open configuration is fine.

---

## 🚀 Next Steps

### **For ritual-node-internal:**
1. ✅ Admin API is already enabled
2. Start your local network: `make restart-network`
3. Test the API: `curl -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}'`

### **For sim-framework:**
1. ✅ Template updated with admin APIs
2. Redeploy simulation: Run your deployment scripts in `src/7_chain_deploy/`
3. Access admin API on each node at `http://<node-ip>:<http-port>`
4. Query peer data from any RPC endpoint

### **For Ritual Scan Dashboard:**
1. Implement backend endpoint to query `admin_peers`
2. Add GeoIP lookup for IP → Lat/Long conversion
3. Update frontend to display geographic network map
4. Add peer connection visualization (lines between nodes)

---

## 📝 Example: Full Integration

```typescript
// backend/src/api/network.ts
import { ethers } from 'ethers'
import MaxMind from 'maxmind'

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL)
const geoReader = await MaxMind.open('./GeoLite2-City.mmdb')

export async function getNetworkTopology() {
  // 1. Get connected peers
  const peers = await provider.send('admin_peers', [])
  
  // 2. Extract and enrich with geo data
  const topology = await Promise.all(
    peers.map(async peer => {
      const ipMatch = peer.enode.match(/@(\d+\.\d+\.\d+\.\d+):/)
      const ip = ipMatch ? ipMatch[1] : null
      
      if (!ip) return null
      
      const geo = geoReader.get(ip)
      
      return {
        nodeId: peer.id,
        name: peer.name,
        ip,
        location: {
          lat: geo?.location?.latitude,
          lon: geo?.location?.longitude,
          city: geo?.city?.names?.en,
          country: geo?.country?.iso_code
        },
        protocols: peer.protocols,
        caps: peer.caps
      }
    })
  )
  
  return topology.filter(Boolean)
}

// Express route
app.get('/api/network/topology', async (req, res) => {
  const topology = await getNetworkTopology()
  res.json(topology)
})
```

---

## 🎉 Summary

✅ **ritual-node-internal:** Admin API already enabled, ready to use  
✅ **sim-framework:** Admin API now enabled in Reth template  
✅ **Method 1 from VALIDATOR_IP_DISCOVERY.md:** Fully implemented  

You can now discover validator IPs, get geographic locations, and visualize the network topology in your Ritual Scan dashboard!
