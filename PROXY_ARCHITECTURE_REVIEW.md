# HTTPS/WSS Proxy Architecture Review

## 🏗️ Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (HTTPS)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RPC Calls ──→ /api/rpc-proxy ──→ HTTP RPC Node (8545)    │
│                     ✅ WORKS                                 │
│                                                             │
│  WebSocket ──→ /api/ws-proxy ──→ WS RPC Node (8546)        │
│                     ❌ NOT IMPLEMENTED                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓
    [Caddy Reverse Proxy]
         ↓
    localhost:443 (HTTPS)
         ↓
    localhost:5051 (Next.js)
```

## 🔍 Issues Found

### **1. WebSocket Proxy is NOT Implemented** ❌

**File:** `src/app/api/ws-proxy/route.ts`  
**Lines 37-45:**
```typescript
// This is a simplified version - Next.js doesn't have built-in WebSocket support
// In production, you'd use a separate WebSocket server or a custom Next.js plugin
return new Response('WebSocket proxy requires custom server setup', {
  status: 501,  // ❌ NOT IMPLEMENTED
  headers: {
    'Content-Type': 'application/json'
  }
})
```

**Impact:** WebSocket connections on HTTPS **will fail** because:
- Browser blocks mixed content (WSS page → WS connection)
- The proxy route returns 501 error
- Real-time updates won't work on HTTPS deployments

### **2. Code Tries to Use Non-Existent Proxy** ⚠️

**File:** `src/lib/realtime-websocket.ts`  
**Lines 179-184:**
```typescript
if (isBrowser && isHttps) {
  // Use WSS proxy for HTTPS sites to avoid mixed content errors
  wsUrl = `${protocol}//${host}/api/ws-proxy?id=${this.connectionId}`
  // ❌ This will fail with 501 error!
}
```

**Current Behavior:**
- HTTP site: Direct WS connection ✅ Works
- HTTPS site: Tries proxy → Gets 501 error → Falls back to polling ⚠️

### **3. RPC Proxy Works Correctly** ✅

**File:** `src/app/api/rpc-proxy/route.ts`  
**Lines 9-46:**
```typescript
export async function POST(request: NextRequest) {
  const rpcRequest = await request.json()
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rpcRequest),
  })
  return NextResponse.json(await response.json())
}
```

**Status:** ✅ **Working correctly**
- Forwards RPC calls from browser to HTTP endpoint
- Returns responses properly
- No mixed content issues

### **4. Caddy Configuration is Correct** ✅

**File:** `Caddyfile`
```caddyfile
localhost:443 {
    tls internal
    reverse_proxy localhost:5051
    
    # WebSocket support
    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket localhost:5051
}
```

**Status:** ✅ **Correct**
- Properly detects WebSocket upgrade headers
- Routes WebSocket connections to Next.js
- But Next.js can't handle WebSocket upgrades natively!

## ⚠️ Root Problem

**Next.js API Routes do NOT support WebSocket upgrades!**

Next.js is built on Node.js HTTP server, which doesn't expose the raw socket needed for WebSocket upgrades. The API route can't:
- Access the underlying TCP socket
- Perform WebSocket handshake
- Maintain bidirectional connection

## 🔧 Solutions

### **Option 1: Remove WebSocket Proxy (Current State)**
**Pros:**
- Simple, no changes needed
- HTTP deployments work fine with direct WS connection
- Polling fallback works

**Cons:**
- HTTPS deployments can't use WebSocket (only polling)
- Slower updates on HTTPS (2-second polling vs real-time)

**Status:** This is what you currently have ✅

### **Option 2: Use Caddy as WebSocket Proxy**
**Caddy config:**
```caddyfile
# Proxy WebSocket to RPC node directly
wss://yourdomain.com/rpc-ws {
    reverse_proxy {
        to ws://35.196.101.134:8546
        header_up Host {upstream_hostport}
        header_up Upgrade {>Upgrade}
        header_up Connection {>Connection}
    }
}
```

**Then in client:**
```typescript
const wsUrl = isHttps 
  ? `wss://${host}/rpc-ws`  // Caddy proxies to RPC node
  : process.env.NEXT_PUBLIC_RETH_WS_URL
