# Validator IP Discovery for Summit BFT

## 🎯 The Goal

Get validator IP addresses and geographic locations to display on a network map.

## 📊 What We Have

**From Blocks (Execution Layer):**
- ✅ Validator addresses (from `block.miner`)
- ✅ Block counts
- ✅ Activity patterns
- ❌ NO IP addresses

## 🔍 Methods to Get Validator IPs

### **Method 1: Admin RPC APIs (BEST - requires node config)**

**Enable on RPC node:**
```bash
reth node --http.api eth,net,web3,admin
```

**Then use:**
```bash
# Get all connected peers with IPs
curl -X POST http://RPC_URL:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}'

# Returns:
{
  "result": [
    {
      "enode": "enode://pubkey@IP:PORT",
      "network": {"remoteAddress": "1.2.3.4:30303"},
      "protocols": {...}
    }
  ]
}
```

**Extract IPs from enode URLs:**
```javascript
const peers = result.map(peer => {
  const match = peer.enode.match(/@(\d+\.\d+\.\d+\.\d+):/)
  return match ? match[1] : null
})
```

### **Method 2: Consensus Layer (CL) P2P Network**

**Summit BFT runs separate consensus:**
- Each validator connects to all others (full mesh)
- P2P network on port 30303 (or custom)
- LibP2P or similar for peer discovery

**Access methods:**
1. Run your own validator node
2. Connect to CL P2P network
3. Query peers via libp2p multiaddr

**Potential consensus API:**
```bash
# If Ritual exposes CL API
curl http://CONSENSUS_NODE:5051/eth/v1/node/peers

# Returns peer data including IP/multiaddr
```

### **Method 3: On-Chain Validator Registry**

**Check if Ritual has a validator contract:**
```solidity
// Potential contract
contract ValidatorRegistry {
  struct Validator {
    address validator;
    string endpoint;  // Could include IP or domain
    uint256 stake;
  }
}
```

**Query via eth_call:**
```bash
curl -X POST http://RPC_URL:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"VALIDATOR_REGISTRY_ADDRESS",
      "data":"0x..."  # getValidators() selector
    }, "latest"],
    "id":1
  }'
```

### **Method 4: Network Scanning (NOT RECOMMENDED)**

Since Summit BFT requires full mesh (N*(N-1)/2 connections):
- Scan for nodes running on port 30303
- Look for Ritual/Summit protocol handshakes
- **Issues:** Slow, unreliable, may miss nodes behind NAT

### **Method 5: Bootnode/Discovery Service**

**Ritual chain likely has bootnodes:**
```
enode://bootnode1@IP1:30303
enode://bootnode2@IP2:30303
```

**Connect to discover peers:**
```bash
# Using geth's peer discovery protocol
curl http://BOOTNODE/admin_nodeInfo
```

---

## 🎯 Recommended Approach

### **Short-term (What We Implemented):**

✅ **Network topology visualization** showing:
- Validator nodes (from block.miner addresses)
- Full mesh connectivity (Summit BFT)
- Relative activity (node size = blocks proposed)
- Animated connections

**Without geographic data** - just topology

### **Long-term (Requires Infrastructure Access):**

**Option A: Enable admin APIs on RPC node**
```bash
# In Ritual node config
reth node --http.api eth,net,web3,admin,debug

# Then use admin_peers to get IPs
```

**Option B: Access Consensus Layer**
```bash
# Connect to CL API (if exposed)
curl http://CL_NODE:5051/eth/v1/node/peers

# Get peer multiaddrs with IPs
```

**Option C: Run Full Node**
```bash
# Run your own Ritual validator/full node
# Query local admin APIs
# Get peer list directly from P2P layer
```

---

## 🌍 Geographic Mapping (Once IPs Available)

**With IPs, use GeoIP database:**

```javascript
import MaxMind from 'maxmind'

const reader = await MaxMind.open('/path/to/GeoLite2-City.mmdb')

const peerIPs = ['1.2.3.4', '5.6.7.8', ...]
const geoData = peerIPs.map(ip => {
  const location = reader.get(ip)
  return {
    ip,
    lat: location?.location?.latitude,
    lon: location?.location?.longitude,
    city: location?.city?.names?.en,
    country: location?.country?.iso_code
  }
})
```

**Display on map:**
- Use D3.js or similar for world map projection
- Plot validators at geographic coordinates
- Draw connections between peers (full mesh)
- Color by activity/stake

---

## 📋 Current Implementation

**What works NOW:**
```
✅ Network topology (logical connections)
✅ Node sizing by activity
✅ Full mesh visualization (Summit BFT)
✅ Animated peer connections
✅ Real-time updates from WebSocket
```

**What needs infrastructure access:**
```
⏳ Geographic locations (need IPs)
⏳ Actual peer connectivity (need CL access)
⏳ Latency between peers (need monitoring)
```

---

## 🔧 Next Steps

**To get full geographic visualization:**

1. **Contact Ritual DevOps:**
   - Request admin RPC access
   - OR get consensus layer API endpoint
   - OR get validator registry contract address

2. **Alternative - Community Data:**
   - Crowdsource validator IPs
   - Validators self-report locations
   - Build community-maintained registry

3. **Run Own Infrastructure:**
   - Deploy full Ritual node
   - Enable all RPC/admin APIs
   - Query local peer data

For now, the topology map shows **network structure** without geographic data!

