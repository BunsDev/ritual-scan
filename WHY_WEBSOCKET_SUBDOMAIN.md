# Why ws.ding.fish? - Visual Explanation

## 🤔 The Core Problem

### **What You Want:**
```
User visits https://ding.fish
    ↓
Browser needs 2 types of connections:
    1. HTTPS for web pages (HTTP/2 is great!)
    2. WebSocket for real-time updates
```

### **What GKE Gives You:**

```
┌─────────────────────────────────────────────────┐
│  GKE HTTP(S) Load Balancer                      │
│  - Uses HTTP/2 protocol ✅                      │
│  - Great for web pages (fast, compressed)       │
│  - Terminates SSL ✅                            │
│  - BUT: HTTP/2 removed the "Upgrade" header ❌  │
│  - CAN'T do WebSocket upgrades ❌               │
└─────────────────────────────────────────────────┘
```

**HTTP/2 design decision:**
- HTTP/2 uses binary framing (not text)
- Multiplexes streams differently
- Removed the HTTP/1.1 "Upgrade" mechanism
- **WebSocket requires Upgrade header → Incompatible**

---

## 🔴 Current Broken Flow (Why WebSocket Fails)

```
Step 1: User's browser on https://ding.fish
    ↓
    Browser tries: wss://ding.fish/rpc-ws
    │
    ▼
┌─────────────────────────────────────────┐
│ GKE HTTP(S) Load Balancer               │
│ IP: 34.149.209.23                       │
│ Protocol: HTTP/2                        │
│                                         │
│ Receives:                               │
│   GET /rpc-ws HTTP/1.1                  │
│   Upgrade: websocket                    │
│   Connection: Upgrade                   │
│                                         │
│ Response:                               │
│   HTTP/2 502 Bad Gateway ❌             │
│   (HTTP/2 can't process Upgrade header) │
└─────────────────────────────────────────┘
    │
    ✗ WebSocket connection FAILS
    ↓
    App falls back to polling every 2 seconds
    (0-2 second random delay, avg 1s)
```

---

## ✅ Solution: Separate Subdomain for WebSocket

### **Why We Need ws.ding.fish:**

**You CAN'T have:**
- Single IP handling both HTTP/2 (for web) AND WebSocket
- GKE forces HTTP/2 on HTTP(S) Load Balancers
- No way to "turn off" HTTP/2 for specific paths

**You MUST have:**
- **Separate infrastructure** for WebSocket
- **Different type of load balancer** (TCP, not HTTP)
- **Different IP address**
- **Different DNS name** → ws.ding.fish

---

## ✅ New Working Flow (Dual Load Balancer)

```
User Browser at https://ding.fish
    │
    ├─── Web Page Traffic ─────────┬─── Real-Time Updates ─────┐
    │                              │                           │
    │ HTTPS requests               │ WebSocket connection      │
    │ GET /blocks, /analytics, etc │ wss://ws.ding.fish/       │
    │                              │                           │
    ▼                              │                           ▼
┌──────────────────────────┐      │      ┌──────────────────────────┐
│ DNS: ding.fish           │      │      │ DNS: ws.ding.fish        │
│ Returns: 34.149.209.23   │      │      │ Returns: 34.27.235.176   │
└──────────────────────────┘      │      └──────────────────────────┘
    │                              │                           │
    ▼                              │                           ▼
┌──────────────────────────────┐  │  ┌─────────────────────────────┐
│ HTTP(S) Load Balancer        │  │  │ TCP Load Balancer           │
│ Type: Layer 7 (Application)  │  │  │ Type: Layer 4 (Transport)   │
│ IP: 34.149.209.23            │  │  │ IP: 34.27.235.176           │
│ Port: 443                    │  │  │ Port: 443                   │
│ Protocol: HTTP/2 ✅          │  │  │ Protocol: Raw TCP ✅        │
│ SSL: Google-managed cert ✅  │  │  │ SSL: Passthrough ✅         │
│ WebSocket: ❌ NO             │  │  │ WebSocket: ✅ YES           │
│                              │  │  │                             │
│ Perfect for:                 │  │  │ Perfect for:                │
│ - HTML pages                 │  │  │ - WebSocket upgrades        │
│ - API calls                  │  │  │ - Long-lived connections    │
│ - Static assets              │  │  │ - Real-time streams         │
└──────────────────────────────┘  │  └─────────────────────────────┘
    │                              │                           │
    ▼                              │                           ▼
┌──────────────────────────────┐  │  ┌─────────────────────────────┐
│ GKE Ingress                  │  │  │ Direct Service (no Ingress) │
│ Routes /* to Service         │  │  │                             │
└──────────────────────────────┘  │  └─────────────────────────────┘
    │                              │                           │
    ▼                              │                           ▼
┌──────────────────────────────┐  │  ┌─────────────────────────────┐
│ ritual-explorer-service      │  │  │ caddy-ws-lb                 │
│ ClusterIP: 80 → 3000         │  │  │ LoadBalancer: 443 → 443     │
└──────────────────────────────┘  │  └─────────────────────────────┘
    │                              │                           │
    ▼                              │                           ▼
┌──────────────────────────────┐  │  ┌─────────────────────────────┐
│ Next.js Pods                 │  │  │ Caddy Proxy Pods            │
│ Port: 3000                   │  │  │ Port: 443                   │
│ - Serves HTML/CSS/JS         │  │  │ - Accepts WSS connection    │
│ - Client JS sees "ding.fish" │  │  │ - Proxies to RPC node       │
│   → connects to ws.ding.fish │  │  │                             │
└──────────────────────────────┘  │  └─────────────────────────────┘
                                  │                           │
                                  │                           ▼
                                  │  ┌─────────────────────────────┐
                                  │  │ RPC Node                    │
                                  │  │ ws://35.196.101.134:8546    │
                                  └─ │ (WebSocket endpoint)        │
                                     └─────────────────────────────┘
```

