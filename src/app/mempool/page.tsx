'use client'

import { useState, useEffect, useCallback } from 'react'
import { rethClient } from '@/lib/reth-client'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import { TransactionTypeChip, TransactionTypeLegend } from '@/components/TransactionTypeChip'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface MempoolTransaction {
  hash: string
  from: string
  to?: string
  value: string
  gas: string
  gasPrice: string
  nonce: string
  type?: string
  status: string
}

interface MempoolStats {
  pending: number
  queued: number
  totalSize: number
  baseFee: string
}

export default function MempoolPage() {
  useParticleBackground()
  const [transactions, setTransactions] = useState<MempoolTransaction[]>([])
  const [stats, setStats] = useState<MempoolStats>({
    pending: 0,
    queued: 0,
    totalSize: 0,
    baseFee: '0'
  })
  const [initialLoading, setInitialLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)
  const [isMounted, setIsMounted] = useState(false)

  // Use WebSocket for real-time mempool updates
  useEffect(() => {
    setIsMounted(true)
    loadMempoolData() // Initial load
    
    // Subscribe to WebSocket mempool updates
    const manager = getRealtimeManager()
    if (!manager) {
      // Fallback to HTTP polling if WebSocket not available
      const interval = setInterval(() => silentUpdate(), 2000)
      return () => clearInterval(interval)
    }
    
    const unsubscribe = manager.subscribe('mempool-page', (update) => {
      if (update.type === 'mempoolUpdate') {
        // Update stats from WebSocket
        setStats(prevStats => ({
          ...prevStats,
          ...update.data
        }))
      }
      
      if (update.type === 'newPendingTransaction') {
        // New pending transaction received
        const txHash = update.data.hash
        if (txHash) {
          // Trigger a light refresh to get transaction details
          silentUpdate()
        }
      }
    })
    
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Throttled update for WebSocket-triggered refreshes
  const silentUpdate = useCallback(async () => {
    const now = Date.now()
    if (now - lastUpdateTime < 5000) return // Throttle to max once per 5 seconds
    
    setLastUpdateTime(now)
    setIsUpdating(true)
    
    try {
      const [mempoolTxs, mempoolStats] = await Promise.all([
        rethClient.getMempoolTransactions(),
        rethClient.getMempoolStats()
      ])
      
      setTransactions(mempoolTxs)
      setStats(mempoolStats)
    } catch (error) {
      // Silently fail - WebSocket will keep updating stats
    } finally {
      setIsUpdating(false)
    }
  }, [lastUpdateTime])

  const loadMempoolData = async () => {
    try {
      setError(null)
      
      const [mempoolTxs, mempoolStats] = await Promise.all([
        rethClient.getMempoolTransactions(),
        rethClient.getMempoolStats()
      ])
      
      setTransactions(mempoolTxs)
      setStats(mempoolStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mempool data')
    } finally {
      setInitialLoading(false)
    }
  }

  const formatGasPrice = (gasPrice: string) => {
    try {
      const gwei = parseInt(gasPrice, 16) / 1e9
      return `${gwei.toFixed(2)} Gwei`
    } catch {
      return '0 Gwei'
    }
  }

  const formatValue = (value: string) => {
    try {
      if (!value || value === '0x0') return '0'
      const wei = parseInt(value, 16)
      const ritual = wei / 1e18
      return ritual.toFixed(6)
    } catch {
      return '0'
    }
  }

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  const getTimeSinceLastUpdate = () => {
    if (!isMounted) return 'Last updated: --:--:--'
    const now = new Date()
    return `Last updated: ${now.toLocaleTimeString()}`
  }

  // Smart cache loader for mempool data
  const loadFromCache = () => {
    try {
      const manager = getRealtimeManager()
      const cachedMempool = (manager as any)?.latestMempoolStats || {}
      const cachedTransactions = (manager as any)?.recentTransactionsCache || []
      
      if (Object.keys(cachedMempool).length > 0) {
        console.log(`🚀 [Mempool] Using cached mempool stats for instant load`)
        setStats(cachedMempool)
        
        // Filter for pending transactions
        const pendingTransactions = cachedTransactions
          .filter((tx: any) => tx.status === 'pending')
          .slice(0, 50)
        
        setTransactions(pendingTransactions)
        setInitialLoading(false)
        return true
      }
      
      return false // No cached data available
    } catch (error) {
      console.warn('⚠️ [Mempool] Failed to load cached data:', error)
      return false
    }
  }

  useEffect(() => {
    // Try cache first, fallback to API
    if (!loadFromCache()) {
      loadMempoolData()
    }
  }, [])

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="mempool" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <span className="text-white">Mempool</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">Transaction Mempool</h1>
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span>HTTP POLLING</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-white/5 border border-lime-500/20 rounded-lg">
                <TransactionTypeLegend />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-8">
            <h3 className="text-red-400 font-semibold">Error Loading Mempool</h3>
            <p className="text-red-300 mt-2">{error}</p>
          </div>
        )}

        {/* Mempool Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6">
            <div className="text-lime-400 text-sm font-medium mb-2">Pending Transactions</div>
            <div className="text-2xl font-bold text-white">{stats.pending.toLocaleString()}</div>
            <div className="text-lime-300 text-sm mt-1">Ready for validation</div>
          </div>
          
          <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6">
            <div className="text-lime-400 text-sm font-medium mb-2">Queued Transactions</div>
            <div className="text-2xl font-bold text-white">{stats.queued.toLocaleString()}</div>
            <div className="text-lime-300 text-sm mt-1">Waiting for nonce</div>
          </div>

          <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6">
            <div className="text-lime-400 text-sm font-medium mb-2">Total Pool Size</div>
            <div className="text-2xl font-bold text-white">{stats.totalSize.toLocaleString()}</div>
            <div className="text-lime-300 text-sm mt-1">All transactions</div>
          </div>

          <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6">
            <div className="text-lime-400 text-sm font-medium mb-2">Base Fee</div>
            <div className="text-2xl font-bold text-white">{formatGasPrice(stats.baseFee)}</div>
            <div className="text-lime-300 text-sm mt-1">Current network fee</div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white/5 border border-lime-500/20 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-lime-500/20 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">Pending Transactions</h3>
            <div className="text-sm text-lime-300">
              {getTimeSinceLastUpdate()}
            </div>
          </div>

          {initialLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400 mb-4"></div>
              <p className="text-lime-200">Loading mempool transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-lime-300">No pending transactions found in mempool</p>
              <p className="text-lime-400 text-sm mt-2">
                This could mean the mempool is empty or RPC access is limited
              </p>
            </div>
          ) : (
            <div className="divide-y divide-lime-500/10">
              {transactions.map((tx, index) => (
                <div key={tx.hash || index} className="px-6 py-4 hover:bg-lime-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
                          <span className="text-orange-300 text-xs">Pending</span>
                        </div>
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <Link 
                            href={`/tx/${tx.hash}`}
                            className="text-lime-300 hover:text-white font-mono text-sm truncate transition-colors"
                          >
                            {shortenHash(tx.hash)}
                          </Link>
                          <TransactionTypeChip type={tx.type || '0x0'} />
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            Pending
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-lime-400">
                          <span>From: {shortenHash(tx.from)}</span>
                          {tx.to && (
                            <>
                              <span>→</span>
                              <span>To: {shortenHash(tx.to)}</span>
                            </>
                          )}
                          <span>Nonce: {parseInt(tx.nonce, 16)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className="text-sm font-medium text-white">
                        {formatValue(tx.value)} RITUAL
                      </span>
                      <span className="text-xs text-lime-400">
                        Gas: {formatGasPrice(tx.gasPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {transactions.length > 0 && (
            <div className="px-6 py-4 bg-black/50 border-t border-lime-500/20 text-center">
              <p className="text-sm text-lime-300">
                Showing {transactions.length} pending transactions
                {transactions.length >= 100 && ' (limited to first 100)'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
