# WebSocket on HTTPS - E2E Architecture Flow

## 🔴 Current Broken State

```
User Browser (https://ding.fish)
    │
    ├─── HTTPS Traffic ─────────────────────────┐
    │                                           │
    │   wss://ding.fish/rpc-ws                  │
    │           │                               │
    │           ▼                               ▼
    │    ┌──────────────────────────────────────────────┐
    │    │  GKE HTTP(S) Load Balancer (Layer 7)        │
    │    │  - SSL Termination ✅                        │
    │    │  - HTTP/2 Protocol ❌                        │
    │    │  - Can't handle Upgrade header               │
    │    └──────────────────────────────────────────────┘
    │           │                               │
    │           │                               │
    │           ▼ (WebSocket request)           ▼ (HTTP request)
    │    ┌──────────────┐              ┌──────────────────┐
    │    │ Caddy Proxy  │              │  Next.js App     │
    │    │ :8546        │              │  :3000           │
    │    │  ❌ 502      │              │  ✅ 200 OK       │
    │    └──────────────┘              └──────────────────┘
    │           │
    │           ▼
    │    ws://35.196.101.134:8546
    │    (RPC WebSocket Node)
    │
    └─── Problem: HTTP/2 doesn't support WebSocket Upgrade header
```

---

## ✅ Solution A: Separate WebSocket Endpoint (Recommended)

```
User Browser (https://ding.fish)
    │
    ├─── Main Traffic ──────────────────────────┬─── WebSocket Traffic ────────┐
    │                                           │                              │
    │   https://ding.fish/*                     │   wss://ws.ding.fish/        │
    │           │                               │           │                  │
    │           ▼                               │           ▼                  │
    │    ┌──────────────────────┐               │    ┌──────────────────────┐ │
    │    │  HTTP(S) LB          │               │    │  TCP/SSL Proxy LB    │ │
    │    │  (Layer 7)           │               │    │  (Layer 4 + SSL)     │ │
    │    │  - Port 443          │               │    │  - Port 443          │ │
    │    │  - HTTP/2 ✅         │               │    │  - Raw TCP + TLS ✅  │ │
    │    │  - SSL term ✅       │               │    │  - No Upgrade needed │ │
    │    └──────────────────────┘               │    └──────────────────────┘ │
    │           │                               │           │                  │
    │           ▼                               │           ▼                  │
    │    ┌──────────────────────┐               │    ┌──────────────────────┐ │
    │    │  Next.js App         │               │    │  Caddy WS Proxy      │ │
    │    │  Pod 1, Pod 2        │               │    │  Pod 1, Pod 2        │ │
    │    │  :3000               │               │    │  :8546               │ │
    │    │  ✅ HTTP/2 OK        │               │    │  ✅ WebSocket OK     │ │
    │    └──────────────────────┘               │    └──────────────────────┘ │
    │                                           │           │                  │
    │                                           │           ▼                  │
    └───────────────────────────────────────────┴──  ws://35.196.101.134:8546 │
                                                    (RPC WebSocket Node)       │
                                                                               │
Configuration:                                                                 │
- DNS: ding.fish → 34.149.209.23 (HTTP(S) LB)                                │
- DNS: ws.ding.fish → <NEW_TCP_LB_IP> (TCP/SSL LB)                           │
- 2 Static IPs                                                                │
- Client uses: wss://ws.ding.fish/ (subdomain)                               │
```

**Pros:**
- ✅ True WebSocket support
- ✅ Separate SSL termination per service
- ✅ Clean separation of concerns