---

## 🔑 Key Insight: **Two DIFFERENT Types of Load Balancers**

### **Load Balancer #1: ding.fish (HTTP/2)**
```
Type: HTTP(S) Load Balancer
IP: 34.149.209.23
Protocol: HTTP/2
Can do: Web pages, API calls, static files
Can't do: WebSocket (HTTP/2 limitation)
```

### **Load Balancer #2: ws.ding.fish (TCP)**
```
Type: TCP Load Balancer
IP: 34.27.235.176
Protocol: Raw TCP (Layer 4)
Can do: WebSocket, long connections, any TCP
Can't do: Path routing, HTTP-specific features
```

**They're fundamentally different technologies!**

---

## 📱 Client-Side Logic (Automatic)

When your JavaScript runs:

```javascript
if (window.location.host.includes('ding.fish')) {
  // User is on https://ding.fish
  // Connect WebSocket to: wss://ws.ding.fish/
  
  // This AUTOMATICALLY routes to the TCP Load Balancer!
}
```

**User never sees ws.ding.fish in their browser bar!**
- They visit: https://ding.fish
- JavaScript invisibly connects: wss://ws.ding.fish
- User gets real-time updates
- All transparent!

---

## 🎯 Why You MUST Have 2 IPs

| Question | Answer |
|----------|--------|
| **Can I use 1 IP for both?** | ❌ NO - Different LB types need different IPs |
| **Can I use same IP with different ports?** | ❌ NO - Both need port 443 for SSL |
| **Can I use /rpc-ws path?** | ❌ NO - HTTP/2 LB breaks WebSocket regardless of path |
| **Can I disable HTTP/2?** | ❌ NO - GKE forces HTTP/2 on HTTP(S) LBs |
| **Do I need 2 domains?** | ✅ YES - Each IP needs a DNS name |

---

## 📊 Traffic Breakdown

### **Main Site Traffic (https://ding.fish):**
```
User Action:               Goes To:        Via:
────────────────────────────────────────────────────────
Visit homepage             ding.fish       HTTP(S) LB
Click "Blocks"            ding.fish       HTTP(S) LB
Load /analytics           ding.fish       HTTP(S) LB
Fetch /api/health         ding.fish       HTTP(S) LB

ALL visible URLs use ding.fish ✅
```

### **Background WebSocket (Invisible to User):**
```
JavaScript Code:           Connects To:    Via:
────────────────────────────────────────────────────────
new WebSocket('wss://...')  ws.ding.fish   TCP LB

User never types ws.ding.fish ✅
User never sees ws.ding.fish ✅
It's purely a backend connection ✅
```

---

## 🧪 What Happens After You Add DNS

**5 minutes after adding ws.ding.fish A record:**

```
1. User visits https://ding.fish
   ↓
2. Page loads (via 34.149.209.23 - HTTP/2 LB)
   ↓
3. JavaScript executes
   ↓
4. Code detects: window.location.host = "ding.fish"
   ↓
5. Code creates: new WebSocket('wss://ws.ding.fish/')
   ↓
6. DNS lookup: ws.ding.fish → 34.27.235.176
   ↓
7. TCP LB receives connection at 34.27.235.176:443
   ↓
8. Forwards to Caddy proxy pod
   ↓
9. Caddy proxies to ws://35.196.101.134:8546
   ↓
10. ✅ WebSocket connected!
    ↓
11. Real-time block updates stream in
    (10ms latency vs 1000ms polling!)
```

---

## 💡 Analogy

Think of it like having:

**Main building entrance** (ding.fish):
- Beautiful glass doors (HTTPS)
- Express elevator (HTTP/2)
- Fast for regular visitors
- ❌ But emergency stairwell (WebSocket) doesn't fit through revolving doors

**Separate service entrance** (ws.ding.fish):
- Utility door in back
- Direct access for deliveries (WebSocket)
- Same building, different entrance
- ✅ Long-term delivery trucks can stay parked here

**Users enter main entrance, but backend services use service entrance!**

---

## ✅ Summary

**Why ws.ding.fish:**
1. HTTP/2 Load Balancer can't do WebSocket (technical limitation)
2. Need TCP Load Balancer for WebSocket
3. TCP LB needs its own IP (34.27.235.176)
4. That IP needs a DNS name → ws.ding.fish
5. Client code automatically uses it (transparent to user)

**What to do:**
- Add DNS record: `ws` → `34.27.235.176`
- Wait 10 minutes
- WebSocket will just work!

**Users will never see ws.ding.fish - it's purely for the backend WebSocket connection.** They'll only ever type/see `ding.fish` in their browser! 🎯

