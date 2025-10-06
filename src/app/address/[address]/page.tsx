'use client'

import { useState, useEffect } from 'react'
import { rethClient } from '@/lib/reth-client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface AddressInfo {
  address: string
  balance: string
  balanceUsd?: number
  transactionCount: number
  firstSeen?: string
  lastSeen?: string
}

interface Transaction {
  hash: string
  blockNumber: number
  timestamp: number
  from: string
  to: string
  value: string
  gasUsed?: string
  gasPrice?: string
  status?: string
}

export default function AddressPage() {
  useParticleBackground()
  const params = useParams()
  const address = params.address as string
  const [addressInfo, setAddressInfo] = useState<AddressInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [txLoading, setTxLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (address) {
      loadAddressInfo()
      loadTransactions()

      // Set up real-time updates
      const ws = rethClient.createWebSocketConnection(
        (newBlock) => {
          console.log('New block, checking for address updates:', newBlock.number)
          // Check if any transactions in the new block involve this address
          checkBlockForAddress(newBlock)
        },
        (error) => {
          console.error('WebSocket error on address page:', error)
        }
      )

      return () => {
        if (ws) {
          ws.close()
        }
      }
    }
  }, [address])

  const checkBlockForAddress = async (blockData: any) => {
    try {
      const blockNumber = parseInt(blockData.number, 16)
      const fullBlock = await rethClient.getBlock(blockNumber, true)
      
      if (fullBlock && fullBlock.transactions) {
        const hasAddressTransaction = fullBlock.transactions.some((tx: any) => 
          tx.from?.toLowerCase() === address.toLowerCase() || 
          tx.to?.toLowerCase() === address.toLowerCase()
        )
        
        if (hasAddressTransaction) {
          console.log('Found transactions for this address in new block, reloading...')
          loadAddressInfo()
          loadTransactions()
        }
      }
    } catch (error) {
      console.error('Error checking block for address:', error)
    }
  }

  const loadAddressInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get balance
      const balance = await rethClient.rpcCall('eth_getBalance', [address, 'latest'])
      const balanceRitual = (parseInt(balance, 16) / 1e18).toFixed(6)

      // Get transaction count
      const txCount = await rethClient.rpcCall('eth_getTransactionCount', [address, 'latest'])
      const transactionCount = parseInt(txCount, 16)

      setAddressInfo({
        address,
        balance: balanceRitual,
        transactionCount
      })
    } catch (error: any) {
      console.error('Error loading address info:', error)
      setError(error.message || 'Failed to load address information')
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async (pageNum = 1) => {
    try {
      setTxLoading(true)
      
      console.log(`Loading transactions for address: ${address}`)
      
      // Check WebSocket manager cache first (has up to 500 blocks!)
      const manager = (typeof window !== 'undefined' && (window as any).__realtimeManager) 
        ? (window as any).__realtimeManager 
        : null
      
      let blocksToSearch: any[] = []
      
      if (manager) {
        const cachedBlocks = manager.getCachedBlocks ? manager.getCachedBlocks() : []
        console.log(`Found ${cachedBlocks.length} blocks in cache`)
        blocksToSearch = cachedBlocks
      }
      
      // If no cache, fetch recent blocks
      if (blocksToSearch.length === 0) {
        console.log('No cache, fetching recent blocks...')
        blocksToSearch = await rethClient.getRecentBlocks(100) // Increased from 50
      }
      
      const addressTransactions: Transaction[] = []

      for (const block of blocksToSearch) {
        if (block.transactions && Array.isArray(block.transactions)) {
          for (const tx of block.transactions) {
            if (tx.from?.toLowerCase() === address.toLowerCase() || 
                tx.to?.toLowerCase() === address.toLowerCase()) {
              
              addressTransactions.push({
                hash: tx.hash,
                blockNumber: parseInt(block.number, 16),
                timestamp: parseInt(block.timestamp, 16),
                from: tx.from,
                to: tx.to || '0x0000000000000000000000000000000000000000',
                value: tx.value ? (parseInt(tx.value, 16) / 1e18).toFixed(6) : '0',
                gasUsed: tx.gas ? parseInt(tx.gas, 16).toString() : undefined,
                gasPrice: tx.gasPrice ? (parseInt(tx.gasPrice, 16) / 1e9).toFixed(2) : undefined,
                status: 'success'
              })
            }
          }
        }
      }

      console.log(`Found ${addressTransactions.length} transactions for address`)
      
      // Sort by timestamp descending
      addressTransactions.sort((a, b) => b.timestamp - a.timestamp)
      
      setTransactions(addressTransactions.slice(0, 50)) // Show first 50
    } catch (error: any) {
      console.error('Error loading transactions:', error)
    } finally {
      setTxLoading(false)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`
  }

  const formatTimeAgo = (timestamp: number) => {
    try {
      // timestamp is already in seconds from parseInt(block.timestamp, 16)
      const now = Math.floor(Date.now() / 1000) // Current time in seconds
      const diffSeconds = now - timestamp
      
      // Handle negative timestamps or future timestamps
      if (diffSeconds < 0) {
        return 'Future'
      }
      
      const diffMinutes = Math.floor(diffSeconds / 60)
      const diffHours = Math.floor(diffSeconds / 3600)
      const diffDays = Math.floor(diffSeconds / 86400)
      
      if (diffSeconds < 60) {
        return `${diffSeconds} sec${diffSeconds !== 1 ? 's' : ''} ago`
      } else if (diffMinutes < 60) {
        return `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`
      } else if (diffHours < 24) {
        return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`
      } else {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
      }
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error)
      return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <header className="border-b border-lime-500/20 bg-black/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-2xl font-bold text-lime-400 hover:text-lime-300 transition-colors">
                  Ritual Explorer
                </Link>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime-500/20 text-lime-300 border border-lime-500/30">
                  Shrinenet
                </span>
              </div>
              <nav className="hidden md:flex space-x-8">
                <Link href="/" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Home</Link>
                <Link href="/blocks" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Blocks</Link>
                <Link href="/transactions" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Transactions</Link>
                <Link href="/mempool" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Mempool</Link>
                <Link href="/scheduled" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Scheduled</Link>
                <Link href="/async" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Async</Link>
                <Link href="/analytics" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Analytics</Link>
                <Link href="/gas-tracker" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Gas Tracker</Link>
                <Link href="/settings" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Settings</Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
            <p className="mt-2 text-lime-200">Loading address from RETH...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <header className="border-b border-lime-500/20 bg-black/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-2xl font-bold text-lime-400 hover:text-lime-300 transition-colors">
                  Ritual Explorer
                </Link>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime-500/20 text-lime-300 border border-lime-500/30">
                  Shrinenet
                </span>
              </div>
              <nav className="hidden md:flex space-x-8">
                <Link href="/" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Home</Link>
                <Link href="/blocks" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Blocks</Link>
                <Link href="/transactions" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Transactions</Link>
                <Link href="/mempool" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Mempool</Link>
                <Link href="/scheduled" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Scheduled</Link>
                <Link href="/async" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Async</Link>
                <Link href="/analytics" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Analytics</Link>
                <Link href="/gas-tracker" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Gas Tracker</Link>
                <Link href="/settings" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Settings</Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 backdrop-blur-sm">
            <h3 className="text-red-400 font-semibold">Error Loading Address</h3>
            <p className="text-red-300 mt-2">{error}</p>
            <button 
              onClick={loadAddressInfo}
              className="mt-4 px-4 py-2 bg-red-800/30 text-red-300 rounded hover:bg-red-700/30 border border-red-600/30"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!addressInfo) {
    return (
      <div className="min-h-screen bg-black">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-lime-200">Address not found</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="address" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <span className="text-white">Address {shortenAddress(address)}</span>
          </nav>
          
          <h1 className="text-3xl font-bold text-white mb-2">Address Details</h1>
          <p className="text-lime-200">
            Real-time data from RETH node • Updates automatically
          </p>
        </div>

        {/* Address Overview */}
        <div className="bg-black/20 backdrop-blur-sm shadow-lg overflow-hidden rounded-lg border border-lime-500/30 mb-8">
          <div className="px-6 py-4 border-b border-lime-500/30">
            <h3 className="text-lg font-medium text-white">Address Overview</h3>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Address</div>
                <div className="text-white font-mono text-sm mt-1 break-all">{address}</div>
              </div>
              
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Balance</div>
                <div className="text-white text-lg font-semibold mt-1">{addressInfo.balance} RITUAL</div>
              </div>
              
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Transactions</div>
                <div className="text-white text-lg font-semibold mt-1">{addressInfo.transactionCount.toLocaleString()}</div>
              </div>
              
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Type</div>
                <div className="text-white text-lg font-semibold mt-1">
                  {addressInfo.transactionCount > 0 ? 'Active' : 'New'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-black/20 backdrop-blur-sm shadow-lg overflow-hidden rounded-lg border border-lime-500/30">
          <div className="px-6 py-4 border-b border-lime-500/30">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Recent Transactions</h3>
              {txLoading && (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-lime-400"></div>
                  <span className="text-lime-300 text-sm">Loading...</span>
                </div>
              )}
            </div>
            <p className="text-lime-300 text-sm mt-1">Latest transactions involving this address</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-lime-500/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Hash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Block</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lime-500/20">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-lime-300">
                      {txLoading ? 'Loading transactions...' : 'No recent transactions found'}
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.hash} className="hover:bg-lime-500/10">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/tx/${tx.hash}`} className="text-lime-300 hover:text-white font-mono text-sm">
                          {shortenHash(tx.hash)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/block/${tx.blockNumber}`} className="text-lime-300 hover:text-white">
                          {tx.blockNumber.toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-lime-200 text-sm">
                        {formatTimeAgo(tx.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-mono text-sm ${
                          tx.from.toLowerCase() === address.toLowerCase() 
                            ? 'text-red-300' 
                            : 'text-lime-300'
                        }`}>
                          {tx.from.toLowerCase() === address.toLowerCase() ? 'OUT' : shortenAddress(tx.from)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-mono text-sm ${
                          tx.to.toLowerCase() === address.toLowerCase() 
                            ? 'text-green-300' 
                            : 'text-lime-300'
                        }`}>
                          {tx.to.toLowerCase() === address.toLowerCase() ? 'IN' : shortenAddress(tx.to)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-white font-mono text-sm">
                        {tx.value} RITUAL
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
