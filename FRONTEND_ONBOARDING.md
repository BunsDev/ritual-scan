# Frontend Engineer Onboarding - Ritual Scan

## 🎯 Project Overview

**Ritual Scan** is a blockchain explorer for **Ritual Chain** - a specialized Ethereum-compatible blockchain with unique features:
- Custom transaction types (Scheduled, Async Commitment/Settlement)
- Sub-1 second block times
- Real-time WebSocket updates
- Smart caching architecture for instant page loads

**Live Site**: https://ding.fish

---

## 🏗️ Architecture Philosophy

### **Core Principle: Cache-First, Real-Time Updates**

Unlike traditional block explorers that fetch data on every page load, Ritual Scan:

1. **Accumulates data in background** (500-block rolling cache)
2. **Serves pages instantly** from cache (< 100ms load times)
3. **Updates real-time** via WebSocket subscriptions

**Performance Achievement**: Charts/Stats pages went from 5-20s → < 100ms (98-99% faster)

---

## 📚 Tech Stack

### **Framework & Language**
- **Next.js 15** (App Router, React 19)
- **TypeScript** (100% typed)
- **Tailwind CSS** + Radix UI components
- **Turbopack** for fast dev builds

### **Blockchain Interaction**
- **Custom RPC Client** (`reth-client.ts`) - wraps JSON-RPC calls
- **Viem** for wallet interactions (faucet, transactions)
- **Wagmi** for wallet connection (MetaMask, WalletConnect, Coinbase)

### **Real-Time Data**
- **WebSocket Manager** (`realtime-websocket.ts`) - singleton pattern
- **Event subscriptions** (newHeads, newPendingTransactions)
- **Smart caching** with localStorage persistence

### **Visualization**
- **Plotly.js** for charts/graphs
- **D3.js** for custom visualizations (world map)
- **Recharts** for simpler charts

---

## 🗂️ Project Structure

```
ritual-scan/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── page.tsx             # Homepage (dashboard)
│   │   ├── blocks/page.tsx      # Block explorer
│   │   ├── transactions/page.tsx # Transaction feed
│   │   ├── analytics/page.tsx   # Charts (OPTIMIZED)
│   │   ├── ritual-analytics/    # Stats (OPTIMIZED)
│   │   ├── validators/page.tsx  # Validator map
│   │   ├── mempool/page.tsx     # Live mempool
│   │   ├── scheduled/page.tsx   # Scheduled transactions
│   │   ├── async/page.tsx       # Async transactions
│   │   ├── settings/page.tsx    # RPC configuration
│   │   ├── address/[address]/   # Address details
│   │   ├── block/[number]/      # Block details
│   │   ├── tx/[hash]/           # Transaction details
│   │   └── api/
│   │       └── rpc-proxy/       # HTTPS→HTTP RPC proxy
│   │
│   ├── components/              # React components
│   │   ├── Navigation.tsx       # Main nav bar
│   │   ├── ConnectWalletButton.tsx  # Wallet integration
│   │   ├── SearchBar.tsx        # Search with Call ID support
│   │   ├── ValidatorWorldMap.tsx    # D3 world map
│   │   └── ui/                  # Radix UI components
│   │
│   ├── lib/                     # Core libraries (THE HEART)
│   │   ├── reth-client.ts       # ⭐ RPC client wrapper
│   │   ├── realtime-websocket.ts # ⭐ WebSocket manager
│   │   └── wagmi-config.ts      # Wallet configuration
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useParticleBackground.ts
│   │   └── useRealtimeTier1.ts
│   │
│   └── types/                   # TypeScript types
│
├── k8s/                         # Kubernetes manifests
├── public/                      # Static assets
├── .env.local                   # Local dev env (NOT committed)
├── .env.production              # Production env (committed - no secrets)
└── deploy-to-ding-fish.sh      # Production deployment script
```

---

## 🧠 Core Concepts

### 1. **The WebSocket Manager** (`realtime-websocket.ts`)

**Pattern**: Singleton stored in `window.__realtimeManager`

**Purpose**: Single WebSocket connection shared across all pages

**Features**:
- **Global Cache**: 500 blocks (rolling window, shared across pages)
- **Per-Page Windows**: 1000 blocks per page (expanding window)
- **localStorage Persistence**: Survives page refreshes
- **Auto-reconnection**: Exponential backoff
- **Polling Fallbacks**: When WebSocket fails

