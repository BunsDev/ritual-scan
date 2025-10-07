'use client'

import { rethClient } from './reth-client'

export interface RealtimeUpdate {
  type: 'newBlock' | 'newTransaction' | 'newPendingTransaction' | 'gasPriceUpdate' | 'mempoolUpdate' | 'scheduledUpdate' | 'validatorPeersUpdate'
  data: any
  timestamp: number
}

export type UpdateCallback = (update: RealtimeUpdate) => void

// Debug mode - set to false for production
const DEBUG_MODE = false

// Cache size limits
const MAX_GLOBAL_CACHE_BLOCKS = 500  // Shared across all pages (rolling window)
const MAX_PAGE_WINDOW_BLOCKS = 1000  // Per-page expanding window limit

class RealtimeWebSocketManager {
  private ws: WebSocket | null = null
  // Smart caching for instant page loads (ROLLING WINDOW - max 500 blocks)
  private recentBlocksCache: any[] = []
  private recentTransactionsCache: any[] = []
  private latestMempoolStats: any = {}
  private latestScheduledTxs: any[] = []
  private latestAsyncCommitments: any[] = []
  private validatorPeers: any[] = []
  private validatorPeersLastUpdate: number = 0
  private validatorPeersPollInterval: number = 60000 // Start with 1 minute
  // Per-page expanding windows (CAPPED at 1000 blocks per page - persists while user stays on page)
  private pageBlockWindows: Map<string, any[]> = new Map()
  private reconnectAttemps = 0
  private maxReconnectAttempts = 10
  private reconnectInterval = 1000 // Start with 1 second
  private maxReconnectInterval = 30000 // Max 30 seconds
  private callbacks: Map<string, UpdateCallback> = new Map()
  private isConnected = false
  private connectionId: string | null = null
  private lastBlockNumber = 0
  private lastTransactionHashes = new Set<string>()
  private mempoolCheckInterval: NodeJS.Timeout | null = null
  private blockCheckInterval: NodeJS.Timeout | null = null
  private validatorPeersInterval: NodeJS.Timeout | null = null
  private lastLocalStorageSave: number = 0
  private pendingStorageSave: NodeJS.Timeout | null = null
  
  private log(...args: any[]) {
    if (DEBUG_MODE) console.log(...args)
  }
  
