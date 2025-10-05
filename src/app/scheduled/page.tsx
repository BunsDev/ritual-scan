'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { rethClient } from '@/lib/reth-client'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import Link from 'next/link'
import { TransactionTypeBadge } from '@/components/TransactionTypeBadge'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface ScheduledTransaction {
  type: string
  hash: string
  originTx: string
  callId: number
  index: number
  maxBlock: number
  initialBlock: number
  frequency: number
  to?: string
  value: string
  gas: string
  from: string
}

export default function ScheduledPage() {
  useParticleBackground()
  const [scheduledTxs, setScheduledTxs] = useState<ScheduledTransaction[]>([])
  const [filteredTxs, setFilteredTxs] = useState<ScheduledTransaction[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)
  const [searchCallId, setSearchCallId] = useState('')
  const [lastUpdateDisplay, setLastUpdateDisplay] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Smart cache loader for scheduled transactions
  const loadFromCache = () => {
    try {
      const manager = getRealtimeManager()
      if (!manager) return false
      
      const cachedScheduled = manager.getCachedScheduledTxs()
      
      if (cachedScheduled && cachedScheduled.length > 0) {
        console.log(`🚀 [Scheduled] Using ${cachedScheduled.length} cached scheduled transactions for instant load`)
        setScheduledTxs(cachedScheduled)
        filterTransactions(cachedScheduled, searchCallId)
        setInitialLoading(false)
        return true
      }
      
      return false // No cached data available
    } catch (error) {
      console.warn('⚠️ [Scheduled] Failed to load cached data:', error)
      return false
    }
  }

  useEffect(() => {
    // Try cache first, fallback to API
    if (!loadFromCache()) {
      loadScheduledTransactions()
    }
    
    const realtimeManager = getRealtimeManager()
    const unsubscribe = realtimeManager?.subscribe('scheduled-page', (update) => {
      if (update.type === 'scheduledUpdate') {
        console.log('📅 [Scheduled] New scheduled transactions:', update.data)
        
        startTransition(() => {
          setScheduledTxs(update.data || [])
          filterTransactions(update.data || [], searchCallId)
          setLastUpdateTime(Date.now())
        })
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    filterTransactions(scheduledTxs, searchCallId)
  }, [scheduledTxs, searchCallId])

  useEffect(() => {
    // Update display time only on client side to avoid hydration mismatch
    const updateDisplayTime = () => {
      const now = new Date()
      setLastUpdateDisplay(`Last updated: ${now.toLocaleTimeString()}`)
    }
    
    updateDisplayTime()
    const interval = setInterval(updateDisplayTime, 30000) // Update every 30 seconds
    
    return () => clearInterval(interval)
  }, [lastUpdateTime])

  const loadScheduledTransactions = async () => {
    try {
      setError(null)
      const scheduled = await rethClient.getScheduledTransactions()
      setScheduledTxs(scheduled)
      filterTransactions(scheduled, searchCallId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled transactions')
    } finally {
      setInitialLoading(false)
    }
  }

  const filterTransactions = (transactions: ScheduledTransaction[], callIdFilter: string) => {
    if (!callIdFilter.trim()) {
      setFilteredTxs(transactions)
      return
    }

    const filtered = transactions.filter(tx => 
      tx.callId.toString().includes(callIdFilter.trim())
    )
    setFilteredTxs(filtered)
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


  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="scheduled" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <span className="text-white">Scheduled Transactions</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">Scheduled Transactions Pool</h1>
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span>HTTP POLLING</span>
                </div>
              </div>
              <p className="text-lime-200">
                Ritual Chain scheduled transactions waiting for execution
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {initialLoading ? '...' : filteredTxs.length}
              </div>
              <div className="text-lime-400 text-sm">Scheduled Jobs</div>
            </div>
          </div>
        </div>

        {/* Search Filter */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by Call ID..."
                value={searchCallId}
                onChange={(e) => setSearchCallId(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-lime-500/20 rounded-lg text-white placeholder-lime-300/50 focus:outline-none focus:border-lime-500/50"
              />
            </div>
            {searchCallId && (
              <button
                onClick={() => setSearchCallId('')}
                className="px-4 py-2 text-lime-300 hover:text-white border border-lime-500/20 rounded-lg hover:border-lime-500/50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-8">
            <h3 className="text-red-400 font-semibold">Error Loading Scheduled Transactions</h3>
            <p className="text-red-300 mt-2">{error}</p>
            <button 
              onClick={loadScheduledTransactions}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              Retry
            </button>
          </div>
        )}

        <div className="bg-black/50 border border-lime-500/20 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-lime-500/20 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              Scheduled Transactions ({initialLoading ? '...' : filteredTxs.length})
            </h3>
            {lastUpdateDisplay && (
              <div className="text-sm text-lime-300">
                {lastUpdateDisplay}
              </div>
            )}
          </div>

          {initialLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400 mb-4"></div>
              <p className="text-lime-200">Loading scheduled transactions...</p>
            </div>
          ) : filteredTxs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-lime-300">No scheduled transactions found in pool</p>
              <p className="text-lime-400 text-sm mt-2">
                Scheduled transactions appear here when waiting for execution
              </p>
            </div>
          ) : (
            <div className="divide-y divide-lime-500/10">
              {filteredTxs.map((tx, index) => (
                <div key={tx.hash || index} className="px-6 py-4 hover:bg-lime-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-lime-500/20 rounded-lg flex items-center justify-center border border-lime-500/30">
                          <span className="text-lime-300 text-xs">Sched</span>
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
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-lime-400">
                          <span>Call ID: {tx.callId}</span>
                          <span>Index: {tx.index}</span>
                          <span>Freq: {tx.frequency} blocks</span>
                          {tx.to && <span>To: {shortenHash(tx.to)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className="text-sm font-medium text-white">
                        {formatValue(tx.value)} RITUAL
                      </span>
                      <span className="text-xs text-lime-400">
                        Max Block: {tx.maxBlock.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredTxs.length > 0 && (
            <div className="px-6 py-4 bg-black/50 border-t border-lime-500/20 text-center">
              <p className="text-sm text-lime-300">
                Showing {filteredTxs.length} scheduled transactions 
                {searchCallId && ` matching Call ID "${searchCallId}"`}
                {scheduledTxs.length !== filteredTxs.length && ` (${scheduledTxs.length} total)`}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
