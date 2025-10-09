# Frontend Engineer Onboarding

## Project Overview

Blockchain explorer for Ritual Chain (Ethereum-compatible with custom transaction types). Live at https://ding.fish.

Key differences from standard Ethereum:
- Custom transaction types: Scheduled (0x10), Async Commitment (0x11), Async Settlement (0x12)
- Block times under 1 second
- System accounts at 0x...fa7e, fa8e, fa9e

## Architecture

The core design is cache-first with real-time updates. Most explorers fetch on every page load. We accumulate blocks in a background cache and serve from there.

- 500-block rolling cache shared globally
- Per-page windows up to 1000 blocks
- WebSocket subscriptions for live updates
- Falls back to polling if WS fails

This reduced our Charts/Stats page load from 5-20s to under 100ms by eliminating 50-100 sequential RPC calls

## Tech Stack

- Next.js 15 (App Router, React 19), TypeScript
- Tailwind CSS + Radix UI
- Turbopack for dev builds
- Viem for wallet transactions, Wagmi for connection management
- Plotly + D3 for visualizations
- Custom RPC client wrapping JSON-RPC
- WebSocket manager (singleton) with localStorage persistence

## Project Structure

```
ritual-scan/
├── src/                          # Application source
│   ├── app/                      # Next.js pages (App Router)
│   │   ├── page.tsx              # Homepage
│   │   ├── analytics/            # Charts (cache-optimized)
│   │   ├── ritual-analytics/     # Stats (cache-optimized)
│   │   ├── blocks/               # Block explorer
│   │   ├── transactions/         # Transaction feed
│   │   ├── validators/           # Validator map
│   │   ├── mempool/              # Live mempool
│   │   ├── scheduled/            # Scheduled transactions
│   │   ├── async/                # Async transactions
│   │   ├── settings/             # RPC configuration
│   │   ├── address/[address]/    # Address details
│   │   ├── block/[number]/       # Block details
│   │   ├── tx/[hash]/            # Transaction details
│   │   └── api/rpc-proxy/        # HTTPS→HTTP proxy
│   ├── components/               # React components
│   ├── lib/                      # Core libraries (reth-client, websocket manager)
│   ├── hooks/                    # Custom React hooks
│   └── types/                    # TypeScript types
│
├── docs/                         # Documentation
│   ├── admin/                    # Admin API docs
│   ├── architecture/             # Technical architecture
│   ├── deployment/               # Deployment guides
│   └── *.md                      # System design, dev logs
│
├── k8s/                          # Kubernetes manifests
├── scripts/                      # Build/deploy scripts
├── tools/                        # Dev utilities
│   ├── debug/                    # Debug scripts
│   ├── test/                     # Test scripts
│   └── test-results/             # Test outputs
├── tests/                        # Playwright E2E tests
├── archive/                      # Old configs/scripts
│
├── FRONTEND_ONBOARDING.md        # Start here
├── README.md                     # Project overview
├── deploy-to-ding-fish.sh        # Production deploy
├── package.json                  # Dependencies
├── .env.local                    # Local dev (not committed)
└── .env.production               # Production (committed)
```

## Design Decisions

### Why Cache-First Instead of Fetch-on-Demand?

Traditional approach: User clicks page → fetch data → render. Problem with blockchain explorers: fetching 50-100 blocks takes 5-20 seconds with sequential RPC calls.

Our solution: Background accumulation. The WebSocket manager starts immediately on app load and accumulates blocks continuously. By the time users navigate to Charts or Stats, we already have 500 blocks cached.

Trade-offs:
- Memory overhead: ~50MB for 500 blocks (acceptable for modern browsers)
- Stale data risk: Mitigated by real-time WebSocket updates
- Initial load cost: ~10-20 seconds to build cache, but users rarely notice since it happens during homepage interaction

This pattern is unusual but necessary given blockchain RPC latency (50-200ms per call × 100 blocks = unusable UX).

### Why Singleton WebSocket Instead of Per-Page Connections?

You might expect each page to manage its own WebSocket connection. We use a singleton instead.

Reasons:
1. Browser connection limits (6 per domain in most browsers)
2. Redundant subscriptions waste server resources
3. Shared cache means data fetched once benefits all pages
4. Simpler state management (one source of truth)

Implementation: `window.__realtimeManager` survives Next.js client-side navigation. We don't use React Context because it re-initializes on route changes in App Router.

### Why Both Global Cache AND Per-Page Windows?