  private logImportant(...args: any[]) {
    // Always log important events (errors, connections)
    console.log(...args)
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      this.logImportant(`🚀 [${this.connectionId}] WebSocket manager starting...`)
      
      // Try to restore cache from localStorage (survives page refresh)
      this.restoreCacheFromStorage()
      
      // START IMMEDIATELY - cache builds in background regardless of page
      this.startConnection()
      this.startHighFrequencyPolling()
    }
  }
  
  private restoreCacheFromStorage() {
    try {
      // Check if we should skip restoration (RPC config change in progress)
      const skipRestore = sessionStorage.getItem('ritual-scan-skip-cache-restore')
      if (skipRestore === 'true') {
        console.log(`🚫 [${this.connectionId}] Skipping cache restore - RPC config changed`)
        sessionStorage.removeItem('ritual-scan-skip-cache-restore')
        return
      }
      
      // Restore global cache
      const stored = localStorage.getItem('ritual-scan-cache')
      if (stored) {
        const data = JSON.parse(stored)
        const age = Date.now() - data.timestamp
        
        // Use cache if less than 30 seconds old
        if (age < 30000 && data.blocks && Array.isArray(data.blocks)) {
          this.recentBlocksCache = data.blocks
          this.log(`💾 [${this.connectionId}] Restored ${data.blocks.length} blocks from localStorage (age: ${(age/1000).toFixed(1)}s)`)
        } else {
          this.log(`⏰ [${this.connectionId}] localStorage cache too old (${(age/1000).toFixed(1)}s), discarding`)
        }
      }
      
      // Restore validator peers (longer TTL since they change slowly)
      const validatorPeersStored = localStorage.getItem('ritual-scan-validator-peers')
      if (validatorPeersStored) {
        const data = JSON.parse(validatorPeersStored)
        const age = Date.now() - data.timestamp
        
        // Use validator peers if less than 10 minutes old
        if (age < 600000 && data.peers && Array.isArray(data.peers)) {
          this.validatorPeers = data.peers
          this.validatorPeersLastUpdate = data.timestamp
          this.logImportant(`💾 [${this.connectionId}] Restored ${data.peers.length} validator peers from localStorage (age: ${(age/1000).toFixed(1)}s)`)
        } else {
          this.log(`⏰ [${this.connectionId}] Validator peers cache too old (${(age/1000).toFixed(1)}s), discarding`)
        }
      }
      
      // Restore per-page windows
      const pageWindowsStored = localStorage.getItem('ritual-scan-page-windows')
      if (pageWindowsStored) {
        const data = JSON.parse(pageWindowsStored)
        const age = Date.now() - data.timestamp
        
        // Use page windows if less than 5 minutes old (more generous than global cache)
        if (age < 300000 && data.windows) {
          let totalBlocks = 0
          Object.entries(data.windows).forEach(([pageId, blocks]: [string, any]) => {
            if (Array.isArray(blocks) && blocks.length > 0) {
              this.pageBlockWindows.set(pageId, blocks)
              totalBlocks += blocks.length
              this.log(`💾 [${this.connectionId}] Restored ${blocks.length} blocks for page '${pageId}'`)
            }
          })
          this.logImportant(`💾 [${this.connectionId}] Restored ${this.pageBlockWindows.size} page windows with ${totalBlocks} total blocks (age: ${(age/1000).toFixed(1)}s)`)
        } else {
          this.log(`⏰ [${this.connectionId}] Page windows cache too old (${(age/1000).toFixed(1)}s), discarding`)
        }
      }
    } catch (error) {
      console.warn(`⚠️  [${this.connectionId}] Failed to restore cache from localStorage:`, error)
    }
  }
  
  private saveCacheToStorage() {
    // Debounce: Only save once every 5 seconds to avoid blocking main thread
    const now = Date.now()
    if (now - this.lastLocalStorageSave < 5000) {
      // Schedule save for later if not already scheduled
      if (!this.pendingStorageSave) {
        this.pendingStorageSave = setTimeout(() => {
          this.pendingStorageSave = null
          this.saveCacheToStorageNow()
        }, 5000 - (now - this.lastLocalStorageSave))
      }
      return
    }
    
    this.saveCacheToStorageNow()
  }
  
  private saveCacheToStorageNow() {
    try {
      // Save global cache
      if (this.recentBlocksCache.length > 0) {
        const data = {
          blocks: this.recentBlocksCache,
          timestamp: Date.now()
        }
        localStorage.setItem('ritual-scan-cache', JSON.stringify(data))
        this.lastLocalStorageSave = Date.now()
      }
      
      // Save validator peers (separate from blocks cache, never evicted)
      if (this.validatorPeers.length > 0) {
        const peersData = {
          peers: this.validatorPeers,
          timestamp: this.validatorPeersLastUpdate || Date.now()
        }
        localStorage.setItem('ritual-scan-validator-peers', JSON.stringify(peersData))
        this.log(`💾 [${this.connectionId}] Saved ${this.validatorPeers.length} validator peers to localStorage`)
      }
      
      // Save per-page windows
      if (this.pageBlockWindows.size > 0) {
        const windows: { [pageId: string]: any[] } = {}
        this.pageBlockWindows.forEach((blocks, pageId) => {
          windows[pageId] = blocks
        })
        
        const pageWindowsData = {
          windows,
          timestamp: Date.now()
        }
        localStorage.setItem('ritual-scan-page-windows', JSON.stringify(pageWindowsData))
        
        // Calculate total size for logging
        const totalSize = JSON.stringify(pageWindowsData).length
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2)
        this.log(`💾 [${this.connectionId}] Saved ${this.pageBlockWindows.size} page windows (${sizeMB}MB)`)
      }
    } catch (error) {
      // Silently fail - localStorage might be full or disabled
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn(`⚠️  [${this.connectionId}] localStorage quota exceeded - clearing old data`)
        // Clear old data to make room
        localStorage.removeItem('ritual-scan-page-windows')
      }
    }
  }

  private startConnection() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      // Get WebSocket URL from rethClient (respects user settings!)
      const dynamicWsUrl = rethClient.getConfiguration().websocket
      
      // Determine WebSocket URL based on environment
      const isBrowser = typeof window !== 'undefined'
      const isHttps = isBrowser && window.location.protocol === 'https:'
      const host = isBrowser ? window.location.host : ''
      
      let wsUrl: string
      if (isBrowser && isHttps) {
        // HTTPS deployment - Cloudflare or local Caddy
        if (host.includes('localhost')) {
          // Local: wss://localhost/rpc-ws (Caddy path-based proxy)
          wsUrl = `wss://${host}/rpc-ws`
          this.logImportant(`🔗 [${this.connectionId}] Local HTTPS - Caddy proxy: ${wsUrl}`)
        } else {
          // Production HTTPS with Cloudflare
          if (host.includes('ding.fish')) {
            // Check if user has custom WebSocket URL (overrides default tunnel)
            if (dynamicWsUrl && dynamicWsUrl !== 'ws://35.196.202.163:8546') {
              // User customized - use their URL (convert to wss://)
              wsUrl = dynamicWsUrl.replace('ws://', 'wss://')
              this.logImportant(`🔗 [${this.connectionId}] Custom WebSocket (user settings): ${wsUrl}`)
            } else {
              // Default - use Cloudflare Tunnel
              wsUrl = 'wss://ws.ding.fish/'
              this.logImportant(`🔗 [${this.connectionId}] Cloudflare Tunnel - WebSocket: ${wsUrl}`)
            }
          } else {
            // Other HTTPS sites - use dynamic config or fallback
            const baseUrl = dynamicWsUrl || process.env.NEXT_PUBLIC_RETH_WS_URL || 'ws://35.196.202.163:8546'
            wsUrl = baseUrl.replace('ws://', 'wss://')
            this.logImportant(`🔗 [${this.connectionId}] HTTPS - Secure WebSocket: ${wsUrl}`)
          }
        }
      } else {
        // HTTP deployment - use dynamic config or fallback
        wsUrl = dynamicWsUrl || process.env.NEXT_PUBLIC_RETH_WS_URL || 'ws://35.196.202.163:8546'
        this.log(`🔗 [${this.connectionId}] HTTP - WebSocket from config: ${wsUrl}`)
      }
      
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        this.isConnected = true
        this.reconnectAttemps = 0
        this.reconnectInterval = 1000
        
        // Subscribe to new block headers (transactions will be extracted from blocks)
        this.subscribeToBlocks()
        
        // Trigger initial cache population for pages already loaded
        setTimeout(() => {
          this.forceRefresh('blocks')
          this.forceRefresh('mempool')
          this.forceRefresh('scheduled')
        }, 1000) // Give subscriptions time to establish
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleWebSocketMessage(message)
        } catch (error) {
          // Only log JSON parse errors if they're not related to RETH optimized mode responses
          if (event.data && event.data.includes('not supported in optimized mode')) {
            this.log(`📡 [${this.connectionId}] RETH optimized mode response (expected)`)
          } else {
            console.error(`❌ [${this.connectionId}] WebSocket JSON parse error:`, error)
            console.error(`❌ [${this.connectionId}] Raw message that failed:`, event.data)
          }
        }
      }
 
      this.ws.onclose = (event) => {
        // Only log unexpected closures (not normal disconnects)
        if (event.code !== 1000 && event.code !== 1001) {
          console.log(`WebSocket disconnected (code: ${event.code})`)
        }
        this.isConnected = false
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        // WebSocket errors in browsers are often empty objects for security reasons
        // We have polling fallbacks, so this is not critical
        console.log(`⚠️ [${this.connectionId}] WebSocket connection failed - falling back to polling`)
        this.isConnected = false
      }

    } catch (error) {
      console.error(`❌ [${this.connectionId}] Failed to create WebSocket connection:`, error)
      this.scheduleReconnect()
    }
  }

  private subscribeToBlocks() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    try {
      // Subscribe to new block headers
      const blockSubscription = {
        jsonrpc: '2.0',
        method: 'eth_subscribe',
        params: ['newHeads'],
        id: 1
      }

      // Subscribe to pending transactions (Tier 1 feature)
      const pendingTxSubscription = {
        jsonrpc: '2.0',
        method: 'eth_subscribe',
        params: ['newPendingTransactions'],
        id: 2
      }

      this.log(`📡 [${this.connectionId}] Subscribing to new block headers and pending transactions`)
      this.ws.send(JSON.stringify(blockSubscription))
      this.ws.send(JSON.stringify(pendingTxSubscription))
    } catch (error) {
      console.error(`❌ [${this.connectionId}] Failed to subscribe to blocks/transactions:`, error)
    }
  }

  // Note: subscribeToTransactions removed - RETH optimized mode doesn't support 
  // newPendingTransactions subscription. Transactions are extracted from blocks instead.

  private handleWebSocketMessage(message: any) {
    // Handle subscription errors gracefully (expected in RETH optimized mode)
    if (message.method === 'eth_subscription' && message.params?.error) {
      const error = message.params.error
      if (error.message?.includes('not supported in optimized mode')) {
        // This is expected - RETH optimized mode doesn't support some subscriptions 
        this.log(`📡 [${this.connectionId}] RETH optimized mode - subscription not supported (expected)`)
        return
      }
      console.warn(`⚠️ [${this.connectionId}] Subscription error:`, error)
      return
    }

    // Handle JSON-RPC errors
    if (message.error) {
      if (message.error.message?.includes('not supported in optimized mode')) {
        this.log(`📡 [${this.connectionId}] RETH optimized mode - method not supported (expected)`)
        return
      }
      console.warn(`⚠️ [${this.connectionId}] RPC error:`, message.error)
      return
    }

    if (message.method === 'eth_subscription') {
      const subscription = message.params?.subscription
      const result = message.params?.result
      
      if (!subscription) {
        console.warn(`⚠️ [${this.connectionId}] Subscription message without subscription ID:`, message)
        return
      }

      // Check if this is a block header (multiple ways to identify it)
      const isBlockHeader = result && typeof result === 'object' && (
        result.number ||            // Standard field
        result.blockNumber ||       // Alternative field name
        result.hash ||              // All blocks have hash
        result.parentHash ||        // All blocks have parent hash
        result.miner ||             // Blocks have miner
        result.difficulty !== undefined  // Blocks have difficulty
      )

      if (isBlockHeader) {
        // This is a block header from newHeads subscription
        this.handleNewBlock(result)
      } else if (typeof result === 'string' && result.startsWith('0x')) {
        // This is a pending transaction hash
        this.handleNewPendingTransaction(result)
      } else {
        // Only log unknown messages for debugging
        this.log(`📩 [${this.connectionId}] Unknown subscription result:`, result ? Object.keys(result) : 'null')
      }
    } else if (message.id && message.result) {
      this.log(`📩 [${this.connectionId}] Subscription confirmed:`, message.result)
    } else if (message.id && message.error) {
      console.warn(`⚠️ [${this.connectionId}] RPC method error:`, message.error)
      // If subscriptions are not supported, fall back to polling only
      if (message.error.message?.includes('not supported')) {
        this.log(`📡 [${this.connectionId}] WebSocket subscriptions not supported, using polling only`)
      }
    } else {
      this.log(`📩 [${this.connectionId}] Unhandled message:`, message)
    }
  }

  private async handleNewBlock(blockHeader: any) {
    try {
      // Extract block number from various possible field names
      const blockNumberHex = blockHeader.number || blockHeader.blockNumber
      
      if (!blockNumberHex) {
        console.error(`❌ [${this.connectionId}] Block header has no number field:`, blockHeader)
        console.error(`❌ [${this.connectionId}] Available keys:`, Object.keys(blockHeader))
        return
      }
      
      const blockNumber = typeof blockNumberHex === 'string' 
        ? parseInt(blockNumberHex, 16) 
        : blockNumberHex
      
      if (isNaN(blockNumber)) {
        console.error(`❌ [${this.connectionId}] Invalid block number: ${blockNumberHex}`)
        return
      }
      
      if (blockNumber > this.lastBlockNumber) {
        this.log(`🔗 [${this.connectionId}] New block #${blockNumber}`)
        this.lastBlockNumber = blockNumber

        // Enhanced block update with gas price (Tier 1 feature)
        const enhancedBlockData = {
          ...blockHeader,
          // Normalize the number field
          number: blockNumberHex,
          gasPrice: blockHeader.baseFeePerGas ? parseInt(blockHeader.baseFeePerGas, 16) / 1e9 : null,
          timestamp: blockHeader.timestamp || Math.floor(Date.now() / 1000).toString(16)
        }

        // **CRITICAL FIX**: Add to cache for smart caching
        this.recentBlocksCache.unshift(enhancedBlockData)
        // Keep only last 500 blocks (rolling window)
        if (this.recentBlocksCache.length > MAX_GLOBAL_CACHE_BLOCKS) {
          this.recentBlocksCache = this.recentBlocksCache.slice(0, MAX_GLOBAL_CACHE_BLOCKS)
        }
        
        // Reduce logging spam - only log every 5th block
        if (this.recentBlocksCache.length % 5 === 0) {
          this.log(`📦 [${this.connectionId}] Cache: ${this.recentBlocksCache.length} blocks (latest: #${blockNumber})`)
        }
        
        // Save to localStorage for persistence across page reloads (debounced to every 5s)
        this.saveCacheToStorage()
        
        // **FIX**: Notify subscribers that cache is now available (first block)
        if (this.recentBlocksCache.length === 1) {
          console.log(`🎉 [${this.connectionId}] Cache is now available! Notifying pages...`)
        }

        const blockUpdate: RealtimeUpdate = {
          type: 'newBlock',
          data: enhancedBlockData,
          timestamp: Date.now()
        }

        // Emit gas price update (Tier 1 feature)
        if (blockHeader.baseFeePerGas) {
          const gasPriceUpdate: RealtimeUpdate = {
            type: 'gasPriceUpdate',
            data: {
              gasPrice: parseInt(blockHeader.baseFeePerGas, 16) / 1e9,
              blockNumber: blockNumber
            },
            timestamp: Date.now()
          }
          this.notifyCallbacks(gasPriceUpdate)
        }

        this.notifyCallbacks(blockUpdate)

        // Extract transactions from the full block since RETH optimized mode 
        // doesn't support newPendingTransactions subscription
        try {
          const blockHash = blockHeader.hash || blockHeader.blockHash
          if (blockHash) {
            const fullBlock = await rethClient.getBlock(blockHash, true)
            if (fullBlock && fullBlock.transactions && Array.isArray(fullBlock.transactions)) {
              this.log(`📦 [${this.connectionId}] Block #${blockNumber} has ${fullBlock.transactions.length} transactions`)
              
              // Emit transaction updates for each transaction in the block
              for (const txHash of fullBlock.transactions) {
                if (typeof txHash === 'string' && !this.lastTransactionHashes.has(txHash)) {
                  this.handleNewTransaction(txHash)
                }
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ [${this.connectionId}] Failed to fetch full block for transactions:`, error)
        }
      }
    } catch (error) {
      console.error(`❌ [${this.connectionId}] Error in handleNewBlock:`, error)
      console.error(`❌ [${this.connectionId}] Block header that caused error:`, blockHeader)
    }
  }

  private handleNewTransaction(txHash: string) {
    if (!this.lastTransactionHashes.has(txHash)) {
      this.log(`💸 [${this.connectionId}] New transaction: ${txHash.slice(0, 10)}...`)
      this.lastTransactionHashes.add(txHash)

      // Keep only last 1000 transaction hashes to prevent memory leaks
      if (this.lastTransactionHashes.size > 1000) {
        const firstHash = this.lastTransactionHashes.values().next().value
        if (firstHash) {
          this.lastTransactionHashes.delete(firstHash)
        }
      }

      const update: RealtimeUpdate = {
        type: 'newTransaction',
        data: { hash: txHash },
        timestamp: Date.now()
      }

      this.notifyCallbacks(update)
    }
  }

  // Tier 1: Handle pending transactions from WebSocket subscription
  private handleNewPendingTransaction(txHash: string) {
    if (!this.lastTransactionHashes.has(txHash)) {
      // Reduce logging - only log every 10th transaction
      if (this.lastTransactionHashes.size % 10 === 0) {
        this.log(`⚡ [${this.connectionId}] Pending txs: ${this.lastTransactionHashes.size}`)
      }
      this.lastTransactionHashes.add(txHash)

      // Keep only last 1000 transaction hashes to prevent memory leaks
      if (this.lastTransactionHashes.size > 1000) {
        const firstHash = this.lastTransactionHashes.values().next().value
        if (firstHash) {
          this.lastTransactionHashes.delete(firstHash)
        }
      }

      const update: RealtimeUpdate = {
        type: 'newPendingTransaction',
        data: { hash: txHash, status: 'pending' },
        timestamp: Date.now()
      }

      this.notifyCallbacks(update)
    }
  }

  // Fetch validator peer list from Summit node (via API route to avoid CORS)
  private async fetchValidatorPeers() {
    try {
      // Use our API route which fetches server-side
      const peerListUrl = '/api/validator-peers'
      
      this.log(`🔍 [${this.connectionId}] Fetching validator peers via API route`)
      
      const response = await fetch(peerListUrl, {
        signal: AbortSignal.timeout(10000)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      const peers = data.validators || []
      
      // Check if data changed
      const dataChanged = JSON.stringify(peers) !== JSON.stringify(this.validatorPeers)
      
      if (dataChanged) {
        this.log(`✅ [${this.connectionId}] Validator peers updated: ${peers.length} peers`)
        this.validatorPeers = peers
        this.validatorPeersLastUpdate = Date.now()
        
        // Data changed - poll more frequently (1 minute)
        this.validatorPeersPollInterval = 60000
        
        // Notify subscribers immediately with raw peer data
        const validatorUpdate: RealtimeUpdate = {
          type: 'validatorPeersUpdate' as any,
          data: this.validatorPeers,
          timestamp: Date.now()
        }
        this.notifyCallbacks(validatorUpdate)
        
        // Fetch GeoIP data asynchronously (don't block WebSocket manager)
        this.enrichPeersWithGeoIP().catch(err => {
          console.error(`[${this.connectionId}] GeoIP enrichment failed:`, err)
        })
      } else {
        // No change - poll less frequently (5 minutes)
        this.validatorPeersPollInterval = 300000
        this.log(`📍 [${this.connectionId}] No peer changes, extending poll to 5 minutes`)
      }
      
    } catch (error) {
      console.error(`❌ [${this.connectionId}] Failed to fetch validator peers:`, error)
    }
  }

  // Enrich peer list with GeoIP data (OPTIMIZED: uses batch API)
  private async enrichPeersWithGeoIP() {
    if (this.validatorPeers.length === 0) return
    
    try {
      // Prepare batch request (strip ports from IPs)
      const batchQuery = this.validatorPeers.map(peer => {
        const ipOnly = peer.ip_address?.split(':')[0] || peer.ip_address
        return {
          query: ipOnly,
          fields: 'status,country,city,lat,lon'
        }
      })
      
      // Single batch request for ALL IPs (much faster!)
      const geoResponse = await fetch('http://ip-api.com/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchQuery),
        signal: AbortSignal.timeout(5000)
      })
      
      if (geoResponse.ok) {
        const geoResults = await geoResponse.json()
        
        // Match results back to peers
        const enrichedPeers = this.validatorPeers.map((peer, index) => {
          const geoData = geoResults[index]
          if (geoData?.status === 'success') {
            return {
              ...peer,
              lat: geoData.lat,
              lon: geoData.lon,
              city: geoData.city,
              country: geoData.country,
              isReal: true
            }
          }
          return { ...peer, isReal: false }
        })
        
        this.validatorPeers = enrichedPeers
        this.logImportant(`🌍 [${this.connectionId}] Enriched ${enrichedPeers.filter(p => p.isReal).length}/${enrichedPeers.length} peers with GeoIP data (batch request)`)
        
        // Save to localStorage immediately
        this.saveCacheToStorage()
      }
    } catch (error) {
      console.error(`❌ [${this.connectionId}] Batch GeoIP enrichment failed:`, error)
      // Keep peers without location data
    }
  }

  private startHighFrequencyPolling() {
    // High-frequency mempool polling (every 2 seconds)
    this.mempoolCheckInterval = setInterval(async () => {
      try {
        const [mempoolStats, scheduledTxs] = await Promise.all([
          rethClient.getMempoolStats(),
          rethClient.getScheduledTransactions()
        ])

        // **CRITICAL FIX**: Add to cache for smart caching
        this.latestMempoolStats = mempoolStats
        this.latestScheduledTxs = scheduledTxs
        
        this.log(`📦 [${this.connectionId}] Cache updated: mempool + ${scheduledTxs?.length || 0} scheduled txs`)

        const mempoolUpdate: RealtimeUpdate = {
          type: 'mempoolUpdate',
          data: mempoolStats,
          timestamp: Date.now()
        }

        const scheduledUpdate: RealtimeUpdate = {
          type: 'scheduledUpdate',
          data: scheduledTxs,
          timestamp: Date.now()
        }

        this.notifyCallbacks(mempoolUpdate)
        this.notifyCallbacks(scheduledUpdate)

      } catch (error) {
        console.error(`❌ [${this.connectionId}] High-frequency polling error:`, error)
      }
    }, 2000) // Every 2 seconds
    
    // Validator peers polling (dynamic interval: 1-5 minutes)
    const pollValidatorPeers = async () => {
      await this.fetchValidatorPeers()
      
      // Schedule next poll with dynamic interval
      this.validatorPeersInterval = setTimeout(pollValidatorPeers, this.validatorPeersPollInterval)
    }
    
    // Start initial fetch
    pollValidatorPeers()

    // Block polling as backup (every 2 seconds)
    this.blockCheckInterval = setInterval(async () => {
      try {
        const latestBlock = await rethClient.getLatestBlock()
        if (latestBlock) {
          const blockNumber = parseInt(latestBlock.number, 16)
          if (blockNumber > this.lastBlockNumber) {
            this.handleNewBlock(latestBlock)
          }
        }
      } catch (error) {
        console.error(`❌ [${this.connectionId}] Block polling error:`, error)
      }
    }, 2000) // Every 2 seconds
  }

  private notifyCallbacks(update: RealtimeUpdate) {
    this.callbacks.forEach((callback, callbackId) => {
      try {
        callback(update)
      } catch (error) {
        console.error(`❌ [${this.connectionId}] Callback error for ${callbackId}:`, error)
      }
    })
  }

  private scheduleReconnect() {
    if (this.reconnectAttemps >= this.maxReconnectAttempts) {
      console.error(`❌ [${this.connectionId}] Max reconnection attempts reached. Stopping.`)
      return
    }

    this.reconnectAttemps++
    
    this.log(`🔄 [${this.connectionId}] Scheduling reconnect attempt ${this.reconnectAttemps}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`)

    setTimeout(() => {
      this.startConnection()
    }, this.reconnectInterval)

    // Exponential backoff with jitter
    this.reconnectInterval = Math.min(
      this.reconnectInterval * 2 + Math.random() * 1000,
      this.maxReconnectInterval
    )
  }

  // Public API
  subscribe(callbackId: string, callback: UpdateCallback): () => void {
    this.log(`📻 [${this.connectionId}] New subscriber: ${callbackId}`)
    this.callbacks.set(callbackId, callback)

    // Return unsubscribe function
    return () => {
      this.log(`📻 [${this.connectionId}] Unsubscribing: ${callbackId}`)
      this.callbacks.delete(callbackId)
    }
  }

  // **CRITICAL FIX**: Add cache access methods
  getCachedBlocks(): any[] {
    // Reduce logging spam - only log when cache is empty or has significant size
    if (this.recentBlocksCache.length === 0 || this.recentBlocksCache.length % 10 === 0) {
      console.log(`🔍 [${this.connectionId}] getCachedBlocks called - returning ${this.recentBlocksCache.length} blocks`)
    }
    return [...this.recentBlocksCache] // Return copy to prevent mutation
  }

  getCachedScheduledTxs(): any[] {
    return [...this.latestScheduledTxs]
  }

  getCachedMempoolStats(): any {
    return { ...this.latestMempoolStats }
  }
  
  getCachedValidatorPeers(): any[] {
    return [...this.validatorPeers]
  }
  
  getValidatorPeersLastUpdate(): number {
    return this.validatorPeersLastUpdate
  }

  // Per-page expanding window management
  getPageBlockWindow(pageId: string): any[] {
    return this.pageBlockWindows.get(pageId) || []
  }

  setPageBlockWindow(pageId: string, blocks: any[]) {
    this.pageBlockWindows.set(pageId, blocks)
    this.log(`📊 [${this.connectionId}] Page '${pageId}' window: ${blocks.length} blocks`)
  }

  addBlockToPageWindow(pageId: string, block: any) {
    const currentWindow = this.pageBlockWindows.get(pageId) || []
    const blockNumber = parseInt(block.number || block.blockNumber, 16)
    
    // Don't add if already exists
    if (currentWindow.some((b: any) => parseInt(b.number, 16) === blockNumber)) {
      return
    }
    
    // Add to front (newest first) - O(1) operation
    currentWindow.unshift(block)
    
    // Enforce 1000 block limit - keep most recent, trim oldest (deque-like behavior)
    if (currentWindow.length > MAX_PAGE_WINDOW_BLOCKS) {
      const removed = currentWindow.pop() // Remove oldest from back - O(1) operation
      const removedBlockNum = removed ? parseInt(removed.number || removed.blockNumber, 16) : '?'
      this.logImportant(`🗑️ [${this.connectionId}] Page '${pageId}' exceeded ${MAX_PAGE_WINDOW_BLOCKS} block limit - removed oldest block #${removedBlockNum} (keeping most recent ${currentWindow.length})`)
    }
    
    this.pageBlockWindows.set(pageId, currentWindow)
    this.log(`➕ [${this.connectionId}] Added block #${blockNumber} to '${pageId}' window (total: ${currentWindow.length})`)
  }

  clearPageBlockWindow(pageId: string) {
    this.pageBlockWindows.delete(pageId)
    this.log(`🗑️ [${this.connectionId}] Cleared '${pageId}' window`)
  }

  // Get stats for all page windows
  getPageWindowsStats(): Record<string, { blocks: number, maxBlocks: number }> {
    const stats: Record<string, { blocks: number, maxBlocks: number }> = {}
    this.pageBlockWindows.forEach((blocks, pageId) => {
      stats[pageId] = { 
        blocks: blocks.length,
        maxBlocks: MAX_PAGE_WINDOW_BLOCKS
      }
    })
    return stats
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      connectionId: this.connectionId,
      subscriberCount: this.callbacks.size,
      lastBlockNumber: this.lastBlockNumber,
      reconnectAttempts: this.reconnectAttemps,
      cacheStats: {
        blocks: this.recentBlocksCache.length,
        scheduledTxs: this.latestScheduledTxs.length,
        hasMempoolStats: Object.keys(this.latestMempoolStats).length > 0
      }
    }
  }

  // Debug method to verify cache state
  debugCacheState() {
    const state = {
      connection: {
        id: this.connectionId,
        isConnected: this.isConnected,
        lastBlockNumber: this.lastBlockNumber,
        wsState: this.ws?.readyState
      },
      cache: {
        globalBlocks: this.recentBlocksCache.length,
        globalMaxBlocks: MAX_GLOBAL_CACHE_BLOCKS,
        scheduledTxsCount: this.latestScheduledTxs.length,
        mempoolStatsKeys: Object.keys(this.latestMempoolStats),
        firstBlock: this.recentBlocksCache[0] ? {
          number: this.recentBlocksCache[0].number,
          hash: this.recentBlocksCache[0].hash,
          timestamp: this.recentBlocksCache[0].timestamp
        } : null
      },
      pageWindows: this.getPageWindowsStats(),
      limits: {
        globalCache: `${MAX_GLOBAL_CACHE_BLOCKS} blocks (rolling)`,
        perPageWindow: `${MAX_PAGE_WINDOW_BLOCKS} blocks (most recent)`
      },
      subscribers: this.callbacks.size
    }
    console.log('🔍 [DEBUG] Cache State:', JSON.stringify(state, null, 2))
    return state
  }

  disconnect() {
    console.log(`🔌 [${this.connectionId}] Manually disconnecting`)
    
    if (this.mempoolCheckInterval) {
      clearInterval(this.mempoolCheckInterval)
      this.mempoolCheckInterval = null
    }

    if (this.blockCheckInterval) {
      clearInterval(this.blockCheckInterval)
      this.blockCheckInterval = null
    }
    
    if (this.validatorPeersInterval) {
      clearTimeout(this.validatorPeersInterval)
      this.validatorPeersInterval = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.callbacks.clear()
    this.isConnected = false
  }

  // Force refresh specific data types
  async forceRefresh(type: 'mempool' | 'scheduled' | 'blocks') {
    this.log(`🔄 [${this.connectionId}] Force refreshing ${type}`)
    
    try {
      switch (type) {
        case 'mempool':
          const mempoolStats = await rethClient.getMempoolStats()
          this.notifyCallbacks({
            type: 'mempoolUpdate',
            data: mempoolStats,
            timestamp: Date.now()
          })
          break

        case 'scheduled':
          const scheduledTxs = await rethClient.getScheduledTransactions()
          this.notifyCallbacks({
            type: 'scheduledUpdate',
            data: scheduledTxs,
            timestamp: Date.now()
          })
          break

        case 'blocks':
          const latestBlock = await rethClient.getLatestBlock()
          if (latestBlock) {
            this.handleNewBlock(latestBlock)
          }
          break
      }
    } catch (error) {
      console.error(`❌ [${this.connectionId}] Force refresh error for ${type}:`, error)
    }
  }
}

// Global singleton instance - stored in window to persist across Next.js navigations
declare global {
  interface Window {
    __realtimeManager?: RealtimeWebSocketManager
  }
}

export function getRealtimeManager(): RealtimeWebSocketManager | null {
  // Handle SSR gracefully - return null during server-side rendering
  if (typeof window === 'undefined') {
    return null as any // SSR - no WebSocket manager
  }
  
  // Check window first (persists across Next.js navigations)
  if (!window.__realtimeManager) {
    window.__realtimeManager = new RealtimeWebSocketManager()
  }
  
  return window.__realtimeManager
}

export function useRealtime(callbackId: string, callback: UpdateCallback) {
  const manager = getRealtimeManager()
  return manager?.subscribe(callbackId, callback)
}

// Debug utilities - accessible from browser console
export function debugWebSocketCache() {
  if (typeof window !== 'undefined' && window.__realtimeManager) {
    return window.__realtimeManager.debugCacheState()
  } else {
    console.error('❌ No realtime manager instance found')
    return null
  }
}

// Make debug function available globally in browser
if (typeof window !== 'undefined') {
  (window as any).debugWebSocketCache = debugWebSocketCache;
  (window as any).getRealtimeManager = getRealtimeManager;
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.__realtimeManager) {
      window.__realtimeManager.disconnect()
    }
  })
}
