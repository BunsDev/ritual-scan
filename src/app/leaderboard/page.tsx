'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { rethClient, SYSTEM_ACCOUNTS, RITUAL_CONTRACTS } from '@/lib/reth-client'
import { RITUAL_CONTRACT_ADDRESSES } from '@/lib/ritual-events-production'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

type LeaderboardTab = 'contracts-gas' | 'accounts-gas' | 'accounts-txs' | 'contracts-txs'

interface ContractGasEntry {
  address: string
  feesLast3hrs: number
  percentUsed3hrs: number
  feesLast24hrs: number
  percentUsed24hrs: number
}

interface AccountGasEntry {
  address: string
  feesLast3hrs: number
  percentUsed3hrs: number
  feesLast24hrs: number
  percentUsed24hrs: number
}

interface AccountTxEntry {
  address: string
  txCount24hr: number
  txCountTotal: number
  gasFeePaid24hr: number
  lastSeen: number
}

interface ContractTxEntry {
  address: string
  txCount24hr: number
  txCountTotal: number
  uniqueUsers: number
  deployedAt: number | null
  lastActivity: number
}

interface LeaderboardData {
  contractsGas: ContractGasEntry[]
  accountsGas: AccountGasEntry[]
  accountsTxs: AccountTxEntry[]
  contractsTxs: ContractTxEntry[]
  lastUpdateBlock: number
  lastUpdateTime: number
}

// Known address labels mapping
const KNOWN_ADDRESSES: Record<string, {name: string, type: 'system' | 'precompile' | 'contract'}> = {
  // System accounts
  [SYSTEM_ACCOUNTS.SCHEDULED.toLowerCase()]: { name: 'Scheduled System', type: 'system' },
  [SYSTEM_ACCOUNTS.ASYNC_COMMITMENT.toLowerCase()]: { name: 'Async Commitment System', type: 'system' },
  [SYSTEM_ACCOUNTS.ASYNC_SETTLEMENT.toLowerCase()]: { name: 'Async Settlement System', type: 'system' },
  
  // Ritual contracts (genesis)
  [RITUAL_CONTRACTS.ASYNC_PRECOMPILE.toLowerCase()]: { name: 'Async Precompile', type: 'precompile' },
  [RITUAL_CONTRACTS.SCHEDULER_CONTRACT.toLowerCase()]: { name: 'Scheduler Contract', type: 'contract' },
  [RITUAL_CONTRACTS.RITUAL_WALLET.toLowerCase()]: { name: 'Ritual Wallet', type: 'contract' },
  
  // Production contracts
  [RITUAL_CONTRACT_ADDRESSES.TEEDA_REGISTRY.toLowerCase()]: { name: 'Teeda Registry', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.PRECOMPILE_CONSUMER.toLowerCase()]: { name: 'Precompile Consumer', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.SCHEDULER.toLowerCase()]: { name: 'Scheduler', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.RITUAL_WALLET.toLowerCase()]: { name: 'Ritual Wallet', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.ASYNC_JOB_TRACKER.toLowerCase()]: { name: 'Async Job Tracker', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.STAKING.toLowerCase()]: { name: 'Staking', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.SCHEDULED_CONSUMER.toLowerCase()]: { name: 'Scheduled Consumer', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.WETH_TOKEN.toLowerCase()]: { name: 'WETH Token', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.USDC_TOKEN.toLowerCase()]: { name: 'USDC Token', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.UNISWAP_V3_ROUTER.toLowerCase()]: { name: 'Uniswap V3 Router', type: 'contract' },
  [RITUAL_CONTRACT_ADDRESSES.UNISWAP_V3_FACTORY.toLowerCase()]: { name: 'Uniswap V3 Factory', type: 'contract' },
  
  // Precompiles
  [RITUAL_CONTRACT_ADDRESSES.ONNX_INFERENCE_PRECOMPILE.toLowerCase()]: { name: 'ONNX Inference', type: 'precompile' },
  [RITUAL_CONTRACT_ADDRESSES.HTTP_CALL_PRECOMPILE.toLowerCase()]: { name: 'HTTP Call', type: 'precompile' },
  [RITUAL_CONTRACT_ADDRESSES.JQ_QUERY_PRECOMPILE.toLowerCase()]: { name: 'JQ Query', type: 'precompile' },
  [RITUAL_CONTRACT_ADDRESSES.ED25519_SIG_VER_PRECOMPILE.toLowerCase()]: { name: 'Ed25519 Verify', type: 'precompile' },
  [RITUAL_CONTRACT_ADDRESSES.SECP256R1_SIG_VER_PRECOMPILE.toLowerCase()]: { name: 'Secp256r1 Verify', type: 'precompile' },
}