Global cache (500 blocks):
- Shared across all pages
- Rolling window (oldest blocks drop off)
- Fast but limited size

Per-page windows (1000 blocks each):
- Isolated per page (e.g., "analytics" vs "ritual-analytics")
- Keeps growing until user leaves page
- Allows deep historical analysis

Example: User stays on Charts page for 30 minutes. Global cache stays at 500 blocks (rolling). Charts page window accumulates 900 blocks (30min × ~0.5 blocks/sec). Next visit to Charts: instant load with 900 blocks instead of 50.

This dual-cache approach wasn't in the original design. We added it after realizing users who return to analytics pages expect to see accumulated data, not just the last 500 blocks.

### Why localStorage Persistence?

Page refresh destroys in-memory cache. Fetching 500 blocks takes 10-20 seconds. That's a terrible experience after accidental refresh.

Solution: Debounced saves to localStorage every 5 seconds. On reload, check cache age:
- < 30 seconds old: Use it
- Older: Discard and rebuild

Size concerns: 500 blocks ≈ 5MB JSON. Well within localStorage limits (5-10MB). We monitor and clear if quota exceeded.

### Why NEXT_PUBLIC_ Vars Need .env.production?

This one trips up everyone. Next.js bakes `NEXT_PUBLIC_*` vars into the JavaScript bundle at build time. You can't change them at runtime.

During Docker builds:
1. `COPY . .` copies source code
2. `ENV NEXT_PUBLIC_FOO=bar` sets runtime env var
3. `npm run build` runs → reads `.env.production` file, NOT runtime env vars

