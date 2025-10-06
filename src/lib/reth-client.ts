'use client'

// RPC Configuration interface
export interface RpcConfig {
  primary: string
  backup?: string
  websocket?: string
  name?: string
}

// Ritual Chain transaction types
export enum RitualTransactionType {
  LEGACY = '0x0',
  EIP1559 = '0x2', 
  SCHEDULED = '0x10',
  ASYNC_COMMITMENT = '0x11',
  ASYNC_SETTLEMENT = '0x12'
}

// Ritual Chain system account addresses for validation
export const SYSTEM_ACCOUNTS = {
  SCHEDULED: '0x000000000000000000000000000000000000fa7e',
  ASYNC_COMMITMENT: '0x000000000000000000000000000000000000fa8e', 
  ASYNC_SETTLEMENT: '0x000000000000000000000000000000000000fa9e'
}

// Ritual Chain contract addresses (deployed at genesis/block 0-1)
export const RITUAL_CONTRACTS = {
  // Async precompile contract for async execution (deployed at genesis)
  ASYNC_PRECOMPILE: '0x0000000000000000000000000000000000000801',
  
  // Scheduler contract address (deployed at block 0 or 1)
  // This contract handles scheduled transaction creation and execution
  SCHEDULER_CONTRACT: '0x0000000000000000000000000000000000001000', // Already deployed
  
  // RitualWallet contract (deployed at block 0 or 1)
  // This contract manages user balances for scheduled/async executions  
  RITUAL_WALLET: '0x0000000000000000000000000000000000002000' // Already deployed
} as const

// Enhanced transaction interfaces for Ritual Chain
export interface SpcCall {
  address: string
  input: string
  output: string
  proof: string
  blockNumber: number
  programCounter: number
  callerAddress: string
}

export interface EnhancedTransaction {
  // Standard transaction fields
  type: string
  hash: string
  blockHash?: string
  blockNumber: string
  transactionIndex?: string
  from: string
  to?: string
  value: string
  gas: string
  gasPrice: string
  nonce: string
  input?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  chainId?: string
  r?: string
  s?: string
  v?: string
  yParity?: string
  
  // Ritual-specific fields (async-aware)
  commitmentTx?: string
  settlementTx?: string
  spcCalls?: SpcCall[]
  
  // Scheduled transaction fields
  originTx?: string
  callId?: number
  index?: number
  maxBlock?: number
  initialBlock?: number
  frequency?: number
  ttl?: number
  caller?: string
  
  // AsyncCommitment fields
  originTxRlp?: string
  precompileAddress?: string
  precompileInput?: string
  commitBlock?: number
  executorAddress?: string
  commitmentValidator?: string
  programCounter?: number
  callerAddress?: string
  
  // AsyncSettlement fields
  userAddress?: string
  totalAmount?: string
  executorFee?: string
  commitmentFee?: string
  inclusionValidator?: string
  inclusionFee?: string
  settlementBlock?: number
}

// Real RPC client for RETH nodes
export class RETHClient {
  private rpcUrl: string
  private wsUrl: string
  private backupRpcUrl: string
  private config: RpcConfig
  private changeListeners: ((config: RpcConfig) => void)[] = []

