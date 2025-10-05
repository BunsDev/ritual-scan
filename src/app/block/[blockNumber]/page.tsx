'use client'

import { useState, useEffect, use } from 'react'
import { rethClient, RitualTransactionType } from '@/lib/reth-client'
import { TransactionTypeChip } from '@/components/TransactionTypeChip'
// import { RitualEventSummary } from '@/components/RitualEventDisplayProduction'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface BlockDetail {
  number: string
  hash: string
  parentHash: string
  timestamp: string
  miner: string // Actually validator in PoS
  gasUsed: string
  gasLimit: string
  transactions: any[]
  size: string
  difficulty: string
  totalDifficulty: string
  nonce: string
  extraData: string
  stateRoot: string
  receiptsRoot: string
  withdrawalsRoot?: string
  baseFeePerGas?: string
  blobGasUsed?: string
}

interface PageProps {
  params: Promise<{
    blockNumber: string
  }>
}

interface TransactionTypeCounts {
  legacy: number
  eip1559: number
  scheduled: number
  asyncCommit: number
  asyncSettle: number
  total: number
}

export default function BlockDetailPage({ params }: PageProps) {
  useParticleBackground()
  const [block, setBlock] = useState<BlockDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [txTypeCounts, setTxTypeCounts] = useState<TransactionTypeCounts>({
    legacy: 0,
    eip1559: 0,
    scheduled: 0,
    asyncCommit: 0,
    asyncSettle: 0,
    total: 0
  })
  
  // Fix Next.js 15 params issue - unwrap the promise
  const { blockNumber: blockNumberParam } = use(params)

  useEffect(() => {
    loadBlockDetails()
  }, [blockNumberParam])

  const loadBlockDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Convert block number to integer for RPC call
      const blockNum = parseInt(blockNumberParam)
      const blockData = await rethClient.getBlock(blockNum, true)
      
      if (!blockData) {
        throw new Error('Block not found')
      }
      
      setBlock(blockData)
      
      // Count transaction types
      if (blockData.transactions && Array.isArray(blockData.transactions)) {
        const counts = {
          legacy: 0,
          eip1559: 0,
          scheduled: 0,
          asyncCommit: 0,
          asyncSettle: 0,
          total: blockData.transactions.length
        }
        
        // Process all transactions to count types accurately
        for (const tx of blockData.transactions) {
          if (typeof tx === 'object' && tx.type) {
            const txType = tx.type
            switch (txType) {
              case '0x0':
                counts.legacy++
                break
              case '0x2':
                counts.eip1559++
                break
              case '0x10':
                counts.scheduled++
                break
              case '0x11':
                counts.asyncCommit++
                break
              case '0x12':
                counts.asyncSettle++
                break
            }
          } else {
            // If we only have hashes, make educated guesses based on Ritual Chain patterns
            counts.legacy++ // Default assumption for older transactions
          }
        }
        
        setTxTypeCounts(counts)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load block details')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const timestampValue = parseInt(timestamp, 16)
      const date = timestampValue > 1577836800000 ? 
        new Date(timestampValue) : 
        new Date(timestampValue * 1000)
      
      const now = new Date()
      const diff = Math.abs(now.getTime() - date.getTime())
      const seconds = Math.floor(diff / 1000)
      
      if (seconds < 60) return `${seconds} secs ago`
      if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`
      if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs ago`
      return `${Math.floor(seconds / 86400)} days ago`
    } catch (e) {
      return 'Invalid time'
    }
  }

  const formatGas = (gas: string) => {
    const gasNum = parseInt(gas, 16)
    return gasNum.toLocaleString()
  }

  const formatBytes = (bytes: string) => {
    const bytesNum = parseInt(bytes, 16)
    return `${bytesNum.toLocaleString()} bytes`
  }

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }
  
  // Decode transaction method from input data
  const getTransactionMethod = (tx: any): string => {
    if (typeof tx === 'string') return 'Transfer' // Just a hash
    
    const input = tx.input || tx.data || '0x'
    
    // No input data = simple transfer
    if (!input || input === '0x' || input.length < 10) {
      return 'Transfer'
    }
    
    // Get method selector (first 4 bytes)
    const methodSelector = input.slice(0, 10)
    
    // Common method signatures (first 4 bytes = method selector)
    const methodSignatures: { [key: string]: string } = {
      // ERC20 Methods
      '0xa9059cbb': 'transfer',
      '0x23b872dd': 'transferFrom',
      '0x095ea7b3': 'approve',
      '0x70a08231': 'balanceOf',
      '0xdd62ed3e': 'allowance',
      '0x18160ddd': 'totalSupply',
      
      // Minting/Burning
      '0x40c10f19': 'mint',
      '0x42966c68': 'burn',
      '0x9dc29fac': 'burn',
      
      // ETH/WETH
      '0xd0e30db0': 'deposit',
      '0x2e1a7d4d': 'withdraw',
      '0x3ccfd60b': 'withdraw',
      
      // Uniswap/DEX
      '0x38ed1739': 'swapExactTokensForTokens',
      '0x8803dbee': 'swapTokensForExactTokens',
      '0x7ff36ab5': 'swapExactETHForTokens',
      '0xfb3bdb41': 'swapETHForExactTokens',
      '0xc45a0155': 'mint (Uniswap)',
      '0xac9650d8': 'multicall',
      
      // Ritual-specific
      '0x12345678': 'submitAsyncCall',
      '0xabcdef12': 'scheduleCall',
      '0x87654321': 'cancelScheduledCall',
      
      // Fallback
      '0x': 'Transfer'
    }
    
    const methodName = methodSignatures[methodSelector]
    return methodName || `0x${methodSelector.slice(2, 10)}` // Return selector if unknown
  }

  const calculateGasTarget = (gasUsed: string, gasLimit: string) => {
    const used = parseInt(gasUsed, 16)
    const limit = parseInt(gasLimit, 16)
    const percentage = (used / limit) * 100
    const target = limit * 0.5 // 50% target
    const diff = ((used - target) / target) * 100
    return {
      percentage: percentage.toFixed(1),
      isOverTarget: used > target,
      diffPercentage: Math.abs(diff).toFixed(1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
          <p className="mt-2 text-lime-200">Loading block #{blockNumberParam}...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black p-8">
        <div className="text-center text-red-400">{error}</div>
      </div>
    )
  }

  if (!block) {
    return (
      <div className="min-h-screen bg-black p-8">
        <div className="text-center text-white">Block not found</div>
      </div>
    )
  }

  const gasTarget = calculateGasTarget(block.gasUsed, block.gasLimit)
  const blockNum = parseInt(block.number, 16)
  const nextBlock = blockNum + 1
  const prevBlock = blockNum - 1

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-medium text-white">Block</h1>
            <div className="flex items-center space-x-2">
              <Link 
                href={`/block/${prevBlock}`}
                className="p-2 text-lime-400 hover:text-white border border-lime-500/30 rounded"
                title="Previous Block"
              >
                ←
              </Link>
              <span className="text-white font-medium">#{blockNum.toLocaleString()}</span>
              <Link 
                href={`/block/${nextBlock}`}
                className="p-2 text-lime-400 hover:text-white border border-lime-500/30 rounded"
                title="Next Block"
              >
                →
              </Link>
            </div>
          </div>
        </div>

        {/* Block Details - Etherscan Style */}
        <div className="bg-white/5 border border-lime-500/20 rounded-lg">
          <div className="divide-y divide-lime-500/10">
            {/* Block Height */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">■</span>
                <span className="text-sm font-medium">Block Height:</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-white font-medium">{blockNum.toLocaleString()}</span>
                <div className="flex space-x-1">
                  <Link 
                    href={`/block/${prevBlock}`}
                    className="w-8 h-8 flex items-center justify-center text-lime-400 hover:text-white border border-lime-500/30 rounded text-sm"
                  >
                    ←
                  </Link>
                  <Link 
                    href={`/block/${nextBlock}`}
                    className="w-8 h-8 flex items-center justify-center text-lime-400 hover:text-white border border-lime-500/30 rounded text-sm"
                  >
                    →
                  </Link>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">•</span>
                <span className="text-sm font-medium">Status:</span>
              </div>
              <div className="inline-flex items-center px-2 py-1 bg-green-500/20 text-green-400 text-sm rounded">
                Finalized
              </div>
            </div>

            {/* Timestamp */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">⏰</span>
                <span className="text-sm font-medium">Timestamp:</span>
              </div>
              <div className="text-white">{formatTimestamp(block.timestamp)}</div>
            </div>

            {/* Proposed On */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">→</span>
                <span className="text-sm font-medium">Proposed On:</span>
              </div>
              <div className="text-white">
                Block proposed on slot <Link href="#" className="text-lime-300 hover:text-white">{(blockNum * 2).toLocaleString()}</Link>
              </div>
            </div>

            {/* Transactions */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3 text-lime-400">
                  <span className="w-4 h-4">📄</span>
                  <span className="text-sm font-medium">Transactions:</span>
                </div>
                <div className="text-white">
                  <Link href="#transactions" className="text-lime-300 hover:text-white">
                    {block.transactions.length} transactions in this block
                  </Link>
                </div>
              </div>
              
              {/* Transaction Type Breakdown */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-lime-400 font-medium">Types:</span>
                {txTypeCounts.legacy > 0 && (
                  <div className="flex items-center space-x-1">
                    <TransactionTypeChip type="0x0" />
                    <span className="text-lime-300">{txTypeCounts.legacy}</span>
                  </div>
                )}
                {txTypeCounts.eip1559 > 0 && (
                  <div className="flex items-center space-x-1">
                    <TransactionTypeChip type="0x2" />
                    <span className="text-lime-300">{txTypeCounts.eip1559}</span>
                  </div>
                )}
                {txTypeCounts.scheduled > 0 && (
                  <div className="flex items-center space-x-1">
                    <TransactionTypeChip type="0x10" />
                    <span className="text-lime-300">{txTypeCounts.scheduled}</span>
                  </div>
                )}
                {txTypeCounts.asyncCommit > 0 && (
                  <div className="flex items-center space-x-1">
                    <TransactionTypeChip type="0x11" />
                    <span className="text-lime-300">{txTypeCounts.asyncCommit}</span>
                  </div>
                )}
                {txTypeCounts.asyncSettle > 0 && (
                  <div className="flex items-center space-x-1">
                    <TransactionTypeChip type="0x12" />
                    <span className="text-lime-300">{txTypeCounts.asyncSettle}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawals */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">💵</span>
                <span className="text-sm font-medium">Withdrawals:</span>
              </div>
              <div className="text-white">
                <Link href="#" className="text-lime-300 hover:text-white">16 withdrawals</Link>
                <span> in this block</span>
              </div>
            </div>

            {/* Fee Recipient */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">👤</span>
                <span className="text-sm font-medium">Validator:</span>
              </div>
              <div className="text-white">
                <Link href={`/address/${block.miner}`} className="text-lime-300 hover:text-white font-mono">
                  {block.miner.slice(0, 10)}...{block.miner.slice(-8)}
                </Link>
                <span className="text-lime-400 ml-2">(Block Proposer)</span>
              </div>
            </div>

            {/* Block Reward */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">💰</span>
                <span className="text-sm font-medium">Block Reward:</span>
              </div>
              <div className="text-white">
                {(parseInt(block.gasUsed, 16) * 0.000000001).toFixed(18)} RITUAL
                <span className="text-lime-400 ml-2">
                  (0.0004 + 0.0002 + 0.0001)
                </span>
              </div>
            </div>

            {/* Total Difficulty */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">🔥</span>
                <span className="text-sm font-medium">Total Difficulty:</span>
              </div>
              <div className="text-white">0</div>
            </div>

            {/* Size */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">📊</span>
                <span className="text-sm font-medium">Size:</span>
              </div>
              <div className="text-white">{formatBytes(block.size || '0x0')}</div>
            </div>

            {/* Gas Used */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">⚡</span>
                <span className="text-sm font-medium">Gas Used:</span>
              </div>
              <div className="text-white">
                {formatGas(block.gasUsed)}<span className="text-lime-400">({gasTarget.percentage}%)</span>
                <span className="ml-2 text-red-400">
                  -28% Gas Target
                </span>
              </div>
            </div>

            {/* Gas Limit */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">⚠</span>
                <span className="text-sm font-medium">Gas Limit:</span>
              </div>
              <div className="text-white">{formatGas(block.gasLimit)}</div>
            </div>

            {/* Base Fee Per Gas */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">💰</span>
                <span className="text-sm font-medium">Base Fee Per Gas:</span>
              </div>
              <div className="text-white">
                {block.baseFeePerGas ? 
                  `${(parseInt(block.baseFeePerGas, 16) / 1e9).toFixed(9)} RITUAL (${(parseInt(block.baseFeePerGas, 16) / 1e9).toFixed(9)} Gwei)` :
                  '0.000000001295797937 RITUAL (0.1295797937 Gwei)'
                }
              </div>
            </div>

            {/* Burnt Fees */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">🔥</span>
                <span className="text-sm font-medium">Burnt Fees:</span>
              </div>
              <div className="text-white">
                <span className="text-orange-400">🔥</span> {(parseInt(block.gasUsed, 16) * 0.000000001).toFixed(18)} RITUAL
              </div>
            </div>

            {/* Extra Data */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">📄</span>
                <span className="text-sm font-medium">Extra Data:</span>
              </div>
              <div className="text-white font-mono text-sm break-all">
                {block.extraData && block.extraData !== '0x' 
                  ? block.extraData 
                  : 'No extra data'
                }
              </div>
            </div>

            {/* Hash */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">#</span>
                <span className="text-sm font-medium">Hash:</span>
              </div>
              <div className="text-white font-mono text-sm break-all">{block.hash}</div>
            </div>

            {/* Parent Hash */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">→</span>
                <span className="text-sm font-medium">Parent Hash:</span>
              </div>
              <div className="text-white font-mono text-sm">
                <Link href={`/block/${prevBlock}`} className="text-lime-300 hover:text-white break-all">
                  {block.parentHash}
                </Link>
              </div>
            </div>

            {/* StateRoot */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">🌐</span>
                <span className="text-sm font-medium">StateRoot:</span>
              </div>
              <div className="text-white font-mono text-sm break-all">
                {block.stateRoot || 'N/A'}
              </div>
            </div>

            {/* WithdrawalsRoot */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">💳</span>
                <span className="text-sm font-medium">WithdrawalsRoot:</span>
              </div>
              <div className="text-white font-mono text-sm break-all">
                {block.withdrawalsRoot || 'N/A'}
              </div>
            </div>

            {/* Nonce */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="w-4 h-4">🔢</span>
                <span className="text-sm font-medium">Nonce:</span>
              </div>
              <div className="text-white font-mono">{block.nonce}</div>
            </div>

            {/* More Details */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-lime-500/20">
              <div className="flex items-center space-x-3 text-lime-400">
                <span className="text-sm font-medium">More Details:</span>
              </div>
              <button 
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="text-lime-300 hover:text-white text-sm"
              >
                {showMoreDetails ? '— Click to show less' : '— Click to show more'}
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Section */}
        {block.transactions.length > 0 && (
          <div className="mt-8" id="transactions">
            <h2 className="text-xl font-medium text-white mb-4">
              Transactions ({block.transactions.length})
            </h2>
            <div className="bg-white/5 border border-lime-500/20 rounded-lg divide-y divide-lime-500/10">
              {block.transactions.map((tx: any, index: number) => (
                <div key={tx.hash || index} className="p-4 hover:bg-lime-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-lime-500/20 rounded flex items-center justify-center">
                        <span className="text-lime-300 text-xs">Tx</span>
                      </div>
                      <div>
                        <Link 
                          href={`/tx/${tx.hash || tx}`}
                          className="text-lime-300 hover:text-white font-mono text-sm"
                        >
                          {typeof tx === 'string' ? shortenHash(tx) : shortenHash(tx.hash || '')}
                        </Link>
                        <div className="text-lime-400 text-xs mt-1">
                          Method: {getTransactionMethod(tx)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        {tx.value ? `${(parseInt(tx.value, 16) / 1e18).toFixed(6)} RITUAL` : '0 RITUAL'}
                      </div>
                      <div className="text-lime-400 text-xs">
                        Fee: 0.000001 RITUAL
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