const getAddressLabel = (address: string): {name: string, type: 'system' | 'precompile' | 'contract'} | null => {
  return KNOWN_ADDRESSES[address.toLowerCase()] || null
}

export default function LeaderboardPage() {
  useParticleBackground()
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('contracts-gas')
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [sortColumn, setSortColumn] = useState<string>('default')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  
  const latestBlockRef = useRef<number>(0)
  const processingRef = useRef<boolean>(false)
  const saveCacheTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Store raw transaction data for efficient recomputation
  const txDataRef = useRef<Map<string, {
    timestamp: number
    from: string
    to: string | null
    gasUsed: number
    gasPrice: number
    isContract: boolean
  }>>(new Map())

  // Check if address is a genesis contract
  const isGenesisContract = (address: string): boolean => {
    const addr = address.toLowerCase()
    const label = getAddressLabel(address)
    
    // System accounts and precompiles are genesis
    if (label !== null && (label.type === 'system' || label.type === 'precompile')) {
      return true
    }
    
    // Known genesis contracts from ritual-events-production - ALL OF THESE ARE GENESIS!
    const genesisContracts = [
      RITUAL_CONTRACT_ADDRESSES.TEEDA_REGISTRY.toLowerCase(),
      RITUAL_CONTRACT_ADDRESSES.PRECOMPILE_CONSUMER.toLowerCase(),
      RITUAL_CONTRACT_ADDRESSES.SCHEDULER.toLowerCase(),
      RITUAL_CONTRACT_ADDRESSES.RITUAL_WALLET.toLowerCase(),
      RITUAL_CONTRACT_ADDRESSES.ASYNC_JOB_TRACKER.toLowerCase(),
      RITUAL_CONTRACT_ADDRESSES.STAKING.toLowerCase(),
      RITUAL_CONTRACT_ADDRESSES.SCHEDULED_CONSUMER.toLowerCase(), // MISSING!
      RITUAL_CONTRACT_ADDRESSES.WETH_TOKEN.toLowerCase(),         // MISSING!
      RITUAL_CONTRACT_ADDRESSES.USDC_TOKEN.toLowerCase(),         // MISSING!  
      RITUAL_CONTRACT_ADDRESSES.UNISWAP_V3_ROUTER.toLowerCase(),  // MISSING!
      RITUAL_CONTRACT_ADDRESSES.UNISWAP_V3_FACTORY.toLowerCase(), // MISSING!
      RITUAL_CONTRACTS.SCHEDULER_CONTRACT.toLowerCase(),
      RITUAL_CONTRACTS.RITUAL_WALLET.toLowerCase(),
    ]
    
    return genesisContracts.includes(addr)
  }

  // Format deployment time - show "Genesis" for system contracts
  const formatDeployment = (address: string, timestamp: number | null) => {
    if (isGenesisContract(address)) {
      return 'Genesis (Block 0)'
    }
    if (!timestamp || timestamp <= 0) return 'Unknown'
    return timeAgo(timestamp)
  }

  // Format time ago
  const timeAgo = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return 'Unknown'
    
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 0) return 'Just now' // Handle future timestamps
    
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (seconds < 10) return 'Just now'
    if (seconds < 60) return `${seconds} secs ago`
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes % 60} min${minutes % 60 !== 1 ? 's' : ''} ago`
    return `${days} day${days !== 1 ? 's' : ''} ${hours % 24} hr${hours % 24 !== 1 ? 's' : ''} ago`
  }

  // Compute leaderboard stats from transaction data
  const computeLeaderboard = useCallback((): LeaderboardData => {
    const now = Date.now()
    const cutoff3hrs = now - (3 * 60 * 60 * 1000)
    const cutoff24hrs = now - (24 * 60 * 60 * 1000)
    
    // Aggregate data by address
    const contractGasMap = new Map<string, { fees3hrs: number, fees24hrs: number }>()
    const accountGasMap = new Map<string, { fees3hrs: number, fees24hrs: number }>()
    const accountTxMap = new Map<string, { count24hr: number, countTotal: number, fees24hr: number, lastSeen: number }>()
    const contractTxMap = new Map<string, { count24hr: number, countTotal: number, users: Set<string>, deployedAt: number | null, lastActivity: number }>()
    
    let totalGas3hrs = 0
    let totalGas24hrs = 0
    
    // Process all transactions
    txDataRef.current.forEach((tx) => {
      const gasUsed = tx.gasUsed
      const gasPrice = tx.gasPrice
      const fee = gasUsed * gasPrice / 1e18 // Convert to RITUAL
      
      const is3hrs = tx.timestamp >= cutoff3hrs
      const is24hrs = tx.timestamp >= cutoff24hrs
      
      if (is3hrs) totalGas3hrs += fee
      if (is24hrs) totalGas24hrs += fee
      
      // Track contract gas consumption
      if (tx.to && tx.isContract) {
        const contractEntry = contractGasMap.get(tx.to) || { fees3hrs: 0, fees24hrs: 0 }
        if (is3hrs) contractEntry.fees3hrs += fee
        if (is24hrs) contractEntry.fees24hrs += fee
        contractGasMap.set(tx.to, contractEntry)
        
        // Track contract transactions
        const contractTxEntry = contractTxMap.get(tx.to) || { 
          count24hr: 0, 
          countTotal: 0, 
          users: new Set<string>(), 
          deployedAt: null,
          lastActivity: 0
        }
        if (is24hrs) contractTxEntry.count24hr++
        contractTxEntry.countTotal++
        contractTxEntry.users.add(tx.from)
        
        // Track earliest timestamp as deployment time (first time we saw this contract)
        if (contractTxEntry.deployedAt === null || tx.timestamp < contractTxEntry.deployedAt) {
          contractTxEntry.deployedAt = tx.timestamp
        }
        
        contractTxEntry.lastActivity = Math.max(contractTxEntry.lastActivity, tx.timestamp)
        contractTxMap.set(tx.to, contractTxEntry)
      }
      
      // Track account gas spending
      const accountEntry = accountGasMap.get(tx.from) || { fees3hrs: 0, fees24hrs: 0 }
      if (is3hrs) accountEntry.fees3hrs += fee
      if (is24hrs) accountEntry.fees24hrs += fee
      accountGasMap.set(tx.from, accountEntry)
      
      // Track account transactions
      const accountTxEntry = accountTxMap.get(tx.from) || { 
        count24hr: 0, 
        countTotal: 0, 
        fees24hr: 0,
        lastSeen: 0
      }
      if (is24hrs) {
        accountTxEntry.count24hr++
        accountTxEntry.fees24hr += fee
      }
      accountTxEntry.countTotal++
      accountTxEntry.lastSeen = Math.max(accountTxEntry.lastSeen, tx.timestamp)
      accountTxMap.set(tx.from, accountTxEntry)
    })
    
    // Build leaderboard arrays
    const contractsGas: ContractGasEntry[] = Array.from(contractGasMap.entries())
      .map(([address, stats]) => ({
        address,
        feesLast3hrs: stats.fees3hrs,
        percentUsed3hrs: totalGas3hrs > 0 ? (stats.fees3hrs / totalGas3hrs) * 100 : 0,
        feesLast24hrs: stats.fees24hrs,
        percentUsed24hrs: totalGas24hrs > 0 ? (stats.fees24hrs / totalGas24hrs) * 100 : 0,
      }))
      .sort((a, b) => b.feesLast24hrs - a.feesLast24hrs)
      .slice(0, 100)
    
    const accountsGas: AccountGasEntry[] = Array.from(accountGasMap.entries())
      .map(([address, stats]) => ({
        address,
        feesLast3hrs: stats.fees3hrs,
        percentUsed3hrs: totalGas3hrs > 0 ? (stats.fees3hrs / totalGas3hrs) * 100 : 0,
        feesLast24hrs: stats.fees24hrs,
        percentUsed24hrs: totalGas24hrs > 0 ? (stats.fees24hrs / totalGas24hrs) * 100 : 0,
      }))
      .sort((a, b) => b.feesLast24hrs - a.feesLast24hrs)
      .slice(0, 100)
    
    const accountsTxs: AccountTxEntry[] = Array.from(accountTxMap.entries())
      .map(([address, stats]) => ({
        address,
        txCount24hr: stats.count24hr,
        txCountTotal: stats.countTotal,
        gasFeePaid24hr: stats.fees24hr,
        lastSeen: stats.lastSeen,
      }))
      .sort((a, b) => b.txCount24hr - a.txCount24hr)
      .slice(0, 100)
    
    const contractsTxs: ContractTxEntry[] = Array.from(contractTxMap.entries())
      .map(([address, stats]) => ({
        address,
        txCount24hr: stats.count24hr,
        txCountTotal: stats.countTotal,
        uniqueUsers: stats.users.size,
        deployedAt: stats.deployedAt,
        lastActivity: stats.lastActivity,
      }))
      .sort((a, b) => b.txCount24hr - a.txCount24hr)
      .slice(0, 100)
    
    return {
      contractsGas,
      accountsGas,
      accountsTxs,
      contractsTxs,
      lastUpdateBlock: latestBlockRef.current,
      lastUpdateTime: now,
    }
  }, [])

  // Process blocks to extract transaction data
  const processBlocks = useCallback(async (blocks: any[]) => {
    if (processingRef.current || blocks.length === 0) return
    
    processingRef.current = true
    console.log(`📊 [Leaderboard] Processing ${blocks.length} blocks...`)
    
    try {
      let newTxCount = 0
      let skippedStringTxs = 0
      
      for (const block of blocks) {
        const blockNumber = parseInt(block.number, 16)
        // Fix timestamp parsing - it's already in seconds, just need to validate
        let blockTimestamp: number
        if (typeof block.timestamp === 'string') {
          blockTimestamp = parseInt(block.timestamp, 16) * 1000 // Convert hex seconds to ms
        } else {
          blockTimestamp = block.timestamp * 1000 // Already a number in seconds
        }
        
        // More lenient timestamp validation
        const now = Date.now()
        if (blockTimestamp <= 0 || isNaN(blockTimestamp)) {
          console.warn(`⚠️ [Leaderboard] Invalid timestamp in block ${blockNumber}`)
          continue
        }
        // Allow timestamps up to 10 minutes in the future (clock skew)
        if (blockTimestamp > now + 600000) {
          blockTimestamp = now // Use current time if too far in future
        }
        
        if (!block.transactions || !Array.isArray(block.transactions)) continue
        
        for (const tx of block.transactions) {
          // Handle both string hashes and full transaction objects
          if (typeof tx === 'string') {
            // Transaction is just a hash - we can't process it without full data
            skippedStringTxs++
            continue
          }
          
          if (typeof tx !== 'object' || !tx.hash) continue
          
          // Skip if we've already processed this transaction
          if (txDataRef.current.has(tx.hash)) continue
          
          // Parse gas fields - they might be in receipt
          const gasUsed = tx.gas ? parseInt(tx.gas, 16) : 
                         tx.gasUsed ? parseInt(tx.gasUsed, 16) : 
                         21000 // Default gas for simple transfer
          
          const gasPrice = tx.gasPrice ? parseInt(tx.gasPrice, 16) : 
                          tx.maxFeePerGas ? parseInt(tx.maxFeePerGas, 16) :
                          tx.effectiveGasPrice ? parseInt(tx.effectiveGasPrice, 16) :
                          1000000000 // Default 1 gwei
          
          // Check if destination is a contract (not null, not zero address)
          const isContract = tx.to && tx.to !== '0x0000000000000000000000000000000000000000'
          
          txDataRef.current.set(tx.hash, {
            timestamp: blockTimestamp,
            from: tx.from || '0x0000000000000000000000000000000000000000',
            to: tx.to,
            gasUsed,
            gasPrice,
            isContract: isContract && tx.to !== null,
          })
          
          newTxCount++
        }
        
        latestBlockRef.current = Math.max(latestBlockRef.current, blockNumber)
      }
      
      // Prune old transactions (keep only last 7 days)
      const cutoff7days = Date.now() - (7 * 24 * 60 * 60 * 1000)
      let prunedCount = 0
      txDataRef.current.forEach((tx, hash) => {
        if (tx.timestamp < cutoff7days) {
          txDataRef.current.delete(hash)
          prunedCount++
        }
      })
      
      if (skippedStringTxs > 0) {
        console.log(`⚠️ [Leaderboard] Skipped ${skippedStringTxs} transactions (string hashes only - need full tx data)`)
      }
      
      if (prunedCount > 0) {
        console.log(`🗑️ [Leaderboard] Pruned ${prunedCount} old transactions (7+ days)`)
      }
      
      console.log(`✅ [Leaderboard] Processed ${newTxCount} new transactions (total: ${txDataRef.current.size})`)
      
      // Recompute leaderboard
      const leaderboardData = computeLeaderboard()
      setData(leaderboardData)
      
    } finally {
      processingRef.current = false
    }
  }, [computeLeaderboard])

  // Save leaderboard cache to localStorage (debounced)
  const saveLeaderboardCache = useCallback(() => {
    // Clear existing timeout
    if (saveCacheTimeoutRef.current) {
      clearTimeout(saveCacheTimeoutRef.current)
    }
    
    // Debounce: save 2 seconds after last update
    saveCacheTimeoutRef.current = setTimeout(() => {
      try {
        const cacheData = {
          txData: Array.from(txDataRef.current.entries()),
          lastUpdateBlock: latestBlockRef.current,
          timestamp: Date.now()
        }
        localStorage.setItem('ritual-scan-leaderboard-cache', JSON.stringify(cacheData))
        console.log(`💾 [Leaderboard] Saved ${txDataRef.current.size} transactions to cache`)
      } catch (error) {
        console.warn('⚠️ [Leaderboard] Failed to save cache:', error)
      }
    }, 2000)
  }, [])

  // Handle new block from websocket
  const handleNewBlock = useCallback(async (blockHeader: any) => {
    try {
      const blockNumber = parseInt(blockHeader.number || blockHeader.blockNumber, 16)
      
      if (blockNumber <= latestBlockRef.current) return
      
      console.log(`🔗 [Leaderboard] New block #${blockNumber}`)
      
      // Fetch full block data
      const fullBlock = await rethClient.getBlock(blockNumber, true)
      if (!fullBlock) return
      
      setIsLive(true)
      await processBlocks([fullBlock])
      
      // Save updated cache (debounced - will batch updates)
      saveLeaderboardCache()
      
    } catch (error) {
      console.error('❌ [Leaderboard] Failed to handle new block:', error)
    }
  }, [processBlocks, saveLeaderboardCache])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Try to restore from leaderboard-specific cache FIRST
        try {
          const cached = localStorage.getItem('ritual-scan-leaderboard-cache')
          if (cached) {
            const cacheData = JSON.parse(cached)
            const age = Date.now() - cacheData.timestamp
            
            // Use cache if less than 5 minutes old
            if (age < 300000 && Array.isArray(cacheData.txData)) {
              console.log(`🚀 [Leaderboard] Restored ${cacheData.txData.length} transactions from cache (age: ${(age/1000).toFixed(1)}s)`)
              txDataRef.current = new Map(cacheData.txData)
              latestBlockRef.current = cacheData.lastUpdateBlock || 0
              
              // Compute leaderboard from cached data
              const leaderboardData = computeLeaderboard()
              setData(leaderboardData)
              setLoading(false)
              
              console.log(`✅ [Leaderboard] Loaded from cache - no API calls needed!`)
              return // EXIT EARLY - no need to fetch anything!
            } else {
              console.log(`⏰ [Leaderboard] Cache too old (${(age/1000).toFixed(1)}s), will refresh`)
            }
          }
        } catch (error) {
          console.warn('⚠️ [Leaderboard] Failed to restore cache:', error)
        }
        
        // No valid cache - need to fetch data
        console.log('🔍 [Leaderboard] No valid cache, fetching 50 recent blocks with full transactions...')
        const latestBlockNum = await rethClient.getLatestBlockNumber()
        const fetchPromises = []
        for (let i = 0; i < 50; i++) {
          fetchPromises.push(rethClient.getBlock(latestBlockNum - i, true))
        }
        const blocks = await Promise.all(fetchPromises)
        const validBlocks = blocks.filter(b => b !== null)
        console.log(`✅ [Leaderboard] Fetched ${validBlocks.length} blocks with full tx data`)
        
        await processBlocks(validBlocks)
        
        // Save to cache for next time
        saveLeaderboardCache()
        
      } catch (error) {
        console.error('❌ [Leaderboard] Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [processBlocks, computeLeaderboard, saveLeaderboardCache])

  // Subscribe to real-time updates
  useEffect(() => {
    const manager = getRealtimeManager()
    if (!manager) return
    
    const unsubscribe = manager.subscribe('leaderboard', (update) => {
      if (update.type === 'newBlock') {
        handleNewBlock(update.data)
      }
    })
    
    console.log('📡 [Leaderboard] Subscribed to real-time updates')
    
    return () => {
      if (unsubscribe) {
        unsubscribe()
        console.log('🔌 [Leaderboard] Unsubscribed')
      }
    }
  }, [handleNewBlock])

  const formatNumber = (num: number) => num.toLocaleString()
  const formatFees = (fees: number) => `${fees.toFixed(2)} RITUAL`
  const formatPercent = (percent: number) => `${percent.toFixed(2)}%`

  // Copy address to clipboard
  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  // Sort data based on column
  const getSortedData = <T extends any>(data: T[], sortKey: string): T[] => {
    if (sortColumn === 'default') return data
    
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortKey as keyof T]
      const bVal = b[sortKey as keyof T]
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal)
      }
      
      return 0
    })
    
    return sorted
  }

  // Render sort arrow
  const SortArrow = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <span className="text-lime-600">↕</span>
    }
    return <span className="text-lime-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  // Address display component with labels and copy button
  const AddressDisplay = ({ address }: { address: string }) => {
    const label = getAddressLabel(address)
    const shortAddr = `${address.slice(0, 10)}...${address.slice(-8)}`
    const isCopied = copiedAddress === address
    
    if (label) {
      // Known address with label
      const badgeColor = label.type === 'system' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                         label.type === 'precompile' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                         'bg-blue-500/20 text-blue-300 border-blue-500/30'
      
      return (
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
            <Link 
              href={`/address/${address}`}
              className="text-lime-300 hover:text-lime-200 font-mono text-sm"
            >
              {shortAddr}
            </Link>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeColor}`}>
              {label.name}
            </span>
          </div>
          <button
            onClick={() => copyAddress(address)}
            className="p-1 hover:bg-lime-500/10 rounded transition-colors"
            title="Copy address"
          >
            {isCopied ? (
              <svg className="w-4 h-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      )
    }
    
    // Unknown address
    return (
      <div className="flex items-center gap-2">
        <Link 
          href={`/address/${address}`}
          className="text-lime-300 hover:text-lime-200 font-mono text-sm"
        >
          {shortAddr}
        </Link>
        <button
          onClick={() => copyAddress(address)}
          className="p-1 hover:bg-lime-500/10 rounded transition-colors"
          title="Copy address"
        >
          {isCopied ? (
            <svg className="w-4 h-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'contracts-gas' as const, label: 'Top Contracts - Gas Consumed' },
    { id: 'accounts-gas' as const, label: 'Top Accounts - Gas Spent' },
    { id: 'accounts-txs' as const, label: 'Top Accounts - Transactions Sent' },
    { id: 'contracts-txs' as const, label: 'Top Contracts - Transactions Invoked' },
  ]

  // Reset sort when switching tabs
  const handleTabChange = (tabId: LeaderboardTab) => {
    setActiveTab(tabId)
    setSortColumn('default')
    setSortDirection('desc')
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="leaderboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <span className="text-lime-300">Analytics</span>
            <span>→</span>
            <span className="text-white">Network Leaderboard</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Network Leaderboard</h1>
            <div className="flex items-center space-x-4">
              {isLive && (
                <span className="px-3 py-1 text-sm font-medium text-white bg-lime-600/20 border border-lime-500/30 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
                  Live Updates
                </span>
              )}
              {data && (
                <span className="text-lime-300 text-sm">
                  Latest updated at Block {formatNumber(data.lastUpdateBlock)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-lime-500/20 mb-6">
          <div className="flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`pb-3 px-1 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-lime-500 text-lime-400'
                    : 'border-transparent text-gray-400 hover:text-lime-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400 mr-3"></div>
            <span className="text-lime-200">Loading leaderboard data...</span>
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-lime-400">
            <p>No data available</p>
          </div>
        ) : (
          <>
            {/* Top Contracts - Gas Consumed */}
            {activeTab === 'contracts-gas' && (
              <div className="bg-white/5 border border-lime-500/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-lime-500/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Address</th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('feesLast3hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Fees Last 3hrs</span>
                          <SortArrow column="feesLast3hrs" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('percentUsed3hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>% Used 3hrs</span>
                          <SortArrow column="percentUsed3hrs" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('feesLast24hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Fees Last 24hrs</span>
                          <SortArrow column="feesLast24hrs" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('percentUsed24hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>% Used 24hrs</span>
                          <SortArrow column="percentUsed24hrs" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lime-500/10">
                    {getSortedData(data.contractsGas, sortColumn).map((entry, index) => (
                      <tr key={entry.address} className="hover:bg-lime-500/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressDisplay address={entry.address} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatFees(entry.feesLast3hrs)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span>{formatPercent(entry.percentUsed3hrs)}</span>
                            <div className="w-16 bg-lime-900/30 rounded-full h-2">
                              <div 
                                className="bg-lime-500 h-2 rounded-full" 
                                style={{ width: `${Math.min(entry.percentUsed3hrs * 5, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatFees(entry.feesLast24hrs)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatPercent(entry.percentUsed24hrs)}</td>
                      </tr>
                    ))}
                    {data.contractsGas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-lime-400/60">
                          No contract gas data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Top Accounts - Gas Spent */}
            {activeTab === 'accounts-gas' && (
              <div className="bg-white/5 border border-lime-500/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-lime-500/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Address</th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('feesLast3hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Fees Last 3hrs</span>
                          <SortArrow column="feesLast3hrs" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('percentUsed3hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>% Used 3hrs</span>
                          <SortArrow column="percentUsed3hrs" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('feesLast24hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Fees Last 24hrs</span>
                          <SortArrow column="feesLast24hrs" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('percentUsed24hrs')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>% Used 24hrs</span>
                          <SortArrow column="percentUsed24hrs" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lime-500/10">
                    {getSortedData(data.accountsGas, sortColumn).map((entry, index) => (
                      <tr key={entry.address} className="hover:bg-lime-500/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressDisplay address={entry.address} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatFees(entry.feesLast3hrs)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span>{formatPercent(entry.percentUsed3hrs)}</span>
                            <div className="w-16 bg-lime-900/30 rounded-full h-2">
                              <div 
                                className="bg-lime-500 h-2 rounded-full" 
                                style={{ width: `${Math.min(entry.percentUsed3hrs * 5, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatFees(entry.feesLast24hrs)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatPercent(entry.percentUsed24hrs)}</td>
                      </tr>
                    ))}
                    {data.accountsGas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-lime-400/60">
                          No account gas data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Top Accounts - Transactions Sent */}
            {activeTab === 'accounts-txs' && (
              <div className="bg-white/5 border border-lime-500/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-lime-500/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Address</th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('txCount24hr')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Transaction Count(24hr)</span>
                          <SortArrow column="txCount24hr" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('txCountTotal')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Total Transaction</span>
                          <SortArrow column="txCountTotal" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('gasFeePaid24hr')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Gas Fee paid (24hr)</span>
                          <SortArrow column="gasFeePaid24hr" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('lastSeen')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Last Seen</span>
                          <SortArrow column="lastSeen" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lime-500/10">
                    {getSortedData(data.accountsTxs, sortColumn).map((entry, index) => (
                      <tr key={entry.address} className="hover:bg-lime-500/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressDisplay address={entry.address} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatNumber(entry.txCount24hr)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatNumber(entry.txCountTotal)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatFees(entry.gasFeePaid24hr)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{timeAgo(entry.lastSeen)}</td>
                      </tr>
                    ))}
                    {data.accountsTxs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-lime-400/60">
                          No account transaction data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Top Contracts - Transactions Invoked */}
            {activeTab === 'contracts-txs' && (
              <div className="bg-white/5 border border-lime-500/20 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-lime-500/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-lime-400 uppercase tracking-wider">Contract</th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('txCount24hr')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Transaction Count(24hr)</span>
                          <SortArrow column="txCount24hr" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('txCountTotal')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Total Transaction</span>
                          <SortArrow column="txCountTotal" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('uniqueUsers')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Unique User</span>
                          <SortArrow column="uniqueUsers" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('deployedAt')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>First Seen</span>
                          <SortArrow column="deployedAt" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-lime-400 uppercase tracking-wider cursor-pointer hover:text-lime-300"
                        onClick={() => handleSort('lastActivity')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Last Activity</span>
                          <SortArrow column="lastActivity" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lime-500/10">
                    {getSortedData(data.contractsTxs, sortColumn).map((entry, index) => (
                      <tr key={entry.address} className="hover:bg-lime-500/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressDisplay address={entry.address} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatNumber(entry.txCount24hr)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatNumber(entry.txCountTotal)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{formatNumber(entry.uniqueUsers)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">
                          {formatDeployment(entry.address, entry.deployedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right">{timeAgo(entry.lastActivity)}</td>
                      </tr>
                    ))}
                    {data.contractsTxs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-lime-400/60">
                          No contract transaction data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
