'use client'

import { useState, useEffect, useCallback } from 'react'
import { rethClient } from '@/lib/reth-client'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import { TransactionTypeChip, TransactionTypeLegend } from '@/components/TransactionTypeChip'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  gas: string
  gasPrice: string
  blockNumber: string
  transactionIndex: string
  input: string
  type?: string
}

export default function TransactionsPage() {
  useParticleBackground()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [latestBlock, setLatestBlock] = useState<number>(0)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)

  // Smart cache loader for transactions
  const loadFromCache = () => {
    try {
      const manager = getRealtimeManager()
      if (!manager) return false
      
      const cachedBlocks = manager.getCachedBlocks()
      const cachedTransactions: Transaction[] = [] // Note: recentTransactionsCache not implemented yet
      
      if (cachedTransactions && cachedTransactions.length > 0) {
        console.log(`🚀 [Transactions] Using ${cachedTransactions.length} cached transactions for instant load`)
        setTransactions(cachedTransactions.slice(0, 50))
        setInitialLoading(false)
        return true
      }
      
      // Fallback: extract transactions from cached blocks
      if (cachedBlocks && cachedBlocks.length > 0) {
        console.log(`🚀 [Transactions] Extracting transactions from ${cachedBlocks.length} cached blocks`)
        const allTransactions: Transaction[] = []
        
        for (const block of cachedBlocks.slice(0, 5)) {
          if (block.transactions && Array.isArray(block.transactions)) {
            for (const tx of block.transactions.slice(0, 10)) {
              if (typeof tx === 'object' && tx.hash) {
                allTransactions.push(tx as Transaction)
              }
            }
          }
        }
        
        if (allTransactions.length > 0) {
          setTransactions(allTransactions.slice(0, 50))
          setInitialLoading(false)
          return true
        }
      }
      
      return false // No cached data available
    } catch (error) {
      console.warn('⚠️ [Transactions] Failed to load cached data:', error)
      return false
    }
  }

  useEffect(() => {
    // Try cache first, fallback to API
    if (!loadFromCache()) {
      loadTransactions()
    }
    
    // Set up realtime updates using the enhanced WebSocket manager
    const realtimeManager = getRealtimeManager()
    const unsubscribe = realtimeManager?.subscribe('transactions-page', (update) => {
      if (update.type === 'newBlock') {
        console.log('💸 [Transactions] New block with transactions:', update.data)
        const blockNum = parseInt(update.data.number, 16)
        setLatestBlock(blockNum)
        silentUpdate(update.data) // Silent update for new block
      } else if (update.type === 'newTransaction') {
        console.log('💸 [Transactions] New transaction:', update.data)
        silentUpdate(update.data) // Silent update for new transaction
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  // High-performance silent update for real-time changes
  const silentUpdate = useCallback(async (newData?: any) => {
    const now = Date.now()
    if (now - lastUpdateTime < 2000) return // Max 1 update per 2 seconds
    
    setLastUpdateTime(now)
    
    try {
      // Get recent blocks with transactions  
      const recentBlocks = await rethClient.getRecentBlocks(5)
      const recentTransactions: Transaction[] = []
      
      for (const block of recentBlocks.slice(0, 3)) {
        if (block.transactions && Array.isArray(block.transactions)) {
          for (const tx of block.transactions.slice(0, 10)) {
            if (tx && typeof tx === 'object' && tx.hash) {
              recentTransactions.push(tx)
              if (recentTransactions.length >= 50) break
            }
          }
        }
        if (recentTransactions.length >= 50) break
      }
      
      setTransactions(prevTransactions => {
        // Smart merge - only update if we have new transactions
        if (recentTransactions.length > 0 && prevTransactions.length > 0) {
          const latestPrevTx = prevTransactions[0]?.hash
          const latestNewTx = recentTransactions[0]?.hash
          
          // Only update if we have a different latest transaction
          if (latestNewTx !== latestPrevTx) {
            return recentTransactions
          }
          return prevTransactions
        }
        return recentTransactions
      })
    } catch (error) {
      console.warn('Silent transactions update failed:', error)
    }
  }, [lastUpdateTime])

  const loadTransactions = async () => {
    try {
      setInitialLoading(true)
      setError(null)
      
      // Get recent blocks with transactions
      const recentBlocks = await rethClient.getRecentBlocks(5)
      const allTransactions: Transaction[] = []
      
      for (const block of recentBlocks) {
        if (block.transactions && Array.isArray(block.transactions)) {
          // Get full transaction details for each tx in the block
          for (const tx of block.transactions.slice(0, 10)) { // Limit to 10 txs per block
            if (typeof tx === 'object' && tx.hash) {
              allTransactions.push(tx as Transaction)
            }
          }
        }
      }
      
      setTransactions(allTransactions.slice(0, 50)) // Show latest 50 transactions
      
      if (recentBlocks.length > 0) {
        const latest = parseInt(recentBlocks[0].number, 16)
        setLatestBlock(latest)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setInitialLoading(false)
    }
  }

  const formatValue = (value: string) => {
    if (!value || value === '0x0') return '0 RITUAL'
    try {
      const wei = parseInt(value, 16)
      const ritual = wei / 1e18
      return `${ritual.toFixed(6)} RITUAL`
    } catch {
      return '0 RITUAL'
    }
  }

  const formatGasPrice = (gasPrice: string) => {
    if (!gasPrice) return '0'
    try {
      const wei = parseInt(gasPrice, 16)
      const gwei = wei / 1e9
      return `${gwei.toFixed(2)} gwei`
    } catch {
      return '0 gwei'
    }
  }

  const getTxStatus = (tx: Transaction) => {
    // For now, assume all transactions are successful
    // In a real implementation, you'd check the transaction receipt
    return 'success'
  }

  const shortenAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const shortenHash = (hash: string) => {
    if (!hash) return 'N/A'
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="transactions" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Latest Transactions</h1>
              <p className="text-lime-200 mt-2">
                Real-time transactions from RETH nodes • Latest Block: #{latestBlock.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-white/5 border border-lime-500/20 rounded-lg">
            <TransactionTypeLegend />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg backdrop-blur-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-400">Connection Error</h3>
                <p className="text-red-300 text-sm mt-1">{error}</p>
                <button 
                  onClick={loadTransactions}
                  className="mt-2 px-3 py-1 bg-red-800/30 text-red-300 text-xs rounded hover:bg-red-700/30 border border-red-600/30"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {initialLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
            <p className="mt-2 text-lime-200">Loading transactions from RETH...</p>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm shadow-lg overflow-hidden sm:rounded-md border border-lime-500/20">
            <ul className="divide-y divide-lime-500/10">
              {transactions.map((tx) => (
                <li key={tx.hash} className="px-6 py-4 hover:bg-lime-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-lime-500/20 rounded-lg flex items-center justify-center border border-lime-500/30">
                          <span className="text-lime-300 text-xs">✓</span>
                        </div>
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <Link 
                            href={`/tx/${tx.hash}`}
                            className="text-lime-300 hover:text-white font-mono text-sm transition-colors"
                            title={tx.hash}
                          >
                            {shortenHash(tx.hash)}
                          </Link>
                          <TransactionTypeChip type={tx.type || '0x0'} />
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-lime-500/20 text-lime-300 border border-lime-500/30">
                            Success
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-lime-400">
                          <span>From: {shortenAddress(tx.from)}</span>
                          <span>→</span>
                          <span>To: {shortenAddress(tx.to)}</span>
                          <span>Block: {parseInt(tx.blockNumber, 16).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className="text-sm font-medium text-white">
                        {formatValue(tx.value)}
                      </span>
                      <span className="text-xs text-lime-300">
                        {formatGasPrice(tx.gasPrice)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {transactions.length === 0 && !initialLoading && !error && (
          <div className="text-center py-12 text-lime-300">
            <p>No transactions found. Check your RETH node connection.</p>
          </div>
        )}
      </main>
    </div>
  )
}
