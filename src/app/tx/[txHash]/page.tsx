'use client'

import { useState, useEffect, use } from 'react'
import { rethClient, EnhancedTransaction, RitualTransactionType } from '@/lib/reth-client'
import { TransactionTypeBadge, SystemAccountBadge } from '@/components/TransactionTypeBadge'
import { EnhancedTransactionDetails } from '@/components/EnhancedTransactionDetails'
import { AsyncTransactionFlow } from '@/components/AsyncTransactionFlow'
import { ScheduledTransactionFlow } from '@/components/ScheduledTransactionFlow'
import { ContractInteractionDisplay } from '@/components/ContractInteractionDisplay'
import { PrecompileDataDisplay } from '@/components/PrecompileDataDisplay'
import Link from 'next/link'
import { TransactionTypeChip } from '@/components/TransactionTypeChip'
import { RitualEventDisplay, RitualTransactionCategoryBadge, RitualPrecompileIndicator } from '@/components/RitualEventDisplayProduction'
import { Navigation } from '@/components/Navigation'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface TransactionReceipt {
  status: string
  gasUsed: string
  blockHash: string
  blockNumber: string
  transactionHash: string
  transactionIndex: string
  from: string
  to: string | null
  contractAddress?: string
  logs: any[]
}

interface PageProps {
  params: Promise<{
    txHash: string
  }>
}

