# Smart Cache Architecture - Dual-Layer System

## 🏗️ Architecture Overview

The Ritual Scan explorer uses a **dual-layer caching system** that balances memory efficiency with rich data accumulation.

```
┌─────────────────────────────────────────────────────────────┐
│  Global Singleton: RealtimeWebSocketManager                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Global Shared Cache (ROLLING WINDOW)             │
│  ├─ recentBlocksCache: Array(500) ← Last 500 blocks        │
│  ├─ latestMempoolStats: Object                            │
│  └─ latestScheduledTxs: Array                             │
│                                                             │
│  Layer 2: Per-Page Expanding Windows (MAX 1000 blocks)     │
│  ├─ pageBlockWindows.get('validators'): Array(0-1000)      │
│  ├─ pageBlockWindows.get('blocks'): Array(0-1000)          │
│  └─ pageBlockWindows.get('analytics'): Array(0-1000)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 How It Works

### Layer 1: Global Shared Cache (500 blocks)

**Purpose:** Fast initial page loads across ALL pages

**Characteristics:**
- **Size**: Rolling window of 500 most recent blocks
- **Scope**: Shared across all pages
- **Lifecycle**: Persists until browser tab closed
- **Memory**: ~1MB (500 blocks × ~2KB each)
- **Update**: Every new block, oldest dropped when > 500
- **Performance**: O(1) unshift/slice operations

```typescript
// Global cache updates
this.recentBlocksCache.unshift(newBlock)  // Add newest - O(1)
if (this.recentBlocksCache.length > 500) {
  this.recentBlocksCache = this.recentBlocksCache.slice(0, 500)  // Trim oldest
}
```

**Use Case:**
```
User on /settings → Global cache accumulating blocks
User navigates to /validators → Instant load with 500 blocks!
```

### Layer 2: Per-Page Expanding Windows (Max 1000 blocks)

**Purpose:** Deep analysis on specific pages without memory bloat on unused pages

**Characteristics:**
- **Size**: Expanding window up to 1000 blocks per page
- **Scope**: Per-page (validators, analytics, etc.)
- **Lifecycle**: Persists across navigation (until tab closed)
- **Memory**: ~2MB max per page (1000 blocks × ~2KB each)
- **Update**: Deque-like behavior - O(1) add to front, O(1) remove from back
- **Trimming**: Keeps most recent 1000 blocks, auto-trims oldest

```typescript
// Per-page window updates (deque-like)
currentWindow.unshift(newBlock)  // Add newest to front - O(1)
if (currentWindow.length > 1000) {
  currentWindow.pop()  // Remove oldest from back - O(1)
}
```

**Use Case:**
```
User on /validators for 10 minutes
→ Accumulates 200 blocks (200 blocks × 2-3s each)
→ Rich validator statistics from 200-block dataset

User navigates to /settings for 30 seconds
→ Validators window still has 200 blocks

User returns to /validators
→ Instantly loads all 200 blocks! 
→ Continues expanding up to 1000 blocks max
→ Oldest blocks auto-trimmed when exceeding limit
```

## 📊 Data Flow

### Initial Page Load

```
1. User navigates to /validators
2. Check pageBlockWindows.get('validators')
   ├─ Found? → Load ALL blocks (up to 1000) ✅
   └─ Not found? → Check global cache
      ├─ Found? → Load up to 500 blocks ✅
      └─ Not found? → Wait/retry (WebSocket populating)
```

### Real-Time Updates

```
New block #89911 arrives via WebSocket
├─ Update global cache (rolling window, max 500)
└─ Update ALL active page windows (max 1000 each)
   ├─ pageBlockWindows.get('validators')? → Add block (trim if > 1000)
   ├─ pageBlockWindows.get('analytics')? → Add block (trim if > 1000)
   └─ ... (only updates pages that have been visited)
