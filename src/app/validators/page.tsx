'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { rethClient } from '@/lib/reth-client'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface ValidatorStats {
  address: string
  blocksProposed: number
  blocksValidated: number
  stake: string
  healthStatus: 'active' | 'inactive' | 'warning'
  lastBlockNumber: number
  lastBlockTime: number
  percentage: number
}

interface BlockCache {
  number: number
  miner: string
  timestamp: number
}

export default function ValidatorsPage() {
  useParticleBackground()
  const [validators, setValidators] = useState<ValidatorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalBlocks, setTotalBlocks] = useState(0)
  const [blockRange, setBlockRange] = useState({ start: 0, end: 0 })
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Cache of all blocks for efficient updates (continuous expanding window)
  const blockCache = useRef<BlockCache[]>([])
  const latestBlockRef = useRef<number>(0)
  const isProcessingRef = useRef<boolean>(false)
  const handleNewBlockRef = useRef<(blockHeader: any) => Promise<void>>()

  // Recalculate validator stats from block cache
  const recalculateValidatorStats = useCallback(() => {
    if (blockCache.current.length === 0) {
      console.log('⚠️ [Validators] No blocks in cache yet')
      return
    }

    const validatorMap = new Map<string, {
      blocksProposed: number
      lastBlockNumber: number
      lastBlockTime: number
    }>()
    
    blockCache.current.forEach(block => {
      if (!validatorMap.has(block.miner)) {
        validatorMap.set(block.miner, {
          blocksProposed: 0,
          lastBlockNumber: block.number,
          lastBlockTime: block.timestamp
        })
      }
      
      const stats = validatorMap.get(block.miner)!
      stats.blocksProposed++
      
      if (block.number > stats.lastBlockNumber) {
        stats.lastBlockNumber = block.number
        stats.lastBlockTime = block.timestamp
      }
    })
    
    const latestBlock = blockCache.current[0]?.number || 0
    const oldestBlock = blockCache.current[blockCache.current.length - 1]?.number || 0
    const totalBlocksAnalyzed = blockCache.current.length
    
    setBlockRange({ start: oldestBlock, end: latestBlock })
    setTotalBlocks(totalBlocksAnalyzed)
    
    const validatorStats: ValidatorStats[] = Array.from(validatorMap.entries()).map(([address, stats]) => {
      const percentage = (stats.blocksProposed / totalBlocksAnalyzed) * 100
      const blocksSinceLastProposal = latestBlock - stats.lastBlockNumber
      
      let healthStatus: 'active' | 'inactive' | 'warning' = 'active'
      
      // Only compute health status after we have at least 30 blocks for statistical reliability
      if (totalBlocksAnalyzed >= 30) {
        // Activity share as probability (decimal, not percentage)
        const p = stats.blocksProposed / totalBlocksAnalyzed
        
        if (p > 0) {
          // Geometric distribution: time until next block produced
          // Mean = 1/p
          // Stddev = sqrt((1-p)/p²)
          const mean = 1 / p
          const variance = (1 - p) / (p * p)
          const stddev = Math.sqrt(variance)
          
          // Thresholds based on standard deviations
          const warningThreshold = mean + 2 * stddev  // 95% confidence
          const inactiveThreshold = mean + 3 * stddev // 99.7% confidence
          
          // Determine health status based on statistical thresholds
          if (blocksSinceLastProposal > inactiveThreshold) {
            healthStatus = 'inactive'
          } else if (blocksSinceLastProposal > warningThreshold) {
            healthStatus = 'warning'
          }
          // else: healthStatus remains 'active'
          
          console.log(`📊 [Validator ${address.slice(0, 10)}] p=${p.toFixed(4)}, mean=${mean.toFixed(1)}, warn=${warningThreshold.toFixed(1)}, inactive=${inactiveThreshold.toFixed(1)}, actual=${blocksSinceLastProposal}`)
        }
      }
      // If < 30 blocks, keep all as 'active' (insufficient data)
      
      return {
        address,
        blocksProposed: stats.blocksProposed,
        blocksValidated: stats.blocksProposed,
        stake: percentage.toFixed(2) + '%',
        healthStatus,
        lastBlockNumber: stats.lastBlockNumber,
        lastBlockTime: stats.lastBlockTime,
        percentage
      }
    })
    
    validatorStats.sort((a, b) => b.blocksProposed - a.blocksProposed)
    console.log(`📊 [Validators] Recalculated stats: ${validatorStats.length} validators from ${totalBlocksAnalyzed} blocks`)
    setValidators(validatorStats)
    setLastUpdate(new Date())
  }, [])

  // Handle new block from WebSocket - incremental update
  const handleNewBlock = useCallback(async (blockHeader: any) => {
    try {
      const blockNumber = parseInt(blockHeader.number, 16)
      
      // Skip if we've already processed this block
      if (blockNumber <= latestBlockRef.current) {
        console.log(`⏭️ [Validators] Skipping block #${blockNumber} (already processed)`)
        return
      }
      
      setIsUpdating(true)
      isProcessingRef.current = true
      latestBlockRef.current = blockNumber
      
      // Fetch full block to get miner info
      const fullBlock = await rethClient.getBlock(blockNumber, false)
      if (!fullBlock || !fullBlock.miner) {
        console.warn(`⚠️ [Validators] Block #${blockNumber} has no miner info`)
        return
      }
      
      const newBlock: BlockCache = {
        number: blockNumber,
        miner: fullBlock.miner.toLowerCase(),
        timestamp: parseInt(fullBlock.timestamp, 16)
      }
      
      // Add to cache (continuous expanding window)
      blockCache.current = [newBlock, ...blockCache.current]
      
      // Recalculate validator stats from cache
      recalculateValidatorStats()
      
      console.log(`✅ [Validators] Updated with block #${blockNumber} via WebSocket (total blocks: ${blockCache.current.length})`)
    } catch (error) {
      console.error('Failed to handle new block:', error)
    } finally {
      setIsUpdating(false)
      isProcessingRef.current = false
    }
  }, [recalculateValidatorStats])

  // Keep ref updated
  useEffect(() => {
    handleNewBlockRef.current = handleNewBlock
  }, [handleNewBlock])

  // Initialize once on mount
  useEffect(() => {
    setIsMounted(true)
    loadValidators()
  }, [])

  // Subscribe to WebSocket updates (only once)
  useEffect(() => {
    const realtimeManager = getRealtimeManager()
    const unsubscribe = realtimeManager?.subscribe('validators-page', (update) => {
      if (update.type === 'newBlock') {
        const blockNumber = parseInt(update.data.number, 16)
        console.log('🔍 [Validators] New block received via WebSocket:', blockNumber)
        
        // Use ref to avoid re-subscription
        if (handleNewBlockRef.current) {
          handleNewBlockRef.current(update.data)
        }
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const loadValidators = async () => {
    try {
      setError(null)
      
      // Get latest block number just for reference
      const latestBlockNumber = await rethClient.getLatestBlockNumber()
      latestBlockRef.current = latestBlockNumber
      
      console.log(`📊 [Validators] Starting from block #${latestBlockNumber}. Building validator stats live via WebSocket...`)
      
      // Start with empty cache - WebSocket will populate it
      blockCache.current = []
      setValidators([])
      setTotalBlocks(0)
      setBlockRange({ start: latestBlockNumber, end: latestBlockNumber })
      
      console.log(`✅ [Validators] Ready to receive blocks via WebSocket. Waiting for first block...`)
    } catch (err) {
      console.error('[Validators] Failed to initialize:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize validators')
    } finally {
      setLoading(false)
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400'
      case 'warning':
        return 'text-yellow-400'
      case 'inactive':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getHealthStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      case 'inactive':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const formatTimestamp = (timestamp: number) => {
    // RETH returns timestamps in milliseconds if > 1577836800000 (2020-01-01)
    // Otherwise they're in seconds and need conversion
    const date = timestamp > 1577836800000 ? 
      new Date(timestamp) : // Already milliseconds
      new Date(timestamp * 1000) // Convert seconds to milliseconds
    
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 0) return 'just now' // Handle future timestamps
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation currentPage="validators" />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-lime-400 mb-2">
                Validators
              </h1>
              <p className="text-lime-300/70">
                Real-time validator performance built live via WebSocket
              </p>
            </div>
            {isUpdating && (
              <div className="flex items-center space-x-2 text-sm text-lime-400">
                <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
                <span>Updating...</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-lime-500/5 border border-lime-500/20 rounded-lg p-4">
            <div className="text-lime-300/70 text-sm mb-1">Total Validators</div>
            <div className="text-2xl font-bold text-white">{validators.length}</div>
          </div>
          
          <div className="bg-lime-500/5 border border-lime-500/20 rounded-lg p-4">
            <div className="text-lime-300/70 text-sm mb-1">Blocks Analyzed</div>
            <div className="text-2xl font-bold text-white">{totalBlocks.toLocaleString()}</div>
          </div>
          
          <div className="bg-lime-500/5 border border-lime-500/20 rounded-lg p-4">
            <div className="text-lime-300/70 text-sm mb-1">Active Validators</div>
            <div className="text-2xl font-bold text-green-400">
              {validators.filter(v => v.healthStatus === 'active').length}
            </div>
          </div>
          
          <div className="bg-lime-500/5 border border-lime-500/20 rounded-lg p-4">
            <div className="text-lime-300/70 text-sm mb-1">Last Update</div>
            <div className="text-sm font-medium text-white">
              {isMounted && lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400"></div>
            <p className="mt-4 text-lime-300/70">Connecting to WebSocket...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Empty State - Waiting for blocks */}
        {!loading && !error && validators.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block animate-pulse text-6xl mb-4">📡</div>
            <p className="text-lime-300/70 text-lg">Waiting for blocks via WebSocket...</p>
            <p className="text-lime-300/50 text-sm mt-2">Validator stats will appear as new blocks arrive</p>
          </div>
        )}

        {/* Validators Table */}
        {!loading && !error && validators.length > 0 && (
          <div className="bg-black/50 border border-lime-500/20 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-lime-500/10 border-b border-lime-500/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">
                      Validator Address
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">
                      Blocks Proposed
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">
                      Blocks Validated
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">
                      Activity Share
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">
                      Last Block
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">
                      Health Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lime-500/10">
                  {validators.map((validator, index) => (
                    <tr 
                      key={validator.address}
                      className="hover:bg-lime-500/5 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-lime-300">
                          #{index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          href={`/address/${validator.address}`}
                          className="text-lime-300 hover:text-white font-mono text-sm transition-colors"
                        >
                          {validator.address.slice(0, 10)}...{validator.address.slice(-8)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white font-medium">
                          {validator.blocksProposed.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white font-medium">
                          {validator.blocksValidated.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm text-white font-medium mr-2">
                            {validator.stake}
                          </div>
                          <div className="w-24 bg-lime-500/10 rounded-full h-2">
                            <div 
                              className="bg-lime-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, validator.percentage)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-lime-300/70">
                          <Link 
                            href={`/block/${validator.lastBlockNumber}`}
                            className="hover:text-white transition-colors"
                          >
                            #{validator.lastBlockNumber}
                          </Link>
                          <div className="text-xs text-lime-300/50 mt-1">
                            {formatTimestamp(validator.lastBlockTime)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getHealthStatusBadge(validator.healthStatus)}`}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${validator.healthStatus === 'active' ? 'bg-green-400' : validator.healthStatus === 'warning' ? 'bg-yellow-400' : 'bg-red-400'}`}></span>
                          {validator.healthStatus.charAt(0).toUpperCase() + validator.healthStatus.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Footer */}
        {!loading && !error && validators.length > 0 && (
          <div className="mt-6 text-center text-sm text-lime-300/50">
            <p>
              Live validator statistics • {totalBlocks.toLocaleString()} blocks analyzed (#{blockRange.start.toLocaleString()} to #{blockRange.end.toLocaleString()})
            </p>
            <p className="mt-1">
              Built entirely from WebSocket updates • Continuous expanding window
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
