'use client'

import { useState, useEffect } from 'react'
import { rethClient, RpcConfig } from '@/lib/reth-client'
import { getRealtimeManager } from '@/lib/realtime-websocket'
import { Navigation } from '@/components/Navigation'
import Link from 'next/link'
import { useParticleBackground } from '@/hooks/useParticleBackground'

interface ConnectionTest {
  success: boolean
  latency?: number
  blockNumber?: number
  error?: string
}

export default function SettingsPage() {
  useParticleBackground()
  const [config, setConfig] = useState<RpcConfig>({ primary: '', backup: '', websocket: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, ConnectionTest>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)
  const [presets] = useState<RpcConfig[]>([
    {
      name: 'Default Shrinenet',
      primary: 'http://35.185.40.237:8545',
      backup: 'http://130.211.246.58:8545',
      websocket: 'ws://35.185.40.237:8546'
    },
    {
      name: 'Shrinenet Backup',
      primary: 'http://130.211.246.58:8545',
      backup: 'http://35.185.40.237:8545',
      websocket: 'ws://130.211.246.58:8546'
    }
  ])

  useEffect(() => {
    // Check if we just reloaded after RPC change (config in sessionStorage)
    const savedConfig = sessionStorage.getItem('ritual-scan-new-rpc-config')
    if (savedConfig) {
      try {
        const restoredConfig = JSON.parse(savedConfig)
        console.log('🔄 Restoring RPC config after cache clear:', restoredConfig)
        rethClient.updateConfiguration(restoredConfig)
        setConfig(restoredConfig)
        // Clear the temp storage
        sessionStorage.removeItem('ritual-scan-new-rpc-config')
        console.log('✅ RPC config restored and applied')
      } catch (e) {
        console.warn('Failed to restore config:', e)
      }
    } else {
      // Normal load - get current config
      const currentConfig = rethClient.getConfiguration()
      setConfig(currentConfig)
    }

    const unsubscribe = rethClient.onConfigurationChange((newConfig) => {
      setConfig(newConfig)
    })

    return unsubscribe
  }, [])

  const testConnection = async (url: string, type: 'primary' | 'backup' | 'websocket') => {
    if (!url) return
    
    setTesting(prev => ({ ...prev, [type]: true }))
    
    try {
      const result = await rethClient.testConnection(url)
      setTestResults(prev => ({ ...prev, [type]: result }))
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [type]: { success: false, error: 'Test failed' }
      }))
    } finally {
      setTesting(prev => ({ ...prev, [type]: false }))
    }
  }

  const saveConfiguration = async () => {
    setLoading(true)
    try {
      // Get old configuration before updating
      const oldConfig = rethClient.getConfiguration()
      
      // Check if RPC URLs changed
      const rpcChanged = 
        oldConfig.primary !== config.primary ||
        oldConfig.websocket !== config.websocket ||
        oldConfig.backup !== config.backup
      
      // Update configuration
      rethClient.updateConfiguration(config)
      
      // If RPC changed, clear all caches (switching to different chain)
      if (rpcChanged) {
        console.log('🔄 RPC configuration changed - PURGING ALL CACHES...')
        
        // Step 1: SAVE new config to sessionStorage (survives localStorage.clear)
        sessionStorage.setItem('ritual-scan-new-rpc-config', JSON.stringify(config))
        console.log('  ✓ Saved new RPC config to sessionStorage')
        
        // Step 2: Disconnect and destroy WebSocket manager
        const manager = getRealtimeManager()
        if (manager) {
          manager.disconnect()
          console.log('  ✓ Disconnected WebSocket')
        }
        
        // Step 3: Delete singleton instance (critical!)
        if (typeof window !== 'undefined') {
          if ((window as any).__realtimeManager) {
            delete (window as any).__realtimeManager
            console.log('  ✓ Deleted singleton')
          }
        }
        
        // Step 4: NUKE ALL localStorage (cache data gone, but config saved in session)
        try {
          localStorage.clear()
          console.log('  ✓ Cleared ALL localStorage')
        } catch (e) {
          console.warn('  ⚠️ Could not clear localStorage:', e)
        }
        
        // Step 5: Clear Next.js service worker caches
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => {
              caches.delete(name)
              console.log(`  ✓ Deleted cache: ${name}`)
            })
          })
        }
        
        // Step 6: HARD reload with cache bypass
        console.log('🔄 HARD RELOAD in 1 second...')
        console.log('💥 ALL CACHES NUKED - RPC config will be restored on load!')
        setTimeout(() => {
          // Hard reload bypassing cache
          window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now()
        }, 1000)
      }
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save configuration:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPreset = (preset: RpcConfig) => {
    setConfig(preset)
    setTestResults({})
  }

  const ConnectionStatus = ({ type }: { type: 'primary' | 'backup' | 'websocket' }) => {
    const result = testResults[type]
    const isTestingCurrent = testing[type]

    if (isTestingCurrent) {
      return (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-lime-400"></div>
          <span className="text-lime-300 text-sm">Testing...</span>
        </div>
      )
    }

    if (!result) return null

    const statusConfig = result.success 
      ? { color: 'green', icon: '✅', text: `Block ${result.blockNumber?.toLocaleString()} (${result.latency}ms)` }
      : { color: 'red', icon: '❌', text: result.error || 'Failed' }

    return (
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 bg-${statusConfig.color}-400 rounded-full`}></div>
        <span className={`text-${statusConfig.color}-300 text-sm`}>
          {statusConfig.icon} {statusConfig.text}
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation currentPage="settings" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-lime-400 mb-4">
            <Link href="/" className="hover:text-lime-200">Home</Link>
            <span>→</span>
            <span className="text-white">RPC Settings</span>
          </nav>
          
          <h1 className="text-3xl font-bold text-white">RPC Configuration</h1>
          <p className="text-lime-200 mt-2">
            Configure blockchain RPC endpoints for real-time data
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Current Configuration */}
          <div className="bg-black/20 backdrop-blur-sm shadow-lg overflow-hidden rounded-lg border border-lime-800/30">
            <div className="px-6 py-4 border-b border-lime-800/30">
              <h3 className="text-lg font-medium text-white">Current Configuration</h3>
              <p className="text-lime-300 text-sm">Active RPC endpoints</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Configuration Name */}
              <div>
                <label className="block text-sm font-medium text-lime-300 mb-2">
                  Configuration Name
                </label>
                <input
                  type="text"
                  value={config.name || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-lime-900/20 border border-lime-600/30 rounded-md text-white placeholder-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                  placeholder="My Custom RPC"
                />
              </div>

              {/* Primary RPC */}
              <div>
                <label className="block text-sm font-medium text-lime-300 mb-2">
                  Primary RPC URL
                </label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={config.primary}
                      onChange={(e) => setConfig(prev => ({ ...prev, primary: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-lime-900/20 border border-lime-600/30 rounded-md text-white placeholder-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      placeholder="http://127.0.0.1:8545"
                    />
                    <button
                      onClick={() => testConnection(config.primary, 'primary')}
                      disabled={!config.primary || testing.primary}
                      className="px-4 py-2 bg-lime-600 text-white rounded-md hover:bg-lime-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Test
                    </button>
                  </div>
                  <ConnectionStatus type="primary" />
                </div>
              </div>

              {/* Backup RPC */}
              <div>
                <label className="block text-sm font-medium text-lime-300 mb-2">
                  Backup RPC URL (Optional)
                </label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={config.backup || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, backup: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-lime-900/20 border border-lime-600/30 rounded-md text-white placeholder-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      placeholder="http://backup-node:8545"
                    />
                    <button
                      onClick={() => testConnection(config.backup || '', 'backup')}
                      disabled={!config.backup || testing.backup}
                      className="px-4 py-2 bg-lime-600 text-white rounded-md hover:bg-lime-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Test
                    </button>
                  </div>
                  <ConnectionStatus type="backup" />
                </div>
              </div>

              {/* WebSocket URL */}
              <div>
                <label className="block text-sm font-medium text-lime-300 mb-2">
                  WebSocket URL (Optional)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={config.websocket || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, websocket: e.target.value }))}
                    className="w-full px-3 py-2 bg-lime-900/20 border border-lime-600/30 rounded-md text-white placeholder-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                    placeholder="ws://127.0.0.1:8546"
                  />
                  <p className="text-lime-400 text-xs">Required for real-time updates</p>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex space-x-4">
                <button
                  onClick={saveConfiguration}
                  disabled={loading || !config.primary}
                  className="flex-1 px-4 py-2 bg-lime-600 text-white rounded-md hover:bg-lime-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
                {saved && (
                  <div className="flex items-center text-green-400">
                    <span className="text-sm">✅ Saved!</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="bg-black/20 backdrop-blur-sm shadow-lg overflow-hidden rounded-lg border border-lime-800/30">
            <div className="px-6 py-4 border-b border-lime-800/30">
              <h3 className="text-lg font-medium text-white">Configuration Presets</h3>
              <p className="text-lime-300 text-sm">Quick setup for common networks</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {presets.map((preset, index) => (
                  <div 
                    key={index}
                    className="p-4 bg-lime-900/10 border border-lime-700/30 rounded-lg hover:bg-lime-900/20 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-white">{preset.name}</h4>
                      <button
                        onClick={() => loadPreset(preset)}
                        className="px-3 py-1 text-xs bg-lime-600 text-white rounded hover:bg-lime-700 transition-colors"
                      >
                        Load
                      </button>
                    </div>
                    <div className="space-y-1 text-sm text-lime-300">
                      <div><span className="text-lime-400">Primary:</span> {preset.primary}</div>
                      {preset.backup && <div><span className="text-lime-400">Backup:</span> {preset.backup}</div>}
                      {preset.websocket && <div><span className="text-lime-400">WebSocket:</span> {preset.websocket}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-400 text-sm">⚠️</span>
                  <div className="text-yellow-300 text-sm">
                    <p className="font-medium">Important Notes:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Changes take effect immediately</li>
                      <li>• WebSocket connection will be re-established</li>
                      <li>• Test connections before saving</li>
                      <li>• Settings are saved in browser localStorage</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