```

**Pros:**
- ✅ Actually works with HTTPS
- ✅ No Next.js code needed
- ✅ Caddy handles WebSocket natively

**Cons:**
- Requires Caddy configuration

### **Option 3: Separate WebSocket Server**
Run a separate Node.js WebSocket server on a different port.

**Pros:**
- Full control over WebSocket logic
- Can add authentication, rate limiting

**Cons:**
- More complex deployment
- Another service to manage

### **Option 4: Use SSE (Server-Sent Events)**
Replace WebSocket with SSE for one-way updates from server.

**Pros:**
- Works with Next.js API routes
- Simpler than WebSocket

**Cons:**
- One-way only (server → client)
- Less efficient than WebSocket

## 📊 Current Deployment Status

### **HTTP Deployment (localhost:5051)**
```
✅ Direct WebSocket to RPC node - WORKS
✅ Direct RPC calls - WORKS  
✅ Real-time updates - WORKS
```

### **HTTPS Deployment (localhost:443 via Caddy)**
```
⚠️ WebSocket fails (501 error) → Falls back to polling
✅ RPC calls via proxy - WORKS
⚠️ Updates every 2 seconds via polling (not real-time)
```

### **Production HTTPS (GKE/Cloud Run)**
```
⚠️ WebSocket won't work (same 501 issue)
✅ RPC proxy works
⚠️ Relies on 2-second polling fallback
```

## 🎯 Recommendation

### **Current State Analysis:**
Your app is **functional but not optimal** on HTTPS:
- ✅ RPC calls work (via proxy)
- ⚠️ WebSocket falls back to polling
- ⚠️ Real-time features degraded on HTTPS

### **Recommended Fix:**
**Implement Option 2 (Caddy WebSocket Proxy)**

This requires minimal changes:
1. Update Caddyfile to proxy `/rpc-ws` to RPC node
2. Update client to use `wss://host/rpc-ws` on HTTPS
3. Remove non-functional `/api/ws-proxy` route

**Effort:** ~30 minutes  
**Benefit:** True real-time updates on HTTPS deployments

### **Alternative (Current Approach):**
Accept that HTTPS uses polling:
- Remove `/api/ws-proxy` route (it's misleading)
- Update documentation to clarify HTTP=real-time, HTTPS=polling
- 2-second polling is "good enough" for most use cases

## 🐛 Bugs to Fix

1. **ws-proxy route is misleading** - Returns 501 but code tries to use it
2. **No error handling** - When ws-proxy fails, no clear logging
3. **Fallback happens silently** - Users don't know they're on polling mode

## ✅ What Works Well

1. **RPC proxy** - Clean, simple, works perfectly
2. **Polling fallback** - Reliable backup mechanism
3. **Caddy config** - Correct WebSocket detection
4. **Client-side detection** - Properly detects HTTPS and tries to use proxy

## 📝 Quick Fixes

### **Fix 1: Remove Non-Functional ws-proxy**
Delete `src/app/api/ws-proxy/route.ts` or make it return helpful error:

```typescript
export async function GET() {
  return NextResponse.json({
    error: 'WebSocket proxy not available. Use HTTP deployment for WebSocket support, or app will use polling fallback.'
  }, { status: 501 })
}
```

### **Fix 2: Better Client-Side Error Handling**
In `realtime-websocket.ts`, detect 501 and log clearly:

```typescript
this.ws.onerror = (error) => {
  console.log(`⚠️ WebSocket failed (probably HTTPS mixed content)`)
  console.log(`📡 Using 2-second polling fallback instead`)
}
```

### **Fix 3: Add Deployment Mode Indicator**
Show users if they're on real-time or polling mode in the UI.

Would you like me to implement any of these fixes?
