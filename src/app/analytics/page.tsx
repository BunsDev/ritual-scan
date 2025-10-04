'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { rethClient } from '@/lib/reth-client'
import { Navigation } from '@/components/Navigation'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

// Dynamic import to avoid SSR issues with Plotly
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as any

interface AnalyticsData {
  blocks: any[]
  avgGasUsed: number[]
  avgTxsPerBlock: number[]
  avgBlockSize: number[]
  blockNumbers: number[]
  timestamps: string[]
  gasEfficiency: number[]
  blockTimes: number[]
  timeframes?: {
    '5min': { timestamps: string[], avgGasUsed: number[], avgTxsPerBlock: number[], gasEfficiency: number[], avgBlockSize: number[] }
    '30min': { timestamps: string[], avgGasUsed: number[], avgTxsPerBlock: number[], gasEfficiency: number[], avgBlockSize: number[] }
    '1hr': { timestamps: string[], avgGasUsed: number[], avgTxsPerBlock: number[], gasEfficiency: number[], avgBlockSize: number[] }
  }
}

export default function AnalyticsPage() {
  useParticleBackground()
  const [data, setData] = useState<AnalyticsData>({
    blocks: [],
    avgGasUsed: [],
    avgTxsPerBlock: [],
    avgBlockSize: [],
    blockNumbers: [],
    timestamps: [],
    gasEfficiency: [],
    blockTimes: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'cache' | 'api' | null>(null)
  
  // Chart visibility toggles - separate state for each chart
  const [gasUsageToggles, setGasUsageToggles] = useState({
    perBlock: true, fiveMin: false, thirtyMin: false, oneHour: false
  })
  const [txCountToggles, setTxCountToggles] = useState({
    perBlock: true, fiveMin: false, thirtyMin: false, oneHour: false
  })
  const [blockSizeToggles, setBlockSizeToggles] = useState({
    perBlock: true, fiveMin: false, thirtyMin: false, oneHour: false
  })
  
  // Legacy toggle states for compatibility with existing code
  const [showPerBlock, setShowPerBlock] = useState(true)
  const [show5min, setShow5min] = useState(false)
  const [show30min, setShow30min] = useState(false)
  const [show1hr, setShow1hr] = useState(false)
  const [gasEfficiencyToggles, setGasEfficiencyToggles] = useState({
    perBlock: true, fiveMin: false, thirtyMin: false, oneHour: false
  })
  const [blockVelocityToggles, setBlockVelocityToggles] = useState({
    perBlock: true, fiveMin: false, thirtyMin: false, oneHour: false
  })

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Phase 1: Try to load from cache first (up to 500 blocks!)
      const manager = getRealtimeManager()
      let recentBlocks: any[] = []
      let source: 'cache' | 'api' = 'api'
      
      // Check per-page window first (accumulated data from previous visits)
      const pageWindowBlocks = manager.getPageBlockWindow('analytics')
      if (pageWindowBlocks.length > 0) {
        console.log(`📊 [Analytics] Loading ${pageWindowBlocks.length} blocks from per-page window`)
        recentBlocks = pageWindowBlocks.slice(0, 500) // Use up to 500 blocks
        source = 'cache'
      } 
      // Fall back to global cache
      else {
        const cachedBlocks = manager.getCachedBlocks()
        if (cachedBlocks.length > 0) {
          console.log(`📊 [Analytics] Loading ${cachedBlocks.length} blocks from global cache`)
          recentBlocks = cachedBlocks.slice(0, 200) // Use cached blocks (up to 200 for better performance)
          source = 'cache'
          
          // Initialize per-page window with cached data
          manager.setPageBlockWindow('analytics', recentBlocks)
        }
      }
      
      // If no cache available, fetch from API (original behavior)
      if (recentBlocks.length === 0) {
        console.log(`📊 [Analytics] No cache available, fetching 50 blocks from API`)
        recentBlocks = await rethClient.getRecentBlocks(50)
        source = 'api'
        
        // Initialize per-page window with API data
        if (recentBlocks.length > 0) {
          manager.setPageBlockWindow('analytics', recentBlocks)
        }
      }
      
      setDataSource(source)
      
      if (!recentBlocks.length) {
        throw new Error('No blocks available for analytics')
      }

      const blockNumbers: number[] = []
      const timestamps: string[] = []
      const avgGasUsed: number[] = []
      const avgTxsPerBlock: number[] = []
      const avgBlockSize: number[] = []
      const gasEfficiency: number[] = []
      const blockTimes: number[] = []

      // Multi-timeframe aggregations
      const timeframes = {
        '5min': { timestamps: [] as string[], avgGasUsed: [] as number[], avgTxsPerBlock: [] as number[], gasEfficiency: [] as number[], avgBlockSize: [] as number[] },
        '30min': { timestamps: [] as string[], avgGasUsed: [] as number[], avgTxsPerBlock: [] as number[], gasEfficiency: [] as number[], avgBlockSize: [] as number[] },
        '1hr': { timestamps: [] as string[], avgGasUsed: [] as number[], avgTxsPerBlock: [] as number[], gasEfficiency: [] as number[], avgBlockSize: [] as number[] }
      }

      // Process blocks for analytics
      for (let i = 0; i < recentBlocks.length; i++) {
        const block = recentBlocks[i]
        
        const blockNum = parseInt(block.number, 16)
        const gasUsed = parseInt(block.gasUsed, 16)
        const gasLimit = parseInt(block.gasLimit, 16)
        const txCount = Array.isArray(block.transactions) ? block.transactions.length : 0
        const blockSize = parseInt(block.size || '0x0', 16)
        // Fix timestamp parsing - RETH returns timestamps that may be in milliseconds
        const timestampValue = parseInt(block.timestamp, 16)
        const timestamp = timestampValue > 1577836800000 ? 
          new Date(timestampValue) : // Already milliseconds
          new Date(timestampValue * 1000) // Convert seconds to milliseconds
        
        blockNumbers.push(blockNum)
        timestamps.push(timestamp.toISOString())
        avgGasUsed.push(gasUsed)
        avgTxsPerBlock.push(txCount)
        avgBlockSize.push(blockSize)
        gasEfficiency.push((gasUsed / gasLimit) * 100)
        
        // Calculate block time (time since previous block)
        if (i < recentBlocks.length - 1) {
          const prevBlock = recentBlocks[i + 1]
          const prevTimestampValue = parseInt(prevBlock.timestamp, 16)
          const currentTimestampValue = parseInt(block.timestamp, 16)
          
          // Handle timestamps that might be in milliseconds or seconds
          const prevTimestamp = prevTimestampValue > 1577836800000 ? prevTimestampValue : prevTimestampValue * 1000
          const currentTimestamp = currentTimestampValue > 1577836800000 ? currentTimestampValue : currentTimestampValue * 1000
          
          const blockTime = Math.abs(currentTimestamp - prevTimestamp) / 1000 // seconds
          blockTimes.push(blockTime)
        }
      }

      // Create time-based aggregations
      const now = new Date()
      const aggregateByTimeframe = (minutes: number, key: '5min' | '30min' | '1hr') => {
        const intervalMs = minutes * 60 * 1000
        const buckets = new Map<string, { gasUsed: number[], txs: number[], efficiency: number[], blockSize: number[], count: number }>()
        
        for (let i = 0; i < timestamps.length; i++) {
          const timestamp = new Date(timestamps[i])
          const bucketTime = new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs)
          const bucketKey = bucketTime.toISOString()
          
          if (!buckets.has(bucketKey)) {
            buckets.set(bucketKey, { gasUsed: [], txs: [], efficiency: [], blockSize: [], count: 0 })
          }
          
          const bucket = buckets.get(bucketKey)!
          bucket.gasUsed.push(avgGasUsed[i])
          bucket.txs.push(avgTxsPerBlock[i])
          bucket.efficiency.push(gasEfficiency[i])
          bucket.blockSize.push(avgBlockSize[i])
          bucket.count++
        }
        
        // Convert to arrays
        Array.from(buckets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([timestamp, bucket]) => {
            timeframes[key].timestamps.push(timestamp)
            timeframes[key].avgGasUsed.push(bucket.gasUsed.reduce((a, b) => a + b, 0) / bucket.gasUsed.length)
            timeframes[key].avgTxsPerBlock.push(bucket.txs.reduce((a, b) => a + b, 0) / bucket.txs.length)
            timeframes[key].gasEfficiency.push(bucket.efficiency.reduce((a, b) => a + b, 0) / bucket.efficiency.length)
            timeframes[key].avgBlockSize.push(bucket.blockSize.reduce((a, b) => a + b, 0) / bucket.blockSize.length)
          })
      }

      aggregateByTimeframe(5, '5min')
      aggregateByTimeframe(30, '30min')
      aggregateByTimeframe(60, '1hr')

      setData({
        blocks: recentBlocks,
        avgGasUsed,
        avgTxsPerBlock,
        avgBlockSize,
        blockNumbers,
        timestamps,
        gasEfficiency,
        blockTimes,
        timeframes
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  // Ritual color scheme - Black, White, Lime Green
  const ritualColors = {
    primary: '#84cc16', // Lime green
    secondary: '#65a30d', // Darker lime
    accent: '#a3e635', // Light lime
    background: '#000000', // Pure black
    surface: '#0a0a0a', // Very dark
    text: '#ffffff', // Pure white
    muted: '#84cc16' // Lime for muted text
  }

  const plotConfig = {
    displayModeBar: false,
    responsive: true
  }

  const plotLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: ritualColors.text, family: 'Inter, sans-serif' },
    xaxis: { 
      gridcolor: '#374151', 
      color: ritualColors.text,
      showgrid: true,
      zeroline: false
    },
    yaxis: { 
      gridcolor: '#374151', 
      color: ritualColors.text,
      showgrid: true,
      zeroline: false
    },
    margin: { t: 40, r: 40, b: 60, l: 80 },
    autosize: true,
    // Standardize legends across all charts
    showlegend: false // Disable built-in legends, use custom button toggles consistently
  }

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x: number[], y: number[]): number => {
    if (x.length !== y.length || x.length === 0) return 0
    
    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0)
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0)
    
    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    
    return denominator === 0 ? 0 : numerator / denominator
  }

  // Calculate correlation matrices for different time scales
  const calculateCorrelationMatrix = (timeSeriesData: any) => {
    const gasUsed = timeSeriesData.avgGasUsed || []
    const transactions = timeSeriesData.avgTxsPerBlock || []
    const blockSize = timeSeriesData.avgBlockSize || []
    const gasEfficiency = timeSeriesData.gasEfficiency || []
    const blockTimes = timeSeriesData.blockTimes || []

    const variables = [gasUsed, transactions, blockSize, gasEfficiency, blockTimes]
    const matrix = []

    for (let i = 0; i < variables.length; i++) {
      const row = []
      for (let j = 0; j < variables.length; j++) {
        if (i === j) {
          row.push(1.00)
        } else {
          const correlation = calculateCorrelation(variables[i], variables[j])
          row.push(isNaN(correlation) ? 0 : parseFloat(correlation.toFixed(2)))
        }
      }
      matrix.push(row)
    }

    return matrix
  }

  // Calculate correlation matrices for each time scale
  const perBlockCorrelation = data ? calculateCorrelationMatrix(data) : []
  const fiveMinCorrelation = data?.timeframes?.['5min'] ? calculateCorrelationMatrix(data.timeframes['5min']) : []
  const oneHourCorrelation = data?.timeframes?.['1hr'] ? calculateCorrelationMatrix(data.timeframes['1hr']) : []

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation currentPage="analytics" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
            <p className="mt-2 text-lime-200">
              {dataSource === 'cache' ? 'Loading analytics from cache...' : 'Loading analytics from RETH...'}
            </p>
            {dataSource === 'cache' && (
              <p className="mt-1 text-lime-400 text-sm">⚡ Instant load from cached blocks</p>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 backdrop-blur-sm">
            <h3 className="text-red-400 font-semibold">Error Loading Analytics</h3>
            <p className="text-red-300 mt-2">{error}</p>
            <button 
              onClick={loadAnalyticsData}
              className="mt-4 px-4 py-2 bg-red-800/30 text-red-300 rounded hover:bg-red-700/30 border border-red-600/30"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="analytics" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white">Charts Dashboard</h1>
                {dataSource === 'cache' && (
                  <span className="px-3 py-1 text-sm font-medium text-white bg-blue-600/20 border border-blue-500/30 rounded-full">
                    ⚡ Cached
                  </span>
                )}
                {dataSource === 'api' && (
                  <span className="px-3 py-1 text-sm font-medium text-white bg-lime-600/20 border border-lime-500/30 rounded-full">
                    Live API
                  </span>
                )}
              </div>
              <p className="text-lime-200">
                Visual analytics from {data.blocks.length} recent blocks • 
                {dataSource === 'cache' 
                  ? ' Loaded from cache (instant!)' 
                  : ' Live data from RETH nodes'}
                {data.blocks.length > 50 && (
                  <span className="text-lime-400"> • Showing extended history</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadAnalyticsData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    🔄 Refresh Data
                  </>
                )}
              </button>

            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30">
            <div className="text-lime-400 text-sm font-medium">Avg Gas Usage</div>
            <div className="text-2xl font-bold text-white">
              {Math.round(data.avgGasUsed.reduce((a, b) => a + b, 0) / data.avgGasUsed.length).toLocaleString()}
            </div>
            <div className="text-lime-300 text-xs">per block</div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30">
            <div className="text-lime-400 text-sm font-medium">Avg Transactions</div>
            <div className="text-2xl font-bold text-white">
              {Math.round(data.avgTxsPerBlock.reduce((a, b) => a + b, 0) / data.avgTxsPerBlock.length)}
            </div>
            <div className="text-lime-300 text-xs">per block</div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30">
            <div className="text-lime-400 text-sm font-medium">Avg Block Size</div>
            <div className="text-2xl font-bold text-white">
              {Math.round(data.avgBlockSize.reduce((a, b) => a + b, 0) / data.avgBlockSize.length / 1024)} KB
            </div>
            <div className="text-lime-300 text-xs">average size</div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30">
            <div className="text-lime-400 text-sm font-medium">Avg Block Time</div>
            <div className="text-2xl font-bold text-white">
              {data.blockTimes.length > 0 ? Math.round(data.blockTimes.reduce((a, b) => a + b, 0) / data.blockTimes.length) : 0}s
            </div>
            <div className="text-lime-300 text-xs">between blocks</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gas Usage Over Time */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 overflow-hidden">
            <h3 className="text-xl font-semibold text-white mb-4">Gas Usage Over Time</h3>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setGasUsageToggles(prev => ({ ...prev, perBlock: !prev.perBlock }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    gasUsageToggles.perBlock 
                      ? 'bg-lime-500/20 text-lime-300 border-lime-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  Per Block
                </button>
                <button
                  onClick={() => setGasUsageToggles(prev => ({ ...prev, fiveMin: !prev.fiveMin }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    gasUsageToggles.fiveMin 
                      ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  5min avg
                </button>
                <button
                  onClick={() => setGasUsageToggles(prev => ({ ...prev, thirtyMin: !prev.thirtyMin }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    gasUsageToggles.thirtyMin 
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  30min avg
                </button>
                <button
                  onClick={() => setGasUsageToggles(prev => ({ ...prev, oneHour: !prev.oneHour }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    gasUsageToggles.oneHour 
                      ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  1hr avg
                </button>
              </div>
            </div>
            <div className="w-full h-80 min-h-0">
              <Plot
                data={[
                  // Original per-block data
                  ...(gasUsageToggles.perBlock ? [{
                    x: data.timestamps,
                    y: data.avgGasUsed,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: ritualColors.primary, width: 2 },
                    name: 'Per Block'
                  }] : []),
                  // 5-minute aggregation
                  ...(gasUsageToggles.fiveMin && data.timeframes ? [{
                    x: data.timeframes['5min'].timestamps,
                    y: data.timeframes['5min'].avgGasUsed,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#22c55e', size: 4 },
                    line: { color: '#22c55e', width: 2 },
                    name: '5min avg'
                  }] : []),
                  // 30-minute aggregation
                  ...(gasUsageToggles.thirtyMin && data.timeframes ? [{
                    x: data.timeframes['30min'].timestamps,
                    y: data.timeframes['30min'].avgGasUsed,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#f59e0b', size: 5 },
                    line: { color: '#f59e0b', width: 3 },
                    name: '30min avg'
                  }] : []),
                  // 1-hour aggregation
                  ...(gasUsageToggles.oneHour && data.timeframes ? [{
                    x: data.timeframes['1hr'].timestamps,
                    y: data.timeframes['1hr'].avgGasUsed,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#ef4444', size: 6 },
                    line: { color: '#ef4444', width: 4 },
                    name: '1hr avg'
                  }] : [])
                ]}
                layout={{
                  ...plotLayout,
                  title: { text: 'Gas Used Over Time', font: { color: ritualColors.text, size: 16 } },
                  xaxis: { 
                    ...plotLayout.xaxis, 
                    title: 'Time',
                    type: 'date',
                    tickformat: '%H:%M:%S'
                  },
                  yaxis: { ...plotLayout.yaxis, title: 'Gas Used' }
                }}
                config={plotConfig}
                className="w-full h-full"
                useResizeHandler={true}
              />
            </div>
          </div>

          {/* Transactions Per Block */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 overflow-hidden">
            <h3 className="text-xl font-semibold text-white mb-4">Transactions Over Time</h3>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTxCountToggles(prev => ({ ...prev, perBlock: !prev.perBlock }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    txCountToggles.perBlock 
                      ? 'bg-lime-500/20 text-lime-300 border-lime-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  Per Block
                </button>
                <button
                  onClick={() => setTxCountToggles(prev => ({ ...prev, fiveMin: !prev.fiveMin }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    txCountToggles.fiveMin 
                      ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  5min avg
                </button>
                <button
                  onClick={() => setTxCountToggles(prev => ({ ...prev, thirtyMin: !prev.thirtyMin }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    txCountToggles.thirtyMin 
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  30min avg
                </button>
                <button
                  onClick={() => setTxCountToggles(prev => ({ ...prev, oneHour: !prev.oneHour }))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    txCountToggles.oneHour 
                      ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  1hr avg
                </button>
              </div>
            </div>
            <div className="w-full h-80 min-h-0">
              <Plot
                data={[
                  // Original per-block data
                  ...(txCountToggles.perBlock ? [{
                    x: data.timestamps,
                    y: data.avgTxsPerBlock,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: ritualColors.secondary, width: 2 },
                    name: 'Per Block'
                  }] : []),
                  // 5-minute aggregation
                  ...(txCountToggles.fiveMin && data.timeframes ? [{
                    x: data.timeframes['5min'].timestamps,
                    y: data.timeframes['5min'].avgTxsPerBlock,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#22c55e', size: 4 },
                    line: { color: '#22c55e', width: 2 },
                    name: '5min avg'
                  }] : []),
                  // 30-minute aggregation
                  ...(txCountToggles.thirtyMin && data.timeframes ? [{
                    x: data.timeframes['30min'].timestamps,
                    y: data.timeframes['30min'].avgTxsPerBlock,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#f59e0b', size: 5 },
                    line: { color: '#f59e0b', width: 3 },
                    name: '30min avg'
                  }] : []),
                  // 1-hour aggregation
                  ...(txCountToggles.oneHour && data.timeframes ? [{
                    x: data.timeframes['1hr'].timestamps,
                    y: data.timeframes['1hr'].avgTxsPerBlock,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#ef4444', size: 6 },
                    line: { color: '#ef4444', width: 4 },
                    name: '1hr avg'
                  }] : [])
                ]}
                layout={{
                  ...plotLayout,
                  title: { text: 'Transactions Over Time', font: { color: ritualColors.text, size: 16 } },
                  xaxis: { 
                    ...plotLayout.xaxis, 
                    title: 'Time',
                    type: 'date',
                    tickformat: '%H:%M:%S'
                  },
                  yaxis: { ...plotLayout.yaxis, title: 'Transaction Count' }
                }}
                config={plotConfig}
                className="w-full h-full"
                useResizeHandler={true}
              />
            </div>
          </div>

          {/* Block Size Over Time */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 overflow-hidden">
            <h3 className="text-xl font-semibold text-white mb-4">Block Size Over Time</h3>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPerBlock(!showPerBlock)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    showPerBlock 
                      ? 'bg-lime-500/20 text-lime-300 border-lime-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  Per Block
                </button>
                <button
                  onClick={() => setShow5min(!show5min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show5min 
                      ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  5min avg
                </button>
                <button
                  onClick={() => setShow30min(!show30min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show30min 
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  30min avg
                </button>
                <button
                  onClick={() => setShow1hr(!show1hr)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show1hr 
                      ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  1hr avg
                </button>
              </div>
            </div>
            <div className="w-full h-80 min-h-0">
              <Plot
                data={[
                  // Original per-block data
                  ...(showPerBlock ? [{
                    x: data.timestamps,
                    y: data.avgBlockSize.map(size => size / 1024), // Convert to KB
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: ritualColors.accent, width: 2 },
                    name: 'Per Block'
                  }] : []),
                  // 5-minute aggregation
                  ...(show5min && data.timeframes ? [{
                    x: data.timeframes['5min'].timestamps,
                    y: data.timeframes['5min'].avgBlockSize.map(size => size / 1024),
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#22c55e', size: 4 },
                    line: { color: '#22c55e', width: 2 },
                    name: '5min avg'
                  }] : []),
                  // 30-minute aggregation
                  ...(show30min && data.timeframes ? [{
                    x: data.timeframes['30min'].timestamps,
                    y: data.timeframes['30min'].avgBlockSize.map(size => size / 1024),
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#f59e0b', size: 5 },
                    line: { color: '#f59e0b', width: 3 },
                    name: '30min avg'
                  }] : []),
                  // 1-hour aggregation
                  ...(show1hr && data.timeframes ? [{
                    x: data.timeframes['1hr'].timestamps,
                    y: data.timeframes['1hr'].avgBlockSize.map(size => size / 1024),
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#ef4444', size: 6 },
                    line: { color: '#ef4444', width: 4 },
                    name: '1hr avg'
                  }] : [])
                ]}
                layout={{
                  ...plotLayout,
                  title: { text: 'Block Size Over Time', font: { color: ritualColors.text, size: 16 } },
                  xaxis: { 
                    ...plotLayout.xaxis, 
                    title: 'Time',
                    type: 'date',
                    tickformat: '%H:%M:%S'
                  },
                  yaxis: { ...plotLayout.yaxis, title: 'Size (KB)' }
                }}
                config={plotConfig}
                className="w-full h-full"
                useResizeHandler={true}
              />
            </div>
          </div>

          {/* Gas Efficiency */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 overflow-hidden">
            <h3 className="text-xl font-semibold text-white mb-4">Gas Efficiency Over Time</h3>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPerBlock(!showPerBlock)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    showPerBlock 
                      ? 'bg-lime-500/20 text-lime-300 border-lime-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  Per Block
                </button>
                <button
                  onClick={() => setShow5min(!show5min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show5min 
                      ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  5min avg
                </button>
                <button
                  onClick={() => setShow30min(!show30min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show30min 
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  30min avg
                </button>
                <button
                  onClick={() => setShow1hr(!show1hr)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show1hr 
                      ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  1hr avg
                </button>
              </div>
            </div>
            <div className="w-full h-80 min-h-0">
              <Plot
                data={[
                  // Original per-block data
                  ...(showPerBlock ? [{
                    x: data.timestamps,
                    y: data.gasEfficiency,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#EC4899', width: 2 },
                    name: 'Per Block'
                  }] : []),
                  // 5-minute aggregation
                  ...(show5min && data.timeframes ? [{
                    x: data.timeframes['5min'].timestamps,
                    y: data.timeframes['5min'].gasEfficiency,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#22c55e', size: 4 },
                    line: { color: '#22c55e', width: 2 },
                    name: '5min avg'
                  }] : []),
                  // 30-minute aggregation
                  ...(show30min && data.timeframes ? [{
                    x: data.timeframes['30min'].timestamps,
                    y: data.timeframes['30min'].gasEfficiency,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#f59e0b', size: 5 },
                    line: { color: '#f59e0b', width: 3 },
                    name: '30min avg'
                  }] : []),
                  // 1-hour aggregation
                  ...(show1hr && data.timeframes ? [{
                    x: data.timeframes['1hr'].timestamps,
                    y: data.timeframes['1hr'].gasEfficiency,
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#ef4444', size: 6 },
                    line: { color: '#ef4444', width: 4 },
                    name: '1hr avg'
                  }] : [])
                ]}
                layout={{
                  ...plotLayout,
                  title: { text: 'Gas Usage Efficiency Over Time', font: { color: ritualColors.text, size: 16 } },
                  xaxis: { 
                    ...plotLayout.xaxis, 
                    title: 'Time',
                    type: 'date',
                    tickformat: '%H:%M:%S'
                  },
                  yaxis: { ...plotLayout.yaxis, title: 'Efficiency (%)' }
                }}
                config={plotConfig}
                className="w-full h-full"
                useResizeHandler={true}
              />
            </div>
          </div>

          {/* Block Size Velocity Chart */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 overflow-hidden">
            <h3 className="text-xl font-semibold text-white mb-4">Block Size Velocity (Bytes/Time)</h3>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPerBlock(!showPerBlock)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    showPerBlock 
                      ? 'bg-lime-500/20 text-lime-300 border-lime-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  Per Block
                </button>
                <button
                  onClick={() => setShow5min(!show5min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show5min 
                      ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  5min avg
                </button>
                <button
                  onClick={() => setShow30min(!show30min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show30min 
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  30min avg
                </button>
                <button
                  onClick={() => setShow1hr(!show1hr)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show1hr 
                      ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  1hr avg
                </button>
              </div>
            </div>
            <div className="w-full h-80 min-h-0">
              <Plot
                data={[
                  // Original per-block data - calculate velocity (bytes per second)
                  ...(showPerBlock ? [{
                    x: data.timestamps,
                    y: data.avgBlockSize.map((size, i) => {
                      const blockTime = data.blockTimes[i] || 12; // Default 12s if no time
                      return size / blockTime; // bytes per second
                    }),
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#8B5CF6', width: 2 },
                    name: 'Per Block'
                  }] : []),
                  // 5-minute aggregation
                  ...(show5min && data.timeframes ? [{
                    x: data.timeframes['5min'].timestamps,
                    y: data.timeframes['5min'].avgBlockSize.map(size => size / 300), // 5min = 300s
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#22c55e', size: 4 },
                    line: { color: '#22c55e', width: 2 },
                    name: '5min avg'
                  }] : []),
                  // 30-minute aggregation
                  ...(show30min && data.timeframes ? [{
                    x: data.timeframes['30min'].timestamps,
                    y: data.timeframes['30min'].avgBlockSize.map(size => size / 1800), // 30min = 1800s
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#f59e0b', size: 5 },
                    line: { color: '#f59e0b', width: 3 },
                    name: '30min avg'
                  }] : []),
                  // 1-hour aggregation
                  ...(show1hr && data.timeframes ? [{
                    x: data.timeframes['1hr'].timestamps,
                    y: data.timeframes['1hr'].avgBlockSize.map(size => size / 3600), // 1hr = 3600s
                    type: 'scatter',
                    mode: 'lines+markers',
                    marker: { color: '#ef4444', size: 6 },
                    line: { color: '#ef4444', width: 4 },
                    name: '1hr avg'
                  }] : [])
                ]}
                layout={{
                  ...plotLayout,
                  title: { text: 'Block Size Velocity Over Time', font: { color: ritualColors.text, size: 16 } },
                  xaxis: { 
                    ...plotLayout.xaxis, 
                    title: 'Time',
                    type: 'date',
                    tickformat: '%H:%M:%S'
                  },
                  yaxis: { ...plotLayout.yaxis, title: 'Bytes/Second' }
                }}
                config={plotConfig}
                className="w-full h-full"
                useResizeHandler={true}
              />
            </div>
          </div>
        </div>



        {/* Pearson Correlation Matrices */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-6">Time Series Correlation Analysis</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Per Block Correlation */}
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 overflow-hidden">
              <h3 className="text-lg font-semibold text-white mb-4">Per Block Correlations</h3>
              <div className="w-full h-80 min-h-0">
                <Plot
                  data={[{
                    z: perBlockCorrelation.length > 0 ? perBlockCorrelation : [
                      [1.00, 0.00, 0.00, 0.00, 0.00],
                      [0.00, 1.00, 0.00, 0.00, 0.00],
                      [0.00, 0.00, 1.00, 0.00, 0.00],
                      [0.00, 0.00, 0.00, 1.00, 0.00],
                      [0.00, 0.00, 0.00, 0.00, 1.00]
                    ],
                    x: ['Gas Used', 'Transactions', 'Block Size', 'Gas Efficiency', 'Block Time'],
                    y: ['Gas Used', 'Transactions', 'Block Size', 'Gas Efficiency', 'Block Time'],
                    type: 'heatmap',
                    colorscale: 'RdYlBu',
                    reversescale: true,
                    zmin: -1,
                    zmax: 1,
                    showscale: true,
                    texttemplate: '%{z:.2f}',
                    textfont: { color: 'white' }
                  }]}
                  layout={{
                    ...plotLayout,
                    title: { text: 'Per Block Correlation Matrix', font: { color: ritualColors.text, size: 14 } },
                    xaxis: { 
                      ...plotLayout.xaxis, 
                      tickangle: -45,
                      tickfont: { size: 10 }
                    },
                    yaxis: { 
                      ...plotLayout.yaxis,
                      tickfont: { size: 10 }
                    }
                  }}
                  config={plotConfig}
                  className="w-full h-full"
                  useResizeHandler={true}
                />
              </div>
            </div>

            {/* 5min Correlation */}
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-green-500/30 overflow-hidden">
              <h3 className="text-lg font-semibold text-white mb-4">5-Minute Correlations</h3>
              <div className="w-full h-80 min-h-0">
                <Plot
                  data={[{
                    z: fiveMinCorrelation.length > 0 ? fiveMinCorrelation : [
                      [1.00, 0.00, 0.00, 0.00, 0.00],
                      [0.00, 1.00, 0.00, 0.00, 0.00],
                      [0.00, 0.00, 1.00, 0.00, 0.00],
                      [0.00, 0.00, 0.00, 1.00, 0.00],
                      [0.00, 0.00, 0.00, 0.00, 1.00]
                    ],
                    x: ['Gas Used', 'Transactions', 'Block Size', 'Gas Efficiency', 'Block Time'],
                    y: ['Gas Used', 'Transactions', 'Block Size', 'Gas Efficiency', 'Block Time'],
                    type: 'heatmap',
                    colorscale: 'RdYlBu',
                    reversescale: true,
                    zmin: -1,
                    zmax: 1,
                    showscale: true,
                    texttemplate: '%{z:.2f}',
                    textfont: { color: 'white' }
                  }]}
                  layout={{
                    ...plotLayout,
                    title: { text: '5-Minute Correlation Matrix', font: { color: ritualColors.text, size: 14 } },
                    xaxis: { 
                      ...plotLayout.xaxis, 
                      tickangle: -45,
                      tickfont: { size: 10 }
                    },
                    yaxis: { 
                      ...plotLayout.yaxis,
                      tickfont: { size: 10 }
                    }
                  }}
                  config={plotConfig}
                  className="w-full h-full"
                  useResizeHandler={true}
                />
              </div>
            </div>

            {/* 1hr Correlation */}
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-red-500/30 overflow-hidden">
              <h3 className="text-lg font-semibold text-white mb-4">1-Hour Correlations</h3>
              <div className="w-full h-80 min-h-0">
                <Plot
                  data={[{
                    z: oneHourCorrelation.length > 0 ? oneHourCorrelation : [
                      [1.00, 0.00, 0.00, 0.00, 0.00],
                      [0.00, 1.00, 0.00, 0.00, 0.00],
                      [0.00, 0.00, 1.00, 0.00, 0.00],
                      [0.00, 0.00, 0.00, 1.00, 0.00],
                      [0.00, 0.00, 0.00, 0.00, 1.00]
                    ],
                    x: ['Gas Used', 'Transactions', 'Block Size', 'Gas Efficiency', 'Block Time'],
                    y: ['Gas Used', 'Transactions', 'Block Size', 'Gas Efficiency', 'Block Time'],
                    type: 'heatmap',
                    colorscale: 'RdYlBu',
                    reversescale: true,
                    zmin: -1,
                    zmax: 1,
                    showscale: true,
                    texttemplate: '%{z:.2f}',
                    textfont: { color: 'white' }
                  }]}
                  layout={{
                    ...plotLayout,
                    title: { text: '1-Hour Correlation Matrix', font: { color: ritualColors.text, size: 14 } },
                    xaxis: { 
                      ...plotLayout.xaxis, 
                      tickangle: -45,
                      tickfont: { size: 10 }
                    },
                    yaxis: { 
                      ...plotLayout.yaxis,
                      tickfont: { size: 10 }
                    }
                  }}
                  config={plotConfig}
                  className="w-full h-full"
                  useResizeHandler={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Block Times Chart */}
        {data.blockTimes.length > 0 && (
          <div className="mt-8 bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-lime-500/30 overflow-hidden">
            <h3 className="text-xl font-semibold text-white mb-4">Block Time Distribution</h3>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPerBlock(!showPerBlock)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    showPerBlock 
                      ? 'bg-lime-500/20 text-lime-300 border-lime-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  Per Block
                </button>
                <button
                  onClick={() => setShow5min(!show5min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show5min 
                      ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  5min avg
                </button>
                <button
                  onClick={() => setShow30min(!show30min)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show30min 
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  30min avg
                </button>
                <button
                  onClick={() => setShow1hr(!show1hr)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    show1hr 
                      ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  1hr avg
                </button>
              </div>
            </div>
            <div className="w-full h-80 min-h-0">
              <Plot
                data={[
                  {
                    x: data.blockTimes,
                    type: 'histogram',
                    marker: { color: ritualColors.primary, opacity: 0.7 },
                    name: 'Block Times'
                  }
                ]}
                layout={{
                  ...plotLayout,
                  title: { text: 'Block Time Distribution (seconds)', font: { color: ritualColors.text, size: 16 } },
                  xaxis: { ...plotLayout.xaxis, title: 'Block Time (seconds)' },
                  yaxis: { ...plotLayout.yaxis, title: 'Frequency' }
                }}
                config={plotConfig}
                className="w-full h-full"
                useResizeHandler={true}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