We tried setting ENV vars in Dockerfile (didn't work). The fix: commit `.env.production` with the actual values. Yes, it's in git. No, it doesn't matter - these are public client-side values anyway.

This is counterintuitive because it breaks the "env vars at runtime" pattern. But Next.js client-side code needs values at build time to bundle them into static JS.

### Why Custom RPC Client Instead of ethers.js or viem?

Ritual Chain has custom transaction types (0x10, 0x11, 0x12) not in standard libraries. We need to:
- Parse these custom types
- Decode Ritual-specific fields (callId, originTx, etc.)
- Handle system accounts (0x...fa7e, fa8e, fa9e)

Also needed custom proxy logic: HTTPS site → HTTP RPC requires server-side proxy. Libraries don't handle this transparently.

We DO use viem for wallet interactions (transactions, signing) because that part is standard. But blockchain reads go through our custom client.

### Why /api/rpc-proxy Route?

HTTPS pages can't fetch HTTP endpoints (mixed content blocked by browsers). Options:
1. Require HTTPS RPC endpoint (not always available)
2. Server-side proxy (chosen)

The proxy route forwards requests from browser → Next.js server → HTTP RPC → back to browser. Browser thinks it's same-origin HTTPS.

Bonus feature: Reads `x-rpc-url` header, allowing runtime RPC switching without rebuilding. User changes RPC in Settings → browser sends new URL via header → proxy uses it.

### Why Manual nonce Management in Faucet (Then Removed)?

Initially we fetched nonce manually:
```typescript
const nonce = await publicClient.getTransactionCount({ blockTag: 'pending' })
```

Reasoning: Avoid nonce conflicts if multiple users hit faucet simultaneously.

Removed because: Viem handles this internally AND we added one-time-per-address logic. Extra RPC call was unnecessary overhead.

Lesson: Trust the library unless you have data showing it's wrong.

### Why One-Time-Per-Address Faucet?

Blockchain faucets typically rate-limit by IP. We use localStorage instead.

Reasons:
1. Users behind corporate NAT share IPs (false positives)
2. Mobile users change IPs constantly (easy to bypass)
3. localStorage is per-browser (harder to bypass for casual abuse)

Trade-off: User can clear localStorage and request again. But that's fine - we're not running a mainnet faucet. The UX improvement (no IP-based false positives) is worth the slight abuse vector.

### Why Plotly Instead of Recharts or Victory?

Recharts: Great for simple charts, struggles with 500+ data points, limited customization.

Victory: Better performance, but verbose API.

Plotly: Handles thousands of points smoothly, extensive chart types, mature library. Downside: Large bundle size (~1MB). We mitigate with dynamic imports and Next.js code splitting.

For simple charts (dashboard stats), we considered lighter alternatives. But consistency won - better to use one library well than juggle three.

## Core Concepts

### WebSocket Manager (`realtime-websocket.ts`)

Singleton stored in `window.__realtimeManager`. One WebSocket connection shared across all pages.

Features:
- Global cache: 500 blocks (rolling window, shared across pages)
- Per-page windows: 1000 blocks per page (expanding window)
- localStorage persistence survives page refreshes
- Auto-reconnection with exponential backoff
- Polling fallback when WebSocket fails

API:
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

### RPC Client (`reth-client.ts`)

Singleton instance exported as `rethClient`. Key feature is automatic HTTPS→HTTP proxy for mixed content.

Usage:
```typescript
// On HTTPS (ding.fish), automatically uses /api/rpc-proxy
// On HTTP (localhost), direct RPC calls

const blockNumber = await rethClient.getLatestBlockNumber()
const block = await rethClient.getBlock(12345, true) // with transactions
const tx = await rethClient.getTransaction(hash)
```

User-configurable: Settings page lets users change RPC endpoint at runtime.

### Ritual Chain Transaction Types

Standard Ethereum plus custom types:

| Type | Hex | Description | System Account |
|------|-----|-------------|----------------|
| Legacy | 0x0 | Standard Ethereum | N/A |
| EIP-1559 | 0x2 | Modern gas model | N/A |
| Scheduled | 0x10 | Cron-like execution | 0x...fa7e |
| Async Commitment | 0x11 | TEE execution start | 0x...fa8e |
| Async Settlement | 0x12 | Final settlement | 0x...fa9e |

These show up throughout the UI - badges, transaction flows, special pages for each type.

### /api/rpc-proxy Route

Problem: HTTPS site can't fetch HTTP RPC (mixed content blocked by browsers).

Solution: Next.js API route proxies requests server-side.

```typescript
// Browser on ding.fish (HTTPS)
fetch('/api/rpc-proxy', { 
  method: 'POST',
  body: JSON.stringify({ method: 'eth_blockNumber', params: [] })
})

// Server forwards to HTTP RPC
// Returns response to browser
```

Also reads `x-rpc-url` header for dynamic RPC switching.

## Data Flow Examples

### Charts Page Load (Optimized)

```
User clicks "Charts" →
  ↓
Page checks global cache (getRealtimeManager().getCachedBlocks())
  ↓
Cache has 500 blocks → instant load (< 100ms)
  ↓
Subscribes to WebSocket for updates
  ↓
New blocks arrive → Charts update in real-time
```

### Address Page

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

### Wallet Connection + Faucet

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

## Key Files to Understand

### `src/lib/realtime-websocket.ts` (600+ lines)

WebSocket manager singleton. Powers all real-time updates and caching.

Key methods:
- `getRealtimeManager()` - Get singleton instance
- `subscribe(id, callback)` - Listen for updates
- `getCachedBlocks()` - Get global cache
- `getPageBlockWindow(pageId)` - Get per-page cache

### `src/lib/reth-client.ts` (500+ lines)

RPC client wrapper. All blockchain data goes through this.

Key methods:
- `rpcCall(method, params)` - Generic RPC call
- `getBlock(number, includeTxs)` - Fetch block
- `getTransaction(hash)` - Fetch transaction
- `testConnection(url)` - Test RPC endpoint

### `src/app/analytics/page.tsx` (1200+ lines)

Charts dashboard (recently optimized). Good example of cache-first pattern: 
  ```typescript
  // Priority 1: Global cache
  const globalBlocks = manager.getCachedBlocks()
  if (globalBlocks.length > 0) {
    // instant load
  }
  ```

### `src/components/ConnectWalletButton.tsx` (300 lines)

Wallet integration plus faucet. Shows Wagmi/Viem usage.

Key features:
- Auto-faucet on connect
- Network addition to MetaMask
- One-time-per-address logic

### `src/app/api/rpc-proxy/route.ts` (66 lines)

HTTPS→HTTP proxy. Solves mixed content issue.

Flow: Reads request → forwards to RPC → returns response.

## Development Workflow

### Local Development

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

Key dev URLs:
- Homepage: http://localhost:5555
- Charts: http://localhost:5555/analytics
- Stats: http://localhost:5555/ritual-analytics
- Settings: http://localhost:5555/settings

Testing changes:

```bash
# TypeScript check
npm run type-check

# Lint
npm run lint

# Build production (tests build-time issues)
npm run build
```

## Common Dev Tasks

### Adding a New Page

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

### Making RPC Calls

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

### Adding to Navigation

```typescript
// src/components/Navigation.tsx
const NAV_ITEMS = [
  // ... existing items
  { href: '/my-page', label: 'My Page', key: 'my-page' },
]
```

## Common Issues

### "Failed to fetch RPC"
Cause: RPC endpoint not reachable
Fix: Check Settings page, test RPC connection

### "WebSocket connection failed"
Cause: WebSocket endpoint not reachable or wrong protocol (ws/wss)
Fix: Check browser console, falls back to polling automatically

### "Cache is empty on page load"
Cause: First visit before cache builds
Fix: Wait 10-20 seconds, cache accumulates in background

### "WalletConnect 403 errors"
Cause: Domain not whitelisted in WalletConnect project
Fix: Add domain to https://cloud.walletconnect.com project settings

### "Page loads slowly"
Cause: Not using cache (making direct RPC calls)
Fix: Use `getCachedBlocks()` first, fall back to RPC if empty

## Performance Best Practices

Do:
- Use global cache first (`getCachedBlocks()`)
- Use per-page windows for extended datasets
- Subscribe to WebSocket for updates
- Batch RPC calls when possible
- Use React.memo for expensive components

Don't:
- Fetch 50-100 blocks on every page load (use cache)
- Make sequential RPC calls in loops (use `Promise.all`)
- Ignore cache and always fetch fresh
- Subscribe without cleanup (memory leaks)
- Fetch full blocks when you only need headers

## Deployment

### Production Deployment

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

### Environment Variables

Build-time (baked into bundle):
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_RETH_RPC_URL`
- `NEXT_PUBLIC_RETH_WS_URL`

Runtime (can change without rebuild):
- None currently (all NEXT_PUBLIC_ are build-time)

Important: `NEXT_PUBLIC_*` vars must be in `.env.production` for Docker builds.

## Learning Path for New Engineers

### Week 1: Understand the Stack
1. Read this document thoroughly
2. Run local dev, browse the site
3. Read `realtime-websocket.ts` - understand caching
4. Read `reth-client.ts` - understand RPC calls
5. Read `analytics/page.tsx` - see cache-first pattern

### Week 2: Make Small Changes
1. Add a new stat card to homepage
2. Add a new chart to analytics
3. Modify validator map styling
4. Add a new filter to transactions page

### Week 3: Feature Work
1. Pick a feature from backlog
2. Implement using cache-first pattern
3. Test locally
4. Deploy to staging (if available)
5. Code review and merge

## Getting Help

### Code Questions
- Check comments in key files (heavily documented)
- Search for similar patterns in codebase
- Check browser console (we log a lot)

### Blockchain/Ritual Questions
- Understand Ethereum basics first
- Ritual Chain is Ethereum-compatible plus custom tx types
- System accounts: fa7e (scheduled), fa8e (commitment), fa9e (settlement)

### Performance Questions
- Use browser DevTools Performance tab
- Check Network tab for RPC calls
- Look for `getCachedBlocks()` usage

## Metrics to Monitor

### Performance
- Page load time: Target < 500ms
- Charts page: Target < 100ms (from cache)
- Time to first block: Target < 2 seconds

### Cache
- Global cache size: 500 blocks max
- Per-page window: 1000 blocks max
- localStorage size: Monitor, can hit quota

### WebSocket
- Connection uptime: Monitor reconnections
- Message rate: ~0.5-2 blocks/sec
- Subscription count: Should match open pages

## Current State (v1.0.0)

What works:
- Real-time WebSocket updates
- Smart 500-block global cache
- Instant page loads (< 100ms)
- Wallet integration (MetaMask, WalletConnect, Coinbase)
- Auto-faucet (100 RITUAL tokens)
- HTTPS/WSS support via Cloudflare
- Custom transaction type handling
- Validator world map
- Charts and Stats dashboards

Known issues:
- Validator map uses placeholder data (no real geolocation)
- Faucet may timeout occasionally (30s timeout)
- Cache takes 10-20s to build on first load

Future improvements:
- Real validator geolocation (need admin_peers RPC + GeoIP)
- Contract verification UI
- Token tracking
- Advanced search
- Historical data pagination

## Summary

You should now understand:
- Architecture (cache-first, real-time)
- Tech stack (Next.js, WebSocket, Viem/Wagmi)
- Core concepts (caching, RPC proxy, custom tx types)
- File structure
- Development workflow
- Design decisions and trade-offs

Next: Clone the repo, run it locally, start browsing the code.

---

Last updated: 2025-10-06
Version: v1.0.0
