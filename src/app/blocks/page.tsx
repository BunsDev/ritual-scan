'use client'

import { useState, useEffect, useCallback } from 'react'
import { rethClient } from '@/lib/reth-client'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface Block {
  number: string
  hash: string
  timestamp: string
  miner: string // Actually validator in PoS
  gasUsed: string
  gasLimit: string
  transactions: string[]
  size: string
}

export default function BlocksPage() {
  useParticleBackground()
  const [blocks, setBlocks] = useState<Block[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestBlockNumber, setLatestBlockNumber] = useState<number>(0)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)
  const [isMounted, setIsMounted] = useState(false)

  // Smart cache loader - NO RETRY DELAYS, instant fallback
  const loadFromCache = () => {
    try {
      const manager = getRealtimeManager()
      if (!manager) return false // SSR or not initialized
      
      const cachedBlocks = manager.getCachedBlocks()
      
      if (cachedBlocks && cachedBlocks.length > 0) {
        setBlocks(cachedBlocks.slice(0, 20))
        setLatestBlockNumber(parseInt(cachedBlocks[0].number, 16))
        setInitialLoading(false)
        return true
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  useEffect(() => {
    setIsMounted(true)
    
    // Try cache, instant API fallback
    if (!loadFromCache()) {
      loadBlocks()
    }
    
    const realtimeManager = getRealtimeManager()
    const unsubscribe = realtimeManager?.subscribe('blocks-page', (update) => {
      if (update.type === 'newBlock') {
        const blockNum = parseInt(update.data.number, 16)
        setLatestBlockNumber(blockNum)
        
        // Add new block to existing blocks (prepend to front)
        setBlocks(prevBlocks => {
          // Check if block already exists
          const exists = prevBlocks.some(b => parseInt(b.number, 16) === blockNum)
          if (exists) return prevBlocks
          
          // Prepend new block, keep 20 most recent
          const newBlocks = [update.data, ...prevBlocks].slice(0, 20)
          return newBlocks
        })
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // High-performance silent update for real-time changes
  const silentUpdate = useCallback(async (newBlockData?: any) => {
    const now = Date.now()
    if (now - lastUpdateTime < 2000) return // Max 1 update per 2 seconds
    
    setLastUpdateTime(now)
    setIsUpdating(true)
    
    try {
      const recentBlocks = await rethClient.getRecentBlocks(20)
      
      setBlocks(prevBlocks => {
        // Smart merge - only update if we have new blocks
        if (recentBlocks.length > 0 && prevBlocks.length > 0) {
          const latestPrevBlock = prevBlocks[0]?.number ? parseInt(prevBlocks[0].number, 16) : 0
          const latestNewBlock = parseInt(recentBlocks[0].number, 16)
          
          // Only update if we actually have newer blocks
          if (latestNewBlock > latestPrevBlock) {
            return recentBlocks
          }
          return prevBlocks
        }
        return recentBlocks
      })
    } catch (error) {
      console.warn('Silent blocks update failed:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [lastUpdateTime])

  const loadBlocks = async () => {
    try {
      setInitialLoading(true)
      setError(null)
      const recentBlocks = await rethClient.getRecentBlocks(20)
      setBlocks(recentBlocks)
      
      if (recentBlocks.length > 0) {
        const latest = parseInt(recentBlocks[0].number, 16)
        setLatestBlockNumber(latest)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blocks')
    } finally {
      setInitialLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    if (!isMounted) return '--'
    try {
      const timestampValue = parseInt(timestamp, 16)
      // RETH appears to return timestamps in milliseconds, not seconds
      const date = timestampValue > 1577836800000 ? 
        new Date(timestampValue) : // Already milliseconds
        new Date(timestampValue * 1000) // Convert seconds to milliseconds
      
      return date.toLocaleString()
    } catch (e) {
      console.error('Error parsing timestamp:', timestamp, e)
      return 'Invalid time'
    }
  }

  const formatBlockSize = (size: string) => {
    const bytes = parseInt(size, 16)
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const formatGas = (gas: string) => {
    const gasNum = parseInt(gas, 16)
    return gasNum.toLocaleString()
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="blocks" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Latest Blocks</h1>
              <p className="text-lime-200 mt-2">
                Real-time blocks from RETH nodes • Latest Block: #{latestBlockNumber.toLocaleString()}
              </p>
            </div>
            {isUpdating && (
              <div className="flex items-center space-x-2 text-sm text-lime-400">
                <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
                <span>Updating blocks...</span>
              </div>
            )}
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
                  onClick={loadBlocks}
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
            <p className="mt-2 text-lime-200">Loading blocks from RETH...</p>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm shadow-lg overflow-hidden sm:rounded-md border border-lime-500/20">
            <ul className={`divide-y divide-lime-500/10 transition-opacity duration-300 ${isUpdating ? 'opacity-75' : 'opacity-100'}`}>
              {blocks.map((block) => (
                <li key={block.hash} className="px-6 py-4 hover:bg-lime-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-lime-500/20 rounded-lg flex items-center justify-center border border-lime-500/30">
                          <span className="text-lime-300 font-semibold text-sm">
                            {parseInt(block.number, 16).toString().slice(-3)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <Link 
                            href={`/block/${parseInt(block.number, 16)}`}
                            className="text-lime-300 hover:text-white font-semibold transition-colors"
                          >
                            Block #{parseInt(block.number, 16).toLocaleString()}
                          </Link>
                          <span className="text-lime-600">•</span>
                          <span className="text-sm text-lime-400">
                            {formatTimestamp(block.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-lime-400">
                          <span>Validator: {block.miner?.slice(0, 10)}...</span>
                          <span>{Array.isArray(block.transactions) ? block.transactions.length : (typeof block.transactions === 'number' ? block.transactions : 0)} txns</span>
                          <span>Gas: {formatGas(block.gasUsed)}</span>
                          <span>Size: {formatBlockSize(block.size || '0x0')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime-500/20 text-lime-300 border border-lime-500/30">
                        {Array.isArray(block.transactions) ? block.transactions.length : (typeof block.transactions === 'number' ? block.transactions : 0)} TXs
                      </span>
                      <Link
                        href={`/block/${parseInt(block.number, 16)}`}
                        className="text-lime-300 hover:text-white text-sm font-medium transition-colors"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {blocks.length === 0 && !initialLoading && !error && (
          <div className="text-center py-12 text-lime-300">
            <p>No blocks found. Check your RETH node connection.</p>
          </div>
        )}
      </main>
    </div>
  )
}