**API**:
```typescript
const manager = getRealtimeManager()

// Subscribe to updates
const unsubscribe = manager.subscribe('my-page', (update) => {
  if (update.type === 'newBlock') {
    console.log('New block:', update.data)
  }
})

// Get cached data
const blocks = manager.getCachedBlocks() // Global cache
const pageBlocks = manager.getPageBlockWindow('analytics') // Page-specific
```

**Cache Priority**:
```
1. Global Cache (500 blocks) → instant load
   ↓ (if empty)
2. Per-Page Window (1000 blocks) → fast load
   ↓ (if empty)
3. API Fetch (50-100 blocks) → slow (first visit only)
```

---

### 2. **The RPC Client** (`reth-client.ts`)

**Pattern**: Singleton instance exported as `rethClient`

**Key Feature**: Automatic HTTPS→HTTP proxy for mixed content

**How It Works**:
```typescript
// On HTTPS (ding.fish), automatically uses /api/rpc-proxy
// On HTTP (localhost), direct RPC calls

const blockNumber = await rethClient.getLatestBlockNumber()
const block = await rethClient.getBlock(12345, true) // with transactions
const tx = await rethClient.getTransaction(hash)
```

**User-Configurable**: Settings page lets users change RPC endpoint at runtime

---

### 3. **Ritual Chain Transaction Types**

Standard Ethereum + Custom types:

| Type | Hex | Description | System Account |
|------|-----|-------------|----------------|
| Legacy | 0x0 | Standard Ethereum | N/A |
| EIP-1559 | 0x2 | Modern gas model | N/A |
| **Scheduled** | **0x10** | Cron-like execution | 0x...fa7e |
| **Async Commitment** | **0x11** | TEE execution start | 0x...fa8e |
| **Async Settlement** | **0x12** | Final settlement | 0x...fa9e |

**Why It Matters**: You need to handle these custom types in UI (badges, flows, special pages)

---

### 4. **The /api/rpc-proxy Route**

**Problem**: HTTPS site can't fetch HTTP RPC (mixed content blocked)

**Solution**: Next.js API route proxies requests server-side

```typescript
// Browser on ding.fish (HTTPS)
fetch('/api/rpc-proxy', { 
  method: 'POST',
  body: JSON.stringify({ method: 'eth_blockNumber', params: [] })
})

// Server forwards to HTTP RPC
// Returns response to browser
```

**Smart Feature**: Reads `x-rpc-url` header for dynamic RPC switching

---

## 📊 Data Flow Examples

### **Example 1: Charts Page Load (Optimized)**

```
User clicks "Charts" →
  ↓
Page checks global cache (getRealtimeManager().getCachedBlocks())
  ↓
Cache has 500 blocks → INSTANT LOAD (< 100ms) ✅
  ↓
Subscribes to WebSocket for updates
  ↓
New blocks arrive → Charts update in real-time
```

### **Example 2: Address Page**

```
User enters address →
  ↓
Fetch balance + tx count (2 RPC calls)
  ↓
Search cached blocks for transactions (500 blocks available)
  ↓
Display transactions instantly
  ↓
Subscribe to new blocks
  ↓
Check each new block for address transactions
  ↓
Update in real-time
```

### **Example 3: Wallet Connection + Faucet**

```
User clicks "Connect Wallet" →
  ↓
Wagmi opens wallet selection modal
  ↓
User selects MetaMask/WalletConnect/Coinbase
  ↓
Wallet connects → address available
  ↓
Auto-trigger faucet (ONE TIME per address)
  ↓
Viem sends 100 RITUAL tokens
  ↓
Transaction completes in < 1 second
  ↓
Mark address in localStorage (prevent retry)
```

---

## 🔑 Key Files to Understand

### **1. `src/lib/realtime-websocket.ts`** (600+ lines)
- **What**: WebSocket manager singleton
- **Why Important**: Powers all real-time updates + caching
- **Key Methods**:
  - `getRealtimeManager()` - Get singleton instance
  - `subscribe(id, callback)` - Listen for updates
  - `getCachedBlocks()` - Get global cache
  - `getPageBlockWindow(pageId)` - Get per-page cache