  constructor(initialConfig?: RpcConfig) {
    const defaultConfig: RpcConfig = {
      primary: process.env.NEXT_PUBLIC_RETH_RPC_URL || 'http://35.196.202.163:8545',
      websocket: process.env.NEXT_PUBLIC_RETH_WS_URL || 'ws://35.196.202.163:8546',
      name: 'Default RETH'
    }
    
    this.config = initialConfig || defaultConfig
    this.rpcUrl = this.config.primary
    this.backupRpcUrl = this.config.backup || this.config.primary
    this.wsUrl = this.config.websocket || 'ws://35.196.202.163:8546'
    
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reth-client-config')
      if (saved) {
        try {
          const savedConfig = JSON.parse(saved)
          this.updateConfiguration(savedConfig, false) // Don't save again
        } catch (e) {
          console.warn('Failed to parse saved RPC config')
        }
      }
    }
  }

  // Update RPC configuration
  updateConfiguration(newConfig: RpcConfig, persist = true): void {
    this.config = { ...newConfig }
    this.rpcUrl = this.config.primary
    this.backupRpcUrl = this.config.backup || this.config.primary
    this.wsUrl = this.config.websocket || 'ws://35.196.202.163:8546'
    
    if (persist && typeof window !== 'undefined') {
      localStorage.setItem('reth-client-config', JSON.stringify(this.config))
    }
    
    // Notify listeners
    this.changeListeners.forEach(listener => listener(this.config))
  }

  // Get current configuration
  getConfiguration(): RpcConfig {
    return { ...this.config }
  }

  // Subscribe to configuration changes
  onConfigurationChange(listener: (config: RpcConfig) => void): () => void {
    this.changeListeners.push(listener)
    return () => {
      const index = this.changeListeners.indexOf(listener)
      if (index > -1) {
        this.changeListeners.splice(index, 1)
      }
    }
  }

  // Test connection to an RPC endpoint
  async testConnection(rpcUrl: string): Promise<{ success: boolean; latency?: number; blockNumber?: number; error?: string }> {
    const startTime = Date.now()
    try {
      const payload = {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: Date.now()
      }

      // Use proxy if on HTTPS to avoid mixed content errors
      const isBrowser = typeof window !== 'undefined'
      const isHttps = isBrowser && window.location.protocol === 'https:'
      const targetUrl = (isBrowser && isHttps && rpcUrl.startsWith('http://')) ? '/api/rpc-proxy' : rpcUrl

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }

      const data = await response.json()
      if (data.error) {
        return { success: false, error: data.error.message }
      }

      const latency = Date.now() - startTime
      const blockNumber = parseInt(data.result, 16)
      
      return { success: true, latency, blockNumber }
    } catch (error: any) {
      return { success: false, error: error.message || 'Connection failed' }
    }
  }

  async rpcCall(method: string, params: any[] = []): Promise<any> {
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    }

    // Determine the URL to use based on environment
    const isBrowser = typeof window !== 'undefined'
    const isHttps = isBrowser && window.location.protocol === 'https:'
    
    // Use proxy for browser HTTPS to avoid mixed content errors
    const targetUrl = (isBrowser && isHttps) ? '/api/rpc-proxy' : this.rpcUrl

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        throw new Error(`Invalid JSON response from RPC: ${jsonError}`)
      }
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`)
      }
      return data.result
    } catch (error) {
      // Suppress common network timeout errors from background polling
      const errorMsg = (error as any)?.message || ''
      const isNetworkError = errorMsg.includes('Failed to fetch') || 
                            errorMsg.includes('aborted') ||
                            errorMsg.includes('timeout')
      
      // Only log errors that aren't transient network issues
      if (!isNetworkError) {
        console.error(`Failed to call ${method}:`, error)
      }
      
      // Try backup RPC if available and not already using proxy
      if (!this.backupRpcUrl || this.backupRpcUrl === this.rpcUrl || (isBrowser && isHttps)) {
        throw error
      }
      
      try {
        const response = await fetch(this.backupRpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        })

        let data
        try {
          data = await response.json()
        } catch (jsonError) {
          throw new Error(`Invalid JSON response from backup RPC: ${jsonError}`)
        }
        
        if (data.error) {
          throw new Error(`Backup RPC error: ${data.error.message}`)
        }
        return data.result
      } catch (backupError) {
        throw new Error(`Both RPC endpoints failed: ${error}`)
      }
    }
  }

  // Get latest block number
  async getLatestBlockNumber(): Promise<number> {
    const hex = await this.rpcCall('eth_blockNumber')
    return parseInt(hex, 16)
  }

  // Get block by number or hash
  async getBlock(blockIdentifier: number | string | 'latest', includeTransactions = false): Promise<any> {
    if (typeof blockIdentifier === 'string' && blockIdentifier.startsWith('0x')) {
      // It's a block hash
      return await this.rpcCall('eth_getBlockByHash', [blockIdentifier, includeTransactions])
    } else {
      // It's a block number or 'latest'
      const blockParam = blockIdentifier === 'latest' ? 'latest' : `0x${blockIdentifier.toString(16)}`
      return await this.rpcCall('eth_getBlockByNumber', [blockParam, includeTransactions])
    }
  }

  // Get transaction by hash
  async getTransaction(txHash: string): Promise<any> {
    return await this.rpcCall('eth_getTransactionByHash', [txHash])
  }

  // Get transaction receipt
  async getTransactionReceipt(txHash: string): Promise<any> {
    return await this.rpcCall('eth_getTransactionReceipt', [txHash])
  }

  // Get gas price
  async getGasPrice(): Promise<string> {
    const hex = await this.rpcCall('eth_gasPrice')
    return (parseInt(hex, 16) / 1e9).toFixed(2) // Convert to gwei
  }

  // Get multiple recent blocks
  async getRecentBlocks(count = 10): Promise<any[]> {
    const latestBlockNumber = await this.getLatestBlockNumber()
    const blocks = []
    
    for (let i = 0; i < count; i++) {
      const blockNumber = latestBlockNumber - i
      if (blockNumber >= 0) {
        const block = await this.getBlock(blockNumber, true)
        if (block) {
          blocks.push(block)
        }
      }
    }
    
    return blocks
  }

  // Get pending transactions from mempool
  async getMempoolTransactions(): Promise<any[]> {
    try {
      // Get pending transactions using txpool_content
      const txpool = await this.rpcCall('txpool_content')
      
      if (!txpool || !txpool.pending) {
        return []
      }

      const pendingTxs: any[] = []
      
      // Extract transactions from the txpool structure
      for (const address in txpool.pending) {
        const txsForAddress = txpool.pending[address]
        for (const nonce in txsForAddress) {
          const tx = txsForAddress[nonce]
          pendingTxs.push({
            ...tx,
            from: address,
            nonce: nonce,
            status: 'pending'
          })
        }
      }

      return pendingTxs.slice(0, 100) // Limit to 100 transactions
    } catch (error) {
      console.error('Failed to get mempool transactions:', error)
      
      // Fallback: try to get pending transactions using eth_pendingTransactions
      try {
        const pending = await this.rpcCall('eth_pendingTransactions')
        return Array.isArray(pending) ? pending.slice(0, 100) : []
      } catch (fallbackError) {
        console.error('Fallback mempool method also failed:', fallbackError)
        return []
      }
    }
  }

  // Get mempool stats
  async getMempoolStats(): Promise<{
    pending: number
    queued: number
    totalSize: number
    baseFee: string
  }> {
    try {
      const [txpool, gasPrice] = await Promise.all([
        this.rpcCall('txpool_status'),
        this.getGasPrice()
      ])

      return {
        pending: txpool?.pending ? parseInt(txpool.pending, 16) : 0,
        queued: txpool?.queued ? parseInt(txpool.queued, 16) : 0,
        totalSize: (txpool?.pending ? parseInt(txpool.pending, 16) : 0) + 
                   (txpool?.queued ? parseInt(txpool.queued, 16) : 0),
        baseFee: gasPrice
      }
    } catch (error) {
      console.error('Failed to get mempool stats:', error)
      return {
        pending: 0,
        queued: 0,
        totalSize: 0,
        baseFee: '0'
      }
    }
  }

  // Ritual Chain specific: Get scheduled transaction pool
  async getScheduledTransactions(): Promise<any[]> {
    try {
      const result = await this.rpcCall('txpool_scheduledContent')
      return result?.scheduled || []
    } catch (error) {
      console.error('Failed to get scheduled transactions:', error)
      return []
    }
  }

  // Ritual Chain specific: Get async commitment pool
  async getAsyncCommitments(): Promise<any[]> {
    try {
      const result = await this.rpcCall('txpool_AsyncCommitmentContent')
      return result?.asyncCommitment || []
    } catch (error) {
      console.error('Failed to get async commitments:', error)
      return []
    }
  }

  // Get enhanced transaction (with Ritual fields)
  async getEnhancedTransaction(hash: string): Promise<EnhancedTransaction | null> {
    try {
      const tx = await this.rpcCall('eth_getTransactionByHash', [hash])
      return tx as EnhancedTransaction
    } catch (error) {
      console.error('Failed to get enhanced transaction:', error)
      return null
    }
  }

  // Utility: Check if address is a Ritual system account
  isSystemAccount(address: string): boolean {
    return Object.values(SYSTEM_ACCOUNTS).some(account => address.toLowerCase() === account)
  }

  // Utility: Get transaction type label
  getTransactionTypeLabel(type: string): string {
    switch (type) {
      case RitualTransactionType.LEGACY:
        return 'Legacy'
      case RitualTransactionType.EIP1559:
        return 'EIP-1559'
      case RitualTransactionType.SCHEDULED:
        return 'Scheduled'
      case RitualTransactionType.ASYNC_COMMITMENT:
        return 'Async Commitment'
      case RitualTransactionType.ASYNC_SETTLEMENT:
        return 'Async Settlement'
      default:
        return 'Unknown'
    }
  }

  // Utility: Get system account label
  getSystemAccountLabel(address: string): string {
    switch (address.toLowerCase()) {
      case SYSTEM_ACCOUNTS.SCHEDULED.toLowerCase():
        return 'Scheduled System'
      case SYSTEM_ACCOUNTS.ASYNC_COMMITMENT.toLowerCase():
        return 'Async Commitment System'
      case SYSTEM_ACCOUNTS.ASYNC_SETTLEMENT.toLowerCase():
        return 'Async Settlement System'
      default:
        return 'Unknown System'
    }
  }

  // Get latest block
  async getLatestBlock(): Promise<any> {
    try {
      return await this.rpcCall('eth_getBlockByNumber', ['latest', false])
    } catch (error) {
      console.error('Failed to get latest block:', error)
      return null
    }
  }

  // @deprecated - Use getRealtimeManager() from realtime-websocket.ts instead
  // WebSocket connection for real-time updates (DEPRECATED)
  createWebSocketConnection(onBlock?: (block: any) => void, onError?: (error: any) => void): WebSocket | null {
    console.warn('⚠️ createWebSocketConnection is DEPRECATED. Use getRealtimeManager() from realtime-websocket.ts instead')
    return null // Disabled to prevent conflicts with the new realtime manager
  }
}

// Global client instance
export const rethClient = new RETHClient()
