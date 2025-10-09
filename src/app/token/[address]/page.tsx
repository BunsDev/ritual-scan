'use client'

import { useState, useEffect } from 'react'
import { rethClient } from '@/lib/reth-client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface TokenInfo {
  address: string
  name?: string
  symbol?: string
  decimals?: number
  totalSupply?: string
  holders?: number
  type: 'ERC20' | 'ERC721' | 'ERC1155' | 'Unknown'
}

interface TokenTransfer {
  hash: string
  blockNumber: number
  timestamp: number
  from: string
  to: string
  value: string
  tokenId?: string
}

export default function TokenPage() {
  useParticleBackground()
  const params = useParams()
  const address = params.address as string
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [transfers, setTransfers] = useState<TokenTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transfersLoading, setTransfersLoading] = useState(false)

  useEffect(() => {
    if (address) {
      loadTokenInfo()
      loadTransfers()

      // Set up real-time updates
      const ws = rethClient.createWebSocketConnection(
        (newBlock) => {
          console.log('New block, checking for token transfers:', newBlock.number)
          checkBlockForTokenTransfers(newBlock)
        },
        (error) => {
          console.error('WebSocket error on token page:', error)
        }
      )

      return () => {
        if (ws) {
          ws.close()
        }
      }
    }
  }, [address])

  const checkBlockForTokenTransfers = async (blockData: any) => {
    try {
      const blockNumber = parseInt(blockData.number, 16)
      const fullBlock = await rethClient.getBlock(blockNumber, true)
      
      if (fullBlock && fullBlock.transactions) {
        const hasTokenTransfer = fullBlock.transactions.some((tx: any) => 
          tx.to?.toLowerCase() === address.toLowerCase()
        )
        
        if (hasTokenTransfer) {
          console.log('Found token transfers in new block, reloading...')
          loadTransfers()
        }
      }
    } catch (error) {
      console.error('Error checking block for token transfers:', error)
    }
  }

  const loadTokenInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      // Try to get basic contract info
      const code = await rethClient.rpcCall('eth_getCode', [address, 'latest'])
      
      if (code === '0x' || code === '0x0') {
        throw new Error('Not a contract address')
      }

      // Try to detect token type by calling standard functions
      let tokenType: 'ERC20' | 'ERC721' | 'ERC1155' | 'Unknown' = 'Unknown'
      let name: string | undefined
      let symbol: string | undefined
      let decimals: number | undefined
      let totalSupply: string | undefined

      try {
        // Try ERC20 name() function
        const nameCall = await rethClient.rpcCall('eth_call', [{
          to: address,
          data: '0x06fdde03' // name() selector
        }, 'latest'])
        
        if (nameCall && nameCall !== '0x') {
          // Decode the string (simplified - just remove padding)
          name = 'Token Contract' // Simplified for now
          tokenType = 'ERC20'
        }
      } catch (e) {
        // Not ERC20 or name() not implemented
      }

      try {
        // Try ERC20 symbol() function
        const symbolCall = await rethClient.rpcCall('eth_call', [{
          to: address,
          data: '0x95d89b41' // symbol() selector
        }, 'latest'])
        
        if (symbolCall && symbolCall !== '0x') {
          symbol = 'TKN' // Simplified for now
        }
      } catch (e) {
        // symbol() not implemented
      }

      try {
        // Try ERC20 decimals() function
        const decimalsCall = await rethClient.rpcCall('eth_call', [{
          to: address,
          data: '0x313ce567' // decimals() selector
        }, 'latest'])
        
        if (decimalsCall && decimalsCall !== '0x') {
          decimals = parseInt(decimalsCall, 16)
        }
      } catch (e) {
        // decimals() not implemented
      }

      try {
        // Try ERC20 totalSupply() function
        const totalSupplyCall = await rethClient.rpcCall('eth_call', [{
          to: address,
          data: '0x18160ddd' // totalSupply() selector
        }, 'latest'])
        
        if (totalSupplyCall && totalSupplyCall !== '0x') {
          const supply = parseInt(totalSupplyCall, 16)
          totalSupply = decimals ? (supply / Math.pow(10, decimals)).toFixed(2) : supply.toString()
        }
      } catch (e) {
        // totalSupply() not implemented
      }

      setTokenInfo({
        address,
        name: name || 'Unknown Token',
        symbol: symbol || 'UNK',
        decimals: decimals || 18,
        totalSupply,
        type: tokenType,
        holders: 0 // Would need to calculate from events
      })
    } catch (error: any) {
      console.error('Error loading token info:', error)
      setError(error.message || 'Failed to load token information')
    } finally {
      setLoading(false)
    }
  }

  const loadTransfers = async () => {
    try {
      setTransfersLoading(true)
      
      // Get recent blocks and look for transactions to this token contract
      const recentBlocks = await rethClient.getRecentBlocks(30)
      const tokenTransfers: TokenTransfer[] = []

      for (const block of recentBlocks) {
        if (block.transactions && Array.isArray(block.transactions)) {
          for (const tx of block.transactions) {
            // Look for transactions TO the token contract (transfers)
            if (tx.to?.toLowerCase() === address.toLowerCase() && tx.value && tx.value !== '0x0') {
              tokenTransfers.push({
                hash: tx.hash,
                blockNumber: parseInt(block.number, 16),
                timestamp: parseInt(block.timestamp, 16),
                from: tx.from,
                to: tx.to,
                value: tx.value ? (parseInt(tx.value, 16) / 1e18).toFixed(6) : '0'
              })
            }
          }
        }
      }

      // Sort by timestamp descending
      tokenTransfers.sort((a, b) => b.timestamp - a.timestamp)
      
      setTransfers(tokenTransfers.slice(0, 20))
    } catch (error: any) {
      console.error('Error loading transfers:', error)
    } finally {
      setTransfersLoading(false)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br bg-black">
        <header className="border-b border-lime-500/30 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="text-2xl font-bold text-lime-300">
                ⚡ Ritual Explorer
              </Link>
              <nav className="flex space-x-8">
                <Link href="/" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Home</Link>
                <Link href="/blocks" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Blocks</Link>
                <Link href="/transactions" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Transactions</Link>
                <Link href="/charts" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Analytics</Link>
                <Link href="/settings" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Settings</Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
            <p className="mt-2 text-lime-200">Loading token from RETH...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br bg-black">
        <header className="border-b border-lime-500/30 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="text-2xl font-bold text-lime-300">
                ⚡ Ritual Explorer
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 backdrop-blur-sm">
            <h3 className="text-red-400 font-semibold">Error Loading Token</h3>
            <p className="text-red-300 mt-2">{error}</p>
            <button 
              onClick={loadTokenInfo}
              className="mt-4 px-4 py-2 bg-red-800/30 text-red-300 rounded hover:bg-red-700/30 border border-red-600/30"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!tokenInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br bg-black">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-lime-200">Token not found</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br bg-black">
      <header className="border-b border-lime-500/30 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-lime-300">
                ⚡ Ritual Explorer
              </Link>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime-500/20 text-lime-200 border border-lime-500/30">
                RETH Live
              </span>
            </div>
            <nav className="flex space-x-8">
              <Link href="/" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Home</Link>
              <Link href="/blocks" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Blocks</Link>
              <Link href="/transactions" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Transactions</Link>
              <Link href="/analytics" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Analytics</Link>
              <Link href="/settings" className="text-lime-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">Settings</Link>
              <span className="text-lime-100 border-b-2 border-lime-400 px-3 py-2 text-sm font-medium">Token</span>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <span className="text-white">Token {tokenInfo.symbol || shortenAddress(address)}</span>
          </nav>
          
          <h1 className="text-3xl font-bold text-white mb-2">
            {tokenInfo.name} ({tokenInfo.symbol})
          </h1>
          <p className="text-lime-200">
            Real-time token data from RETH node • Updates automatically
          </p>
        </div>

        {/* Token Overview */}
        <div className="bg-black/20 backdrop-blur-sm shadow-lg overflow-hidden rounded-lg border border-lime-500/30 mb-8">
          <div className="px-6 py-4 border-b border-lime-500/30">
            <h3 className="text-lg font-medium text-white">Token Information</h3>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Contract Address</div>
                <div className="text-white font-mono text-sm mt-1 break-all">{address}</div>
              </div>
              
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Type</div>
                <div className="text-white text-lg font-semibold mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    tokenInfo.type === 'ERC20' ? 'bg-green-800/30 text-green-300' :
                    tokenInfo.type === 'ERC721' ? 'bg-blue-800/30 text-blue-300' :
                    tokenInfo.type === 'ERC1155' ? 'bg-yellow-800/30 text-yellow-300' :
                    'bg-gray-800/30 text-gray-300'
                  }`}>
                    {tokenInfo.type}
                  </span>
                </div>
              </div>
              
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Decimals</div>
                <div className="text-white text-lg font-semibold mt-1">{tokenInfo.decimals || 'N/A'}</div>
              </div>
              
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Total Supply</div>
                <div className="text-white text-lg font-semibold mt-1">
                  {tokenInfo.totalSupply ? `${tokenInfo.totalSupply} ${tokenInfo.symbol}` : 'Unknown'}
                </div>
              </div>
              
              <div className="bg-lime-500/10 p-4 rounded-lg border border-lime-500/20">
                <div className="text-lime-300 text-sm font-medium">Holders</div>
                <div className="text-white text-lg font-semibold mt-1">{tokenInfo.holders || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-black/20 backdrop-blur-sm shadow-lg overflow-hidden rounded-lg border border-lime-500/30">
          <div className="px-6 py-4 border-b border-lime-500/30">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Recent Token Activity</h3>
              {transfersLoading && (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-lime-400"></div>
                  <span className="text-lime-300 text-sm">Loading...</span>
                </div>
              )}
            </div>
            <p className="text-lime-300 text-sm mt-1">Recent transactions involving this token contract</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-lime-500/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Transaction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Block</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-lime-300 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lime-500/20">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-lime-300">
                      {transfersLoading ? 'Loading activity...' : 'No recent token activity found'}
                    </td>
                  </tr>
                ) : (
                  transfers.map((transfer) => (
                    <tr key={transfer.hash} className="hover:bg-lime-500/10">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/tx/${transfer.hash}`} className="text-lime-300 hover:text-white font-mono text-sm">
                          {shortenHash(transfer.hash)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/block/${transfer.blockNumber}`} className="text-lime-300 hover:text-white">
                          {transfer.blockNumber.toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-lime-200 text-sm">
                        {Math.floor((Date.now() / 1000 - transfer.timestamp) / 60)} mins ago
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/address/${transfer.from}`} className="text-lime-300 hover:text-white font-mono text-sm">
                          {shortenAddress(transfer.from)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/address/${transfer.to}`} className="text-lime-300 hover:text-white font-mono text-sm">
                          {shortenAddress(transfer.to)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-white font-mono text-sm">
                        {transfer.value} RITUAL
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
