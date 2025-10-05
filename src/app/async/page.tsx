'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { rethClient, RitualTransactionType, SYSTEM_ACCOUNTS } from '@/lib/reth-client'
import { useTransactionUpdates, useRealtimeStatus, useMempoolUpdates } from '@/hooks/useRealtime'
import { TransactionTypeBadge, SystemAccountBadge } from '@/components/TransactionTypeBadge'
import { Navigation } from '@/components/Navigation'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface AsyncTransaction {
  hash: string
  type: string
  from: string
  to?: string
  value: string
  blockNumber: string
  timestamp?: string
  originTx?: string
  commitmentTx?: string
  settlementTx?: string
  precompileAddress?: string
  executorAddress?: string
}

export default function AsyncPage() {
  useParticleBackground()
  const [asyncTransactions, setAsyncTransactions] = useState<AsyncTransaction[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'commitment' | 'settlement'>('all')
  const [isMounted, setIsMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)
  
  // Use HTTP polling instead of WebSocket
  useEffect(() => {
    setIsMounted(true)
    loadAsyncTransactions()
    
    // Set up polling interval
    const interval = setInterval(() => {
      silentUpdate()
    }, 5000) // Poll every 5 seconds
    
    return () => clearInterval(interval)
  }, [])

  // Silent update for HTTP polling
  const silentUpdate = useCallback(async () => {
    const now = Date.now()
    if (now - lastUpdateTime < 2000) return // Max 1 update per 2 seconds
    
    setLastUpdateTime(now)
    setIsUpdating(true)
    
    try {
      startTransition(async () => {
        await loadAsyncTransactions()
      })
    } catch (error) {
      console.warn('Silent async update failed:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [lastUpdateTime])

  // Real-time mempool updates
  useMempoolUpdates((mempoolData) => {
    console.log('Real-time mempool update received for async check')
    silentUpdate() // Check for new async transactions
  })

  // Real-time transaction updates
  useTransactionUpdates((txData) => {
    console.log('🔄 New transaction received, checking if async:', txData.hash)
    silentUpdate() // Silent update instead of full reload
  })

  useEffect(() => {
    loadAsyncTransactions() // Initial load
    
    // Auto-refresh backup every 30 seconds
    const interval = setInterval(() => silentUpdate(), 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadAsyncTransactions = async () => {
    try {
      setError(null)
      
      // Get recent blocks and filter for async transactions
      const recentBlocks = await rethClient.getRecentBlocks(10)
      const asyncTxs: AsyncTransaction[] = []
      
      for (const block of recentBlocks) {
        if (block.transactions && Array.isArray(block.transactions)) {
          // Use direct transactions from block like transactions page
          for (const tx of block.transactions.slice(0, 10)) {
            if (typeof tx === 'object' && tx.hash) {
              // STRICT async filtering - only actual async commitment/settlement transactions
              if (tx && (
                  tx.type === RitualTransactionType.ASYNC_COMMITMENT ||
                  tx.type === RitualTransactionType.ASYNC_SETTLEMENT ||
                  // Only include if it has BOTH commitment/settlement fields AND is from/to ASYNC system accounts
                  (tx.commitmentTx && (
                    tx.from === SYSTEM_ACCOUNTS.ASYNC_COMMITMENT ||
                    tx.from === SYSTEM_ACCOUNTS.ASYNC_SETTLEMENT ||
                    (tx.to && (tx.to === SYSTEM_ACCOUNTS.ASYNC_COMMITMENT || tx.to === SYSTEM_ACCOUNTS.ASYNC_SETTLEMENT))
                  )) ||
                  (tx.settlementTx && (
                    tx.from === SYSTEM_ACCOUNTS.ASYNC_COMMITMENT ||
                    tx.from === SYSTEM_ACCOUNTS.ASYNC_SETTLEMENT ||
                    (tx.to && (tx.to === SYSTEM_ACCOUNTS.ASYNC_COMMITMENT || tx.to === SYSTEM_ACCOUNTS.ASYNC_SETTLEMENT))
                  ))
                )) {
                  asyncTxs.push(tx as AsyncTransaction)
                }
            }
          }
        }
      }
      
      setAsyncTransactions(asyncTxs.slice(0, 20))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load async transactions')
    } finally {
      setInitialLoading(false)
    }
  }

  const filteredTransactions = asyncTransactions.filter(tx => {
    if (filter === 'all') return true
    if (filter === 'commitment') return tx.type === RitualTransactionType.ASYNC_COMMITMENT
    if (filter === 'settlement') return tx.type === RitualTransactionType.ASYNC_SETTLEMENT
    return true
  })

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
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

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="async" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <span className="text-white">Async Transactions</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">Async Transactions</h1>
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span>HTTP POLLING</span>
                </div>
              </div>
              <p className="text-lime-200">
                Ritual Chain async execution transactions (Types 0x11 & 0x12)
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-2 bg-black/50 border border-lime-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-lime-400"
              >
                <option value="all">All Async</option>
                <option value="commitment">Commitments (0x11)</option>
                <option value="settlement">Settlements (0x12)</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-8">
            <h3 className="text-red-400 font-semibold">Error Loading Async Transactions</h3>
            <p className="text-red-300 mt-2">{error}</p>
          </div>
        )}

        {/* Async Transactions List */}
        <div className="bg-white/5 border border-lime-500/20 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-lime-500/20 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              Async Transactions ({filteredTransactions.length})
            </h3>
            <div className="text-sm text-lime-300">
              Last updated: {isMounted ? new Date().toLocaleTimeString() : '--:--:--'}
            </div>
          </div>

          {initialLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400 mb-4"></div>
              <p className="text-lime-200">Loading async transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-lime-300">No async transactions found</p>
              <p className="text-lime-400 text-sm mt-2">
                Async transactions (Types 0x11, 0x12) will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-lime-500/10">
              {filteredTransactions.map((tx, index) => (
                <div key={tx.hash || index} className="px-6 py-4 hover:bg-lime-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                          tx.type === RitualTransactionType.ASYNC_COMMITMENT 
                            ? 'bg-orange-500/20 border-orange-500/30' 
                            : 'bg-green-500/20 border-green-500/30'
                        }`}>
                          <span className={`text-xs ${
                            tx.type === RitualTransactionType.ASYNC_COMMITMENT 
                              ? 'text-orange-300' 
                              : 'text-green-300'
                          }`}>
                            {tx.type === RitualTransactionType.ASYNC_COMMITMENT ? 'AC' : 'AS'}
                          </span>
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
                          <TransactionTypeBadge type={tx.type} />
                          <SystemAccountBadge address={tx.from} />
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-lime-400">
                          <span>From: {shortenHash(tx.from)}</span>
                          {tx.to && <span>To: {shortenHash(tx.to)}</span>}
                          {tx.executorAddress && <span>Executor: {shortenHash(tx.executorAddress)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className="text-sm font-medium text-white">
                        {formatValue(tx.value)} RITUAL
                      </span>
                      {tx.blockNumber && (
                        <span className="text-xs text-lime-400">
                          Block #{parseInt(tx.blockNumber, 16).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredTransactions.length > 0 && (
            <div className="px-6 py-4 bg-black/50 border-t border-lime-500/20 text-center">
              <p className="text-sm text-lime-300">
                Showing {filteredTransactions.length} async transactions
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