### **2. `src/lib/reth-client.ts`** (500+ lines)
- **What**: RPC client wrapper
- **Why Important**: All blockchain data goes through this
- **Key Methods**:
  - `rpcCall(method, params)` - Generic RPC call
  - `getBlock(number, includeTxs)` - Fetch block
  - `getTransaction(hash)` - Fetch transaction
  - `testConnection(url)` - Test RPC endpoint

### **3. `src/app/analytics/page.tsx`** (1200+ lines)
- **What**: Charts dashboard (RECENTLY OPTIMIZED)
- **Why Important**: Example of cache-first pattern
- **Key Concept**: 
  ```typescript
  // Priority 1: Global cache
  const globalBlocks = manager.getCachedBlocks()
  if (globalBlocks.length > 0) {
    // INSTANT LOAD
  }
  ```

### **4. `src/components/ConnectWalletButton.tsx`** (300 lines)
- **What**: Wallet integration + faucet
- **Why Important**: Shows Wagmi/Viem usage
- **Key Features**:
  - Auto-faucet on connect
  - Network addition to MetaMask
  - One-time-per-address logic

### **5. `src/app/api/rpc-proxy/route.ts`** (66 lines)
- **What**: HTTPS→HTTP proxy
- **Why Important**: Solves mixed content issue
- **How It Works**: Reads request → forwards to RPC → returns response

---

## 🚀 Development Workflow

### **Local Development**

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local
cp env.example .env.local
# Edit with your settings (or use defaults)

# 3. Start dev server (runs on port 5555)
npm run dev

# 4. Open browser
open http://localhost:5555
```

### **Key Dev URLs**
- Homepage: http://localhost:5555
- Charts: http://localhost:5555/analytics (check cache performance)
- Stats: http://localhost:5555/ritual-analytics
- Settings: http://localhost:5555/settings (change RPC endpoint)

### **Testing Changes**

```bash
# TypeScript check
npm run type-check

# Lint
npm run lint

# Build production (tests build-time issues)
npm run build
```

---

## 🔧 Common Dev Tasks

### **Task 1: Add a New Page**

```typescript
// src/app/my-page/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'

export default function MyPage() {
  const [data, setData] = useState([])
  
  useEffect(() => {
    // Get cached data instantly
    const manager = getRealtimeManager()
    const cached = manager?.getCachedBlocks()
    if (cached) setData(cached)
    
    // Subscribe to updates
    const unsubscribe = manager?.subscribe('my-page', (update) => {
      if (update.type === 'newBlock') {
        // Handle new block
      }
    })
    
    return () => unsubscribe?.()
  }, [])
  
  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="my-page" />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Your content */}
      </main>
    </div>
  )
}
```

### **Task 2: Make RPC Calls**

```typescript
import { rethClient } from '@/lib/reth-client'

// Fetch latest block
const blockNum = await rethClient.getLatestBlockNumber()

// Fetch block with transactions
const block = await rethClient.getBlock(blockNum, true)

// Fetch transaction
const tx = await rethClient.getTransaction(hash)

// Custom RPC call
const result = await rethClient.rpcCall('eth_getBalance', [address, 'latest'])
```

### **Task 3: Add to Navigation**

```typescript
// src/components/Navigation.tsx
const NAV_ITEMS = [
  // ... existing items
  { href: '/my-page', label: 'My Page', key: 'my-page' },
]
```

---

## 🐛 Common Issues & Solutions

### **Issue 1: "Failed to fetch RPC"**
**Cause**: RPC endpoint not reachable
**Solution**: Check Settings page, test RPC connection

### **Issue 2: "WebSocket connection failed"**
**Cause**: WebSocket endpoint not reachable or wrong protocol (ws/wss)
**Solution**: Check browser console, falls back to polling automatically

### **Issue 3: "Cache is empty on page load"**
**Cause**: First visit before cache builds
**Solution**: Wait 10-20 seconds, cache accumulates in background

### **Issue 4: "WalletConnect 403 errors"**
**Cause**: Domain not whitelisted in WalletConnect project
**Solution**: Add domain to https://cloud.walletconnect.com project settings

### **Issue 5: "Page loads slowly"**
**Cause**: Not using cache (making direct RPC calls)
**Solution**: Use `getCachedBlocks()` first, fall back to RPC if empty

---

## 📈 Performance Best Practices

### **DO ✅**
- Use global cache first (`getCachedBlocks()`)
- Use per-page windows for extended datasets
- Subscribe to WebSocket for updates
- Batch RPC calls when possible
- Use React.memo for expensive components

### **DON'T ❌**
- Fetch 50-100 blocks on every page load (use cache!)
- Make sequential RPC calls in loops (use `Promise.all`)
- Ignore cache and always fetch fresh (defeats the purpose)
- Subscribe without cleanup (causes memory leaks)
- Fetch full blocks when you only need headers

---

## 🚢 Deployment

### **Production Deployment**

```bash
# Deploy to ding.fish (GKE)
./deploy-to-ding-fish.sh