export default function TransactionDetailPage({ params }: PageProps) {
  useParticleBackground()
  const [transaction, setTransaction] = useState<EnhancedTransaction | null>(null)
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Fix Next.js 15 params issue - unwrap the promise
  const { txHash } = use(params)

  useEffect(() => {
    loadTransactionDetails()
  }, [txHash])

  const loadTransactionDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use enhanced transaction method to get Ritual-specific fields
      const [txData, receiptData] = await Promise.all([
        rethClient.getEnhancedTransaction(txHash),
        rethClient.getTransactionReceipt(txHash).catch(() => null) // Receipt might not exist
      ])
      
      if (!txData) {
        throw new Error('Transaction not found')
      }
      
      setTransaction(txData)
      setReceipt(receiptData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction details')
    } finally {
      setLoading(false)
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

  const formatGas = (gas: string) => {
    if (!gas) return '0'
    try {
      const gasNum = parseInt(gas, 16)
      return gasNum.toLocaleString()
    } catch {
      return '0'
    }
  }

  const formatGasPrice = (gasPrice: string) => {
    if (!gasPrice) return '0 gwei'
    try {
      const wei = parseInt(gasPrice, 16)
      const gwei = wei / 1e9
      return `${gwei.toFixed(2)} gwei`
    } catch {
      return '0 gwei'
    }
  }

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  const getTransactionStatus = () => {
    if (receipt) {
      const status = parseInt(receipt.status, 16)
      return status === 1 
        ? { status: 'Success', color: 'green' }
        : { status: 'Failed', color: 'red' }
    }
    return { status: 'Pending', color: 'yellow' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation currentPage="transactions" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400 mb-4"></div>
            <p className="text-lime-200">Loading transaction from RETH...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation currentPage="transactions" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
            <h3 className="text-red-400 font-semibold">Error Loading Transaction</h3>
            <p className="text-red-300 mt-2">{error}</p>
            <button 
              onClick={loadTransactionDetails}
              className="mt-4 px-4 py-2 bg-red-800/30 text-red-300 rounded hover:bg-red-700/30 border border-red-600/30"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-black">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-lime-200">Transaction not found</p>
        </main>
      </div>
    )
  }

  const txStatus = getTransactionStatus()

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="transactions" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <Link href="/transactions" className="hover:text-lime-200">Transactions</Link>
            <span>→</span>
            <span className="text-white">Transaction</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Transaction Details</h1>
              <p className="text-lime-200 mt-2">
                Real-time data from RETH node • Status: 
                <span className={`ml-1 px-2 py-0.5 rounded text-xs font-medium ${
                  txStatus.color === 'green' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  txStatus.color === 'red' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {txStatus.status}
                </span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <TransactionTypeBadge type={transaction.type} />
              <SystemAccountBadge address={transaction.from} />
              {receipt && receipt.logs && <RitualTransactionCategoryBadge logs={receipt.logs} />}
              {receipt && receipt.logs && <RitualPrecompileIndicator logs={receipt.logs} />}
            </div>
          </div>
        </div>

        {/* Enhanced Transaction Details Component */}
        <EnhancedTransactionDetails transaction={transaction} />

        {/* Precompile Data Display for any transaction with precompile calls */}
        {transaction && 
         transaction.precompileAddress && 
         transaction.precompileInput && (
          <div className="mt-6">
            <PrecompileDataDisplay 
              precompileAddress={transaction.precompileAddress}
              precompileInput={transaction.precompileInput}
            />
          </div>
        )}


        {/* Transaction Flow Visualizations */}
        {transaction && transaction.type === RitualTransactionType.SCHEDULED && (
          <ScheduledTransactionFlow transaction={transaction} />
        )}

        {/* Async Transaction Flow Visualization - STRICT filtering */}
        {transaction && (
          (transaction.type === RitualTransactionType.ASYNC_COMMITMENT && (
            transaction.from === '0x000000000000000000000000000000000000fa8e' ||
            transaction.from === '0x000000000000000000000000000000000000fa9e' ||
            (transaction.to && (
              transaction.to === '0x000000000000000000000000000000000000fa8e' ||
              transaction.to === '0x000000000000000000000000000000000000fa9e'
            ))
          )) ||
          (transaction.type === RitualTransactionType.ASYNC_SETTLEMENT && (
            transaction.from === '0x000000000000000000000000000000000000fa8e' ||
            transaction.from === '0x000000000000000000000000000000000000fa9e' ||
            (transaction.to && (
              transaction.to === '0x000000000000000000000000000000000000fa8e' ||
              transaction.to === '0x000000000000000000000000000000000000fa9e'
            ))
          ))
        ) && (
          <AsyncTransactionFlow transaction={transaction} />
        )}

        {/* Contract Interactions Display - Enhanced contract decoding */}
        {transaction && receipt && (
          <ContractInteractionDisplay 
            transaction={transaction}
            receipt={receipt}
          />
        )}

        {/* Ritual Events Display */}
        {receipt && receipt.logs && (
          <RitualEventDisplay 
            logs={receipt.logs} 
            transactionHash={txHash}
            blockNumber={receipt.blockNumber ? parseInt(receipt.blockNumber, 16) : undefined}
          />
        )}

        {/* Generic Transaction Receipt Logs (fallback) */}
        {receipt && receipt.logs && receipt.logs.length > 0 && (
          <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-medium text-white mb-4">
              Raw Event Logs ({receipt.logs.length})
            </h3>
            <div className="space-y-4">
              {receipt.logs.map((log: any, index: number) => (
                <div key={index} className="bg-black/30 rounded-lg p-4 border border-lime-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lime-400 text-sm font-medium">Log {index}</span>
                    <Link 
                      href={`/address/${log.address}`}
                      className="text-lime-300 hover:text-white font-mono text-sm"
                    >
                      {log.address}
                    </Link>
                  </div>
                  {log.topics && log.topics.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-lime-400 mb-1">Topics:</div>
                      {log.topics.map((topic: string, topicIndex: number) => (
                        <div key={topicIndex} className="font-mono text-xs bg-lime-500/10 p-2 rounded mb-1 break-all text-lime-200">
                          {topic}
                        </div>
                      ))}
                    </div>
                  )}
                  {log.data && (
                    <div className="mt-2">
                      <div className="text-xs text-lime-400 mb-1">Data:</div>
                      <div className="font-mono text-xs bg-lime-500/10 p-2 rounded break-all text-lime-200">
                        {log.data}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
