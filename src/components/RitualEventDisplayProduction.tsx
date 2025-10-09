'use client'

import React from 'react'
import Link from 'next/link'
import { 
  RitualEventParserProduction, 
  hasRitualEvents, 
  getContractDeploymentStatus,
  formatRitualAmount,
  getContractName,
  RITUAL_CONTRACT_ADDRESSES
} from '@/lib/ritual-events-production'

interface RitualEventDisplayProps {
  logs: any[]
  transactionHash?: string
  blockNumber?: number
  compact?: boolean
}

export function RitualEventDisplay({ logs, transactionHash, blockNumber, compact = false }: RitualEventDisplayProps) {
  if (!logs || logs.length === 0 || !hasRitualEvents(logs)) {
    return null
  }

  // Parse all events using production system with real signatures
  const ritualEvents = RitualEventParserProduction.parseAllRitualEvents(logs)
  const deploymentStatus = getContractDeploymentStatus()
  
  // Count total events
  const totalEvents = Object.values(ritualEvents).reduce((sum, eventArray) => sum + eventArray.length, 0)
  
  // Debug: Show which contract addresses are detected in logs
  const detectedAddresses = logs.map(log => log.address).filter(Boolean)
  const uniqueAddresses = [...new Set(detectedAddresses)]

  // Combine all events in chronological order
  const allEvents = [
    ...ritualEvents.precompiles,
    ...ritualEvents.scheduler,
    ...ritualEvents.asyncJobs,
    ...ritualEvents.wallet,
    ...ritualEvents.executors,
    ...ritualEvents.staking,
    ...ritualEvents.scheduledConsumer,
    ...ritualEvents.erc20,
    ...ritualEvents.uniswap
  ].sort((a, b) => (a.logIndex || 0) - (b.logIndex || 0))

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 mt-6">
      {/* Header with deployment status */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">
            🔮 Ritual Transaction Analysis ({totalEvents} events detected)
          </h3>
          <div className="flex flex-wrap gap-1 mb-2">
            {ritualEvents.precompiles.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                ✅ Precompiles: {ritualEvents.precompiles.length}
              </span>
            )}
            {ritualEvents.scheduler.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ✅ Scheduler: {ritualEvents.scheduler.length}
              </span>
            )}
            {ritualEvents.asyncJobs.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                ✅ AsyncJobs: {ritualEvents.asyncJobs.length}
              </span>
            )}
            {ritualEvents.wallet.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                ✅ Wallet: {ritualEvents.wallet.length}
              </span>
            )}
            {ritualEvents.executors.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                ✅ Executors: {ritualEvents.executors.length}
              </span>
            )}
            {ritualEvents.staking.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ✅ Staking: {ritualEvents.staking.length}
              </span>
            )}
            {ritualEvents.scheduledConsumer.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ✅ ScheduledConsumer: {ritualEvents.scheduledConsumer.length}
              </span>
            )}
            {ritualEvents.erc20.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                ✅ ERC20: {ritualEvents.erc20.length}
              </span>
            )}
            {ritualEvents.uniswap.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-pink-500/20 text-pink-300 border border-pink-500/30">
                ✅ Uniswap: {ritualEvents.uniswap.length}
              </span>
            )}
            {totalEvents === 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-300 border border-gray-500/30">
                🔄 No Ritual events in this transaction
              </span>
            )}
          </div>
        </div>
        
        {/* Contract status summary */}
        <div className="flex flex-col space-y-1">
          {ritualEvents.precompiles.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              🔧 Precompiles: {ritualEvents.precompiles.length} ✅
            </span>
          )}
          {ritualEvents.scheduler.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
              📅 Scheduler: {ritualEvents.scheduler.length} ✅
            </span>
          )}
          {ritualEvents.asyncJobs.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
              🔧 Async: {ritualEvents.asyncJobs.length} ✅
            </span>
          )}
          {ritualEvents.wallet.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
              💰 Wallet: {ritualEvents.wallet.length} ✅
            </span>
          )}
          {ritualEvents.executors.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
              🏗️ Executors: {ritualEvents.executors.length} ✅
            </span>
          )}
          {ritualEvents.staking.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              🏛️ Staking: {ritualEvents.staking.length} ✅
            </span>
          )}
          {ritualEvents.scheduledConsumer.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
              🕒 Scheduled: {ritualEvents.scheduledConsumer.length} ✅
            </span>
          )}
          {ritualEvents.erc20.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
              💰 ERC20: {ritualEvents.erc20.length} ✅
            </span>
          )}
          {ritualEvents.uniswap.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-300 border border-pink-500/30">
              🔄 Uniswap: {ritualEvents.uniswap.length} ✅
            </span>
          )}
        </div>
      </div>

      {/* Debug Information Panel - Show detected contract addresses */}
      {uniqueAddresses.length > 0 && (
        <div className="mb-4 p-3 bg-black/10 rounded border border-lime-500/10">
          <h5 className="text-xs font-medium text-lime-400 mb-2">🔍 Detected Contract Addresses in Transaction</h5>
          <div className="flex flex-wrap gap-2 text-xs">
            {uniqueAddresses.map((addr, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <code className="text-cyan-300 font-mono">{addr.slice(0, 8)}...{addr.slice(-6)}</code>
                <span className="text-gray-400">
                  ({getContractName(addr) || 'Unknown'})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deployment Status Panel */}
      <div className="mb-4 p-4 bg-black/20 rounded-lg border border-lime-500/20">
        <h4 className="text-sm font-medium text-lime-400 mb-2">Ritual Contract Deployment Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-300">PrecompileConsumer:</span>
            <span className={deploymentStatus.precompileConsumer.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.precompileConsumer.status}
            </span>
            {deploymentStatus.precompileConsumer.status.includes('ACTIVE') && (
              <code className="text-gray-400 font-mono text-xs">
                {deploymentStatus.precompileConsumer.address.slice(0, 8)}...
              </code>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-purple-300">Scheduler:</span>
            <span className={deploymentStatus.scheduler.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.scheduler.status}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-300">RitualWallet:</span>
            <span className={deploymentStatus.ritualWallet.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.ritualWallet.status}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-blue-300">AsyncJobTracker:</span>
            <span className={deploymentStatus.asyncJobTracker.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.asyncJobTracker.status}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-orange-300">TeeDA Registry:</span>
            <span className={deploymentStatus.teedaRegistry.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.teedaRegistry.status}
            </span>
            {deploymentStatus.teedaRegistry.status.includes('ACTIVE') && (
              <code className="text-gray-400 font-mono text-xs">
                {deploymentStatus.teedaRegistry.address.slice(0, 8)}...
              </code>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-indigo-300">Staking:</span>
            <span className={deploymentStatus.staking.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.staking.status}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-purple-300">ScheduledConsumer:</span>
            <span className={deploymentStatus.scheduledConsumer.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.scheduledConsumer.status}
            </span>
            {deploymentStatus.scheduledConsumer.status.includes('ACTIVE') && (
              <code className="text-gray-400 font-mono text-xs">
                {deploymentStatus.scheduledConsumer.address.slice(0, 8)}...
              </code>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-300">WETH Token:</span>
            <span className={deploymentStatus.wethToken.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.wethToken.status}
            </span>
            {deploymentStatus.wethToken.status.includes('ACTIVE') && (
              <code className="text-gray-400 font-mono text-xs">
                {deploymentStatus.wethToken.address.slice(0, 8)}...
              </code>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-blue-300">USDC Token:</span>
            <span className={deploymentStatus.usdcToken.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.usdcToken.status}
            </span>
            {deploymentStatus.usdcToken.status.includes('ACTIVE') && (
              <code className="text-gray-400 font-mono text-xs">
                {deploymentStatus.usdcToken.address.slice(0, 8)}...
              </code>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-pink-300">Uniswap Router:</span>
            <span className={deploymentStatus.uniswapRouter.status.includes('ACTIVE') ? 'text-green-400' : 'text-yellow-400'}>
              {deploymentStatus.uniswapRouter.status}
            </span>
            {deploymentStatus.uniswapRouter.status.includes('ACTIVE') && (
              <code className="text-gray-400 font-mono text-xs">
                {deploymentStatus.uniswapRouter.address.slice(0, 8)}...
              </code>
            )}
          </div>
        </div>
      </div>

      {/* Event list */}
      {allEvents.length > 0 ? (
        <div className="space-y-4">
          {allEvents.map((event, index) => (
            <ProductionEventCard key={`event-${index}`} event={event} compact={compact} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <p className="mb-2">No Ritual-specific events detected in this transaction.</p>
          <p className="text-sm">
            Once more contracts are deployed, this panel will show comprehensive event analysis.
          </p>
        </div>
      )}
    </div>
  )
}

// ===== PRODUCTION EVENT CARD =====

function ProductionEventCard({ event, compact }: { event: any, compact: boolean }) {
  return (
    <div className="border border-lime-500/20 rounded-lg p-4 bg-black/10">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${event.color}`}>
            {event.icon} {event.eventType}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-lime-500/20 text-lime-300 border border-lime-500/30">
            {event.contract}
          </span>
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
            event.status === '✅ ACTIVE' 
              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
          }`}>
            {event.status}
          </span>
        </div>
        
        <div className="text-lime-300 text-sm font-mono">
          Log #{event.logIndex}
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* Contract Address */}
          <div className="col-span-2">
            <span className="text-lime-400">Contract: </span>
            <Link href={`/address/${event.address}`} className="text-lime-300 hover:text-white font-mono">
              {event.address}
            </Link>
            <span className="ml-2 text-gray-400">({getContractName(event.address)})</span>
          </div>

          {/* Event-specific fields */}
          {event.precompileType && (
            <div className="col-span-2">
              <span className="text-cyan-400">Precompile Type: </span>
              <span className="text-white font-medium">{event.precompileType}</span>
              <span className="ml-2 text-green-400">✅ Successfully Processed</span>
            </div>
          )}

          {event.callId && (
            <div>
              <span className="text-lime-400">Call ID: </span>
              <span className="text-white">#{event.callId}</span>
            </div>
          )}

          {event.to && (
            <div>
              <span className="text-lime-400">Target: </span>
              <Link href={`/address/${event.to}`} className="text-lime-300 hover:text-white font-mono">
                {event.to.slice(0, 10)}...{event.to.slice(-8)}
              </Link>
            </div>
          )}

          {event.executor && (
            <div>
              <span className="text-lime-400">Executor: </span>
              <Link href={`/address/${event.executor}`} className="text-lime-300 hover:text-white font-mono">
                {event.executor.slice(0, 10)}...{event.executor.slice(-8)}
              </Link>
            </div>
          )}

          {event.user && (
            <div>
              <span className="text-lime-400">User: </span>
              <Link href={`/address/${event.user}`} className="text-lime-300 hover:text-white font-mono">
                {event.user.slice(0, 10)}...{event.user.slice(-8)}
              </Link>
            </div>
          )}

          {event.validator && (
            <div>
              <span className="text-lime-400">Validator: </span>
              <Link href={`/address/${event.validator}`} className="text-lime-300 hover:text-white font-mono">
                {event.validator.slice(0, 10)}...{event.validator.slice(-8)}
              </Link>
            </div>
          )}

          {/* Real-time detection status */}

          {/* Enhanced debug information */}
          <div className="col-span-2">
            <details className="mt-2">
              <summary className="text-lime-400 cursor-pointer hover:text-lime-300 text-sm">
                🔍 Raw Log Data & Signature Analysis
              </summary>
              <div className="mt-2 p-3 bg-black/30 rounded text-xs font-mono text-gray-300 overflow-x-auto">
                <div><span className="text-lime-400">Event Signature (Topic[0]):</span></div>
                <div className="ml-2 break-all text-cyan-300">{event.topics?.[0]}</div>
                
                {event.rawTopic0 && (
                  <div className="mt-1">
                    <span className="text-yellow-400">Expected vs Actual:</span>
                    <div className="ml-2 text-xs">
                      <div className="text-green-300">✓ Detected: {event.rawTopic0}</div>
                      <div className="text-gray-400">Contract: {event.contract} ({event.address})</div>
                    </div>
                  </div>
                )}
                
                <div className="mt-2"><span className="text-lime-400">Indexed Parameters:</span></div>
                {event.topics?.slice(1).map((topic: string, i: number) => (
                  <div key={i} className="ml-2 break-all">
                    <span className="text-orange-400">Topic[{i+1}]:</span> {topic}
                  </div>
                ))}
                
                {event.data && (
                  <div className="mt-2">
                    <span className="text-lime-400">Non-indexed Data:</span>
                    <div className="ml-2 break-all">{event.data}</div>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== PRODUCTION CATEGORY BADGES =====

export function RitualTransactionCategoryBadge({ logs }: { logs: any[] }) {
  if (!hasRitualEvents(logs)) {
    return null
  }

  const events = RitualEventParserProduction.parseAllRitualEvents(logs)
  const totalEvents = Object.values(events).reduce((sum, eventArray) => sum + eventArray.length, 0)

  if (totalEvents === 0) {
    return null
  }

  // Determine primary category
  let primaryCategory = 'Ritual Transaction'
  if (events.precompiles.length > 0) primaryCategory = 'Precompile Execution'
  if (events.scheduler.length > 0) primaryCategory = 'Scheduled Execution'
  if (events.asyncJobs.length > 0) primaryCategory = 'Async Processing'
  if (events.wallet.length > 0) primaryCategory = 'Wallet Operation'
  if (events.staking.length > 0) primaryCategory = 'Staking Operation'

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-lime-500/20 text-lime-300 border border-lime-500/30">
      🔮 {primaryCategory} ({totalEvents} events)
    </span>
  )
}

export function RitualPrecompileIndicator({ logs }: { logs: any[] }) {
  const events = RitualEventParserProduction.parseAllRitualEvents(logs)
  
  if (events.precompiles.length === 0) {
    return null
  }

  const precompileTypes = [...new Set(events.precompiles.map(e => e.precompileType || 'Unknown'))]

  return (
    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
      🔧 {events.precompiles.length} Precompile Call{events.precompiles.length > 1 ? 's' : ''}
      {precompileTypes.length === 1 && (
        <span className="ml-1">({precompileTypes[0]})</span>
      )}
      <span className="ml-1 text-green-400">✅</span>
    </div>
  )
}