```

### Cross-Navigation Persistence

```
Timeline:
0:00 - Load /validators → Initialize with 500 blocks from global cache
0:30 - Stay on page → Expand to 600 blocks
1:00 - Still on page → Expand to 700 blocks
1:30 - Navigate to /blocks → Validators window PERSISTS (700 blocks)
2:00 - Navigate back to /validators → Instant load with 700 blocks!
5:00 - Continue expanding → 900, 1000 blocks (then auto-trims oldest)
```

## 💾 Memory Management

### Global Cache
```
Memory Usage: ~1MB constant
Growth: No growth (capped at 500)
Cleanup: Auto-managed with O(1) slice
Performance: O(1) unshift, O(N) slice
```

### Per-Page Windows
```
Memory Usage: ~2KB per block
Max Size: 2MB per page (1000 blocks × 2KB)
Growth: Linear with time on page (up to 1000 blocks)
Cleanup: O(1) pop from back when exceeding 1000
Performance: O(1) unshift/pop (deque-like)
Lifecycle: Persists until tab closed
```

### Example Memory Footprint

**Scenario: User analyzes validators for 30 minutes**

```
Global Cache: 500 blocks × 2KB = 1MB
Validators Window: 1000 blocks × 2KB = 2MB (auto-capped)
Total: ~3MB

Acceptable? YES
- Modern browsers handle single-digit MB easily
- User gets rich dataset (1000 blocks)
- Simple block count, no expensive size estimation
- O(1) operations for adding/trimming
```

**Scenario: User visits 5 pages briefly**

```
Global Cache: 500 blocks × 2KB = 1MB
Page Windows: 5 pages × 100 blocks × 2KB = 1MB
Total: ~2MB

Acceptable? YES
- Under 5MB total memory footprint
- Fast navigation between pages
- Each page has meaningful data (100 blocks)
```

## 🎯 API Methods

### For Pages to Use

```typescript
const manager = getRealtimeManager()

// Get global cache (max 500 blocks)
const globalBlocks = manager.getCachedBlocks()  // Rolling window

// Get page-specific window (max 1000 blocks)
const validatorBlocks = manager.getPageBlockWindow('validators')

// Set page window (initial load)
manager.setPageBlockWindow('validators', blocks)

// Add single block (real-time update) - O(1) operation
// Auto-trims oldest if exceeds 1000 blocks
manager.addBlockToPageWindow('validators', newBlock)

// Clear page window (user explicitly resets)
manager.clearPageBlockWindow('validators')
```

## 🚀 Benefits

### For Users
1. **Instant Navigation**: 500-block global cache loads any page instantly
2. **Deep Analysis**: Up to 1000 blocks per page for rich insights
3. **Persistence**: Navigate away and back, data persists
4. **No Waiting**: Never wait for API when cache available
5. **Memory Efficient**: Predictable 1-3MB memory usage

### For Developers
1. **Simple & Fast**: Block count instead of memory size estimation
2. **O(1) Operations**: Deque-like unshift/pop performance
3. **Self-Cleaning**: Auto-trims at 500/1000 block limits
4. **Predictable**: Fixed caps, no unexpected memory bloat
5. **Easy API**: Just count blocks, no complex logic

## 📝 Implementation Checklist

### For Any New Page

```typescript
// 1. On mount - Try page window first, fallback to global cache
const pageWindow = manager.getPageBlockWindow('mypage')
if (pageWindow.length > 0) {
  usePageWindow(pageWindow)  // Up to 1000 blocks!
} else {
  const globalCache = manager.getCachedBlocks()
  if (globalCache.length > 0) {
    initializePage(globalCache)  // Up to 500 blocks
    manager.setPageBlockWindow('mypage', globalCache)
  }
}

// 2. On new block - Add to both local state AND page window
const handleNewBlock = (block) => {
  localBlocks.current.push(block)  // Local expanding array
  manager.addBlockToPageWindow('mypage', block)  // O(1) add, auto-trims at 1000
}

// 3. On unmount - DO NOTHING (let page window persist)
// No cleanup needed - page window survives navigation
```

## 🔍 Summary

**Global Cache (500 blocks):**
- ✅ Fast initial loads (~1MB)
- ✅ Memory efficient with fixed cap
- ✅ Always running in background
- ✅ Shared across all pages
- ✅ O(1) add operations

**Page Windows (1000 blocks max):**
- ✅ Deep analysis (~2MB max per page)
- ✅ Persists across navigation
- ✅ Only grows for visited pages
- ✅ O(1) deque-like add/trim
- ✅ Simple block count (no size estimation)

**Result:** Best of both worlds! 🎉