**Cons:**
- ⚠️ Requires subdomain (ws.ding.fish)
- ⚠️ Requires 2nd static IP
- ⚠️ Client code update (wss://ws.ding.fish vs wss://ding.fish/rpc-ws)

---

## ✅ Solution B: Single TCP/SSL Load Balancer (All Traffic)

```
User Browser (https://ding.fish)
    │
    ├─── ALL Traffic (HTTPS + WebSocket) ───────────────┐
    │                                                    │
    │   https://ding.fish/*                             │
    │   wss://ding.fish/*                               │
    │           │                                        │
    │           ▼                                        │
    │    ┌──────────────────────────────────────────┐   │
    │    │  TCP/SSL Proxy Load Balancer             │   │
    │    │  (Layer 4 with SSL termination)          │   │
    │    │  - Port 443                              │   │
    │    │  - Terminates TLS ✅                     │   │
    │    │  - Forwards raw TCP ✅                   │   │
    │    │  - No path routing ❌                    │   │
    │    └──────────────────────────────────────────┘   │
    │           │                                        │
    │           ▼                                        │
    │    ┌──────────────────────────────────────────┐   │
    │    │  Caddy (Full Reverse Proxy)              │   │
    │    │  - Handles BOTH HTTP and WebSocket       │   │
    │    │  - Path routing: /*  → Next.js :3000     │   │
    │    │  - Path routing: /rpc-ws → RPC :8546     │   │
    │    └──────────────────────────────────────────┘   │
    │           │                  │                     │
    │           ▼                  ▼                     │
    │    ┌─────────────┐    ┌──────────────────┐        │
    │    │ Next.js App │    │ ws://RPC:8546    │        │
    │    │ :3000       │    │ (WebSocket Node) │        │
    │    └─────────────┘    └──────────────────┘        │
```

**Pros:**
- ✅ Single IP, single domain
- ✅ Path-based routing works (/rpc-ws)
- ✅ True WebSocket support

**Cons:**
- ⚠️ ALL traffic goes through Caddy (extra hop)
- ⚠️ Caddy becomes critical path for app
- ⚠️ More complex Caddy config

---

## ✅ Solution C: NodePort + External Load Balancer (Simplest)

```
User Browser (https://ding.fish)
    │
    ├─── Main Traffic ──────┬─── WebSocket ────────────────┐
    │                       │                              │
    │   https://ding.fish/* │  wss://ding.fish:8546/       │
    │           │           │           │                  │
    │           ▼           │           ▼                  │
    │    ┌─────────────┐    │    ┌──────────────────────┐ │
    │    │ HTTP(S) LB  │    │    │  Direct to NodePort  │ │
    │    │ :443        │    │    │  :8546 (public)      │ │
    │    └─────────────┘    │    └──────────────────────┘ │
    │           │           │           │                  │
    │           ▼           │           ▼                  │
    │    ┌─────────────┐    │    ┌──────────────────────┐ │
    │    │ Next.js     │    │    │  Caddy Proxy         │ │
    │    │ :3000       │    │    │  :8546               │ │
    │    └─────────────┘    │    └──────────────────────┘ │
    │                       │           │                  │
    │                       │           ▼                  │
    │                       └──  ws://35.196.101.134:8546 │
    │                           (RPC Node)                 │
```

**Pros:**
- ✅ Simple, no extra load balancer
- ✅ Direct WebSocket access

**Cons:**
- ❌ Requires different port (wss://ding.fish:8546)
- ❌ Non-standard (users expect :443)
- ❌ Firewall issues

---

## ✅ Solution D: Accept Polling (Current, Actually Works)

```
User Browser (https://ding.fish)
    │
    ├─── ALL Traffic (HTTPS only) ──────────────────────┐
    │                                                    │
    │   https://ding.fish/*                             │
    │           │                                        │
    │           ▼                                        │
    │    ┌──────────────────────────────────────────┐   │
    │    │  HTTP(S) Load Balancer                   │   │
    │    │  - SSL Termination ✅                    │   │
    │    │  - HTTP/2 ✅                             │   │
    │    └──────────────────────────────────────────┘   │
    │           │                                        │
    │           ▼                                        │
    │    ┌──────────────────────────────────────────┐   │
    │    │  Next.js App (ritual-explorer)           │   │
    │    │  - Tries WebSocket → Fails               │   │
    │    │  - Falls back to 2-second polling ✅     │   │
    │    │  - Polls: /api/... every 2 seconds       │   │
    │    └──────────────────────────────────────────┘   │
    │           │                                        │
    │           ▼                                        │
    │    https://ding.fish/api/rpc-proxy                │
    │           │ (JSON-RPC over HTTPS)                 │
    │           ▼                                        │
    │    http://35.196.101.134:8545                     │
    │    (RPC HTTP endpoint)                            │
```

**Current Performance:**
- Updates: Every 2 seconds
- Latency: ~200-500ms per poll
- User perception: Appears real-time

**Pros:**
- ✅ Working RIGHT NOW
- ✅ Zero config changes
- ✅ Proven stable

**Cons:**
- ⚠️ Not truly real-time (2s vs instant)
- ⚠️ Higher server load (polling)

---

## 🎯 MY ACTUAL RECOMMENDATION: Solution A (Separate WebSocket Endpoint)

You're right that WebSocket is better. Here's the proper fix:

### **Implementation:**

```bash
# 1. Create TCP/SSL Load Balancer for WebSocket
gcloud compute addresses create ws-ding-fish-ip --global --project=testing-logging-2

# 2. Get the IP
WS_IP=$(gcloud compute addresses describe ws-ding-fish-ip --global --format="value(address)")

# 3. Add DNS record
# ws.ding.fish A $WS_IP

# 4. Create TCP/SSL Proxy for WebSocket
# (I'll create the YAML for this)

# 5. Update client code
# Change: wss://ding.fish/rpc-ws
# To:     wss://ws.ding.fish/
```

### **E2E Flow (Final):**

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Browser                                 │
│                    (https://ding.fish)                          │
└─────────────────────────────────────────────────────────────────┘
         │                                  │
         │ Main Site                        │ WebSocket
         │ https://ding.fish/*              │ wss://ws.ding.fish/
         ▼                                  ▼
┌─────────────────────────┐      ┌──────────────────────────────┐
│ HTTP(S) Load Balancer   │      │ TCP/SSL Proxy Load Balancer  │
│ IP: 34.149.209.23       │      │ IP: <NEW_WS_IP>              │
│ Port: 443               │      │ Port: 443                    │
│ Protocol: HTTP/2        │      │ Protocol: TCP + TLS          │
│ SSL: Google-managed ✅  │      │ SSL: Google-managed ✅       │
└─────────────────────────┘      └──────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────────┐      ┌──────────────────────────────┐
│ GKE Ingress             │      │ TCP Forwarding (no ingress)  │
│ Routes: /* → Service    │      │ Direct to Service            │
└─────────────────────────┘      └──────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────────┐      ┌──────────────────────────────┐
│ ritual-explorer-service │      │ caddy-ws-proxy-service       │
│ ClusterIP               │      │ ClusterIP                    │
│ Port: 80 → 3000         │      │ Port: 443 → 8546             │
└─────────────────────────┘      └──────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────────┐      ┌──────────────────────────────┐
│ Next.js Pods            │      │ Caddy Proxy Pods             │
│ ritual-explorer-xxx     │      │ caddy-ws-proxy-xxx           │
│ Port: 3000              │      │ Port: 8546                   │
│ - Serves HTML/JS/CSS    │      │ - Proxies WebSocket          │
│ - Serves API routes     │      │ - Maintains connections      │
└─────────────────────────┘      └──────────────────────────────┘
                                          │
                                          ▼
                                 ┌──────────────────────────────┐
                                 │ External RPC Node            │
                                 │ ws://35.196.101.134:8546     │
                                 │ (Ritual Chain WebSocket)     │
                                 └──────────────────────────────┘
```

**DNS Configuration:**
```
ding.fish      A    34.149.209.23  (HTTP(S) LB)
ws.ding.fish   A    <NEW_TCP_LB_IP> (TCP/SSL Proxy)
www.ding.fish  CNAME ding.fish
```

**Client Code:**
```javascript
if (isHttps) {
  wsUrl = host.includes('ding.fish') 
    ? 'wss://ws.ding.fish/'      // Subdomain for WebSocket
    : 'wss://localhost/rpc-ws'    // Local Caddy path
}
```

---

## 📊 Performance Comparison

### **Current (Polling):**
```
Request Flow:
Browser → Poll every 2s → HTTPS LB → Next.js → RPC Proxy → RPC Node

Timeline:
Block mined at T=0
Next poll at T=0-2s (random)
User sees update: 0-2s delay (avg 1s)
```

### **With WebSocket (Solution A):**
```
Request Flow:
Browser ←─ WebSocket ←─ TCP/SSL LB ←─ Caddy ←─ RPC Node

Timeline:
Block mined at T=0
WebSocket push at T=0.01s
User sees update: ~10ms delay
```

**Performance Gain:** 1000ms → 10ms = **100x faster!** 🚀

---

## 🔧 Implementation Steps for Solution A

Want me to implement this? It requires:

1. Create TCP/SSL Proxy Load Balancer
2. Reserve new static IP for ws.ding.fish
3. Add DNS record for ws.ding.fish
4. Update client code to use ws.ding.fish
5. Configure SSL certificate for ws.ding.fish
6. Deploy and test

**Time:** ~30 minutes  
**Complexity:** Medium  
**Result:** True real-time WebSocket on HTTPS

Should I proceed? 🚀