# What it does:
# 1. Builds Docker image (with .env.production)
# 2. Pushes to Google Container Registry
# 3. Updates Kubernetes deployment
# 4. Waits for rollout
# 5. Verifies deployment
```

### **Environment Variables**

**Build-time** (baked into bundle):
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_RETH_RPC_URL`
- `NEXT_PUBLIC_RETH_WS_URL`

**Runtime** (can change without rebuild):
- None currently (all NEXT_PUBLIC_ are build-time)

**Important**: `NEXT_PUBLIC_*` vars must be in `.env.production` for Docker builds!

---

## 🎓 Learning Path for New Engineers

### **Week 1: Understand the Stack**
1. Read this document thoroughly
2. Run local dev, browse the site
3. Read `realtime-websocket.ts` - understand caching
4. Read `reth-client.ts` - understand RPC calls
5. Read `analytics/page.tsx` - see cache-first pattern

### **Week 2: Make Small Changes**
1. Add a new stat card to homepage
2. Add a new chart to analytics
3. Modify validator map styling
4. Add a new filter to transactions page

### **Week 3: Feature Work**
1. Pick a feature from backlog
2. Implement using cache-first pattern
3. Test locally
4. Deploy to staging (if available)
5. Code review + merge

---

## 🆘 Getting Help

### **Code Questions**
- Check comments in key files (heavily documented)
- Search for similar patterns in codebase
- Check browser console (we log a lot)

### **Blockchain/Ritual Questions**
- Understand Ethereum basics first
- Ritual Chain is Ethereum-compatible + custom tx types
- System accounts: fa7e (scheduled), fa8e (commitment), fa9e (settlement)

### **Performance Questions**
- Use browser DevTools Performance tab
- Check Network tab for RPC calls
- Look for `getCachedBlocks()` usage

---

## 📊 Metrics to Monitor

### **Performance**
- Page load time: **Target < 500ms**
- Charts page: **Target < 100ms** (from cache)
- Time to first block: **Target < 2 seconds**

### **Cache**
- Global cache size: **500 blocks max**
- Per-page window: **1000 blocks max**
- localStorage size: **Monitor, can hit quota**

### **WebSocket**
- Connection uptime: **Monitor reconnections**
- Message rate: **~0.5-2 blocks/sec**
- Subscription count: **Should match open pages**

---

## 🎯 Current State (v1.0.0)

**What Works** ✅
- Real-time WebSocket updates
- Smart 500-block global cache
- Instant page loads (< 100ms)
- Wallet integration (MetaMask, WalletConnect, Coinbase)
- Auto-faucet (100 RITUAL tokens)
- HTTPS/WSS support via Cloudflare
- Custom transaction type handling
- Validator world map
- Charts + Stats dashboards

**Known Issues** ⚠️
- Validator map uses placeholder data (no real geolocation)
- Faucet may timeout occasionally (30s timeout)
- Cache takes 10-20s to build on first load

**Future Improvements** 🔮
- Real validator geolocation (need admin_peers RPC + GeoIP)
- Contract verification UI
- Token tracking
- Advanced search
- Historical data pagination

---

## 🎉 You're Ready!

You now understand:
- ✅ Architecture (cache-first, real-time)
- ✅ Tech stack (Next.js, WebSocket, Viem/Wagmi)
- ✅ Core concepts (caching, RPC proxy, custom tx types)
- ✅ File structure
- ✅ Development workflow

**Next steps**: Clone the repo, run it locally, start browsing the code!

Welcome to Ritual Scan! 🚀

---

*Last updated: 2025-10-06*
*Version: v1.0.0*
*Maintainer: Ritual Network Team*
