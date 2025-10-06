'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { rethClient } from '@/lib/reth-client'
import { getRealtimeManager } from '@/lib/realtime-websocket'

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface SearchSuggestion {
  type: 'transaction' | 'block' | 'address' | 'recent' | 'callId' | 'precompile' | 'originTx' | 'validator' | 'peer'
  value: string
  label: string
  description?: string
  metadata?: any
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [searching, setSearching] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const debouncedQuery = useDebounce(query, 400) // 400ms debounce

  // Recent searches from localStorage
  const getRecentSearches = (): SearchSuggestion[] => {
    if (typeof window === 'undefined') return []
    const recent = localStorage.getItem('ritual-recent-searches')
    if (!recent) return []
    try {
      return JSON.parse(recent).map((item: any) => ({
        ...item,
        type: 'recent' as const
      }))
    } catch {
      return []
    }
  }

  const addToRecentSearches = (suggestion: SearchSuggestion) => {
    if (typeof window === 'undefined') return
    const recent = getRecentSearches().filter(item => item.value !== suggestion.value)
    recent.unshift({ ...suggestion, type: suggestion.type })
    const limited = recent.slice(0, 5) // Keep only 5 recent searches
    localStorage.setItem('ritual-recent-searches', JSON.stringify(limited))
  }

  // Fetch preview data for valid inputs
  const fetchPreviewData = useCallback(async (input: string) => {
    if (!input.trim()) return

    setLoadingPreview(true)
    
    try {
      // Full transaction hash - fetch tx data
      if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
        try {
          const tx = await rethClient.getTransaction(input)
          if (tx) {
            setSuggestions(prev => prev.map(s => 
              s.value === input && s.type === 'transaction'
                ? { ...s, metadata: { 
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    blockNumber: tx.blockNumber
                  }}
                : s
            ))
          }
        } catch (err) {
          // Transaction not found, no preview
        }
      }
      
      // Full address - fetch balance
      if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
        try {
          const balanceHex = await rethClient.rpcCall('eth_getBalance', [input, 'latest'])
          const balance = (parseInt(balanceHex, 16) / 1e18).toFixed(4)
          setSuggestions(prev => prev.map(s => 
            s.value === input && (s.type === 'address' || s.type === 'validator')
              ? { ...s, metadata: { balance }}
              : s
          ))
        } catch (err) {
          // Can't fetch balance
        }
      }
      
      // Block number - fetch block data
      if (/^\d+$/.test(input)) {
        const blockNum = parseInt(input)
        if (blockNum >= 0) {
          try {
            const block = await rethClient.getBlock(blockNum)
            if (block) {
              setSuggestions(prev => prev.map(s => 
                s.value === input && s.type === 'block'
                  ? { ...s, metadata: {
                      timestamp: block.timestamp,
                      transactions: block.transactions?.length || 0,
                      miner: block.miner
                    }}
                  : s
              ))
            }
          } catch (err) {
            // Block not found
          }
        }
      }
    } catch (error) {
      console.error('Preview fetch error:', error)
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  // Fetch preview data when debounced query changes
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.trim()) {
      fetchPreviewData(debouncedQuery)
    }
  }, [debouncedQuery, fetchPreviewData])

  // Fuzzy/partial hash matching - search cached blocks for matching transaction hashes
  const searchPartialHash = useCallback((partialHash: string): SearchSuggestion[] => {
    if (!/^0x[a-fA-F0-9]{6,63}$/.test(partialHash)) return []
    
    const matches: SearchSuggestion[] = []
    const manager = getRealtimeManager()
    const cachedBlocks = manager?.getCachedBlocks() || []
    
    const lowerPartial = partialHash.toLowerCase()
    
    // Search through cached blocks for matching transaction hashes
    for (const block of cachedBlocks) {
      if (matches.length >= 5) break // Limit to 5 matches
      
      const transactions = block.transactions || []
      for (const tx of transactions) {
        const txHash = typeof tx === 'string' ? tx : tx.hash
        if (txHash && txHash.toLowerCase().startsWith(lowerPartial)) {
          matches.push({
            type: 'transaction',
            value: txHash,
            label: 'Transaction (Match)',
            description: `Found in block #${parseInt(block.number, 16)} - Click to view`,
            metadata: typeof tx === 'object' ? {
              from: tx.from,
              to: tx.to,
              blockNumber: block.number
            } : undefined
          })
          if (matches.length >= 5) break
        }
      }
    }
    
    return matches
  }, [])

  // Enhanced detectQueryType with fuzzy matching
  const detectQueryTypeEnhanced = useCallback((input: string): SearchSuggestion[] => {
    const basicSuggestions = detectQueryType(input)
    
    // Add fuzzy matches for partial hashes (6-63 chars)
    if (/^0x[a-fA-F0-9]{6,63}$/.test(input.trim())) {
      const fuzzyMatches = searchPartialHash(input.trim())
      if (fuzzyMatches.length > 0) {
        // Replace or augment the "partial" suggestion with actual matches
        return [
          ...fuzzyMatches,
          ...basicSuggestions.filter(s => s.label !== 'Transaction (partial)')
        ]
      }
    }
    
    return basicSuggestions
  }, [searchPartialHash])

  const detectQueryType = (input: string): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = []
    const cleanInput = input.trim()

    if (!cleanInput) {
      return getRecentSearches()
    }

    // Transaction hash (0x + 64 hex chars)
    if (/^0x[a-fA-F0-9]{64}$/.test(cleanInput)) {
      suggestions.push({
        type: 'transaction',
        value: cleanInput,
        label: 'Transaction',
        description: `View transaction details`
      })
    }

    // Partial transaction hash
    if (/^0x[a-fA-F0-9]{6,63}$/.test(cleanInput)) {
      suggestions.push({
        type: 'transaction',
        value: cleanInput,
        label: 'Transaction (partial)',
        description: 'Complete the hash to search'
      })
    }

    // Address (0x + 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/.test(cleanInput)) {
      suggestions.push({
        type: 'address',
        value: cleanInput,
        label: 'Address',
        description: 'View address details and transactions'
      })
    }

    // Partial address
    if (/^0x[a-fA-F0-9]{6,39}$/.test(cleanInput)) {
      suggestions.push({
        type: 'address',
        value: cleanInput,
        label: 'Address (partial)',
        description: 'Complete the address to search'
      })
    }

    // Block number (numeric)
    if (/^\d+$/.test(cleanInput)) {
      const blockNum = parseInt(cleanInput)
      if (blockNum >= 0) {
        suggestions.push({
          type: 'block',
          value: cleanInput,
          label: `Block #${blockNum.toLocaleString()}`,
          description: 'View block details and transactions'
        })
      }
    }

    // ENS name (.eth)
    if (/^[a-zA-Z0-9.-]+\.eth$/.test(cleanInput)) {
      suggestions.push({
        type: 'address',
        value: cleanInput,
        label: 'ENS Name',
        description: 'Resolve ENS name to address'
      })
    }

    // RITUAL CHAIN SPECIFIC SEARCHES

    // Call ID (for scheduled transactions)
    if (/^callid:(\d+)$/i.test(cleanInput)) {
      const callId = cleanInput.match(/^callid:(\d+)$/i)?.[1]
      if (callId) {
        suggestions.push({
          type: 'callId',
          value: callId,
          label: `Scheduled Job #${callId}`,
          description: 'View scheduled transaction executions'
        })
      }
    }

    // Origin Transaction (originTx:hash)
    if (/^origin:0x[a-fA-F0-9]{64}$/i.test(cleanInput)) {
      const hash = cleanInput.replace(/^origin:/i, '')
      suggestions.push({
        type: 'originTx',
        value: hash,
        label: 'Origin Transaction',
        description: 'Find transactions related to this origin'
      })
    }

    // Precompile addresses (system precompiles)
    if (/^0x0+[0-9a-fA-F]{1,3}$/.test(cleanInput)) {
      suggestions.push({
        type: 'precompile',
        value: cleanInput,
        label: 'Precompile Contract',
        description: 'View precompile contract interactions'
      })
    }

    // System accounts detection
    if (cleanInput.toLowerCase().includes('fa7e') || 
        cleanInput.toLowerCase().includes('fa8e') || 
        cleanInput.toLowerCase().includes('fa9e')) {
      suggestions.push({
        type: 'address',
        value: cleanInput,
        label: 'System Account',
        description: 'Ritual Chain system account'
      })
    }

    // Numeric Call ID without prefix
    if (/^\d{4,}$/.test(cleanInput)) {
      const callId = parseInt(cleanInput)
      if (callId > 1000) { // Likely a call ID
        suggestions.push({
          type: 'callId',
          value: cleanInput,
          label: `Call ID ${callId}`,
          description: 'Search for scheduled transactions with this Call ID'
        })
      }
    }

    // Validator search (validator:address or v:address)
    if (/^(validator|v):0x[a-fA-F0-9]{40}$/i.test(cleanInput)) {
      const address = cleanInput.replace(/^(validator|v):/i, '')
      suggestions.push({
        type: 'validator',
        value: address,
        label: 'Validator',
        description: 'View validator details, blocks proposed, and location'
      })
    }

    // Peer/IP search (peer:ip or p:ip)
    if (/^(peer|p):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.test(cleanInput)) {
      const ip = cleanInput.replace(/^(peer|p):/i, '')
      suggestions.push({
        type: 'peer',
        value: ip,
        label: 'Peer Node',
        description: 'View peer connection details and geographic location'
      })
    }

    // IP address detection (xxx.xxx.xxx.xxx)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanInput)) {
      const parts = cleanInput.split('.').map(p => parseInt(p))
      // Validate IP range
      if (parts.every(p => p >= 0 && p <= 255)) {
        suggestions.push({
          type: 'peer',
          value: cleanInput,
          label: 'Peer IP Address',
          description: 'Search for validator peer by IP address'
        })
      }
    }

    return suggestions
  }

  const handleInputChange = (value: string) => {
    setQuery(value)
    setErrorMessage(null) // Clear error when user types
    const newSuggestions = detectQueryTypeEnhanced(value)
    setSuggestions(newSuggestions)
    setShowSuggestions(true)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev === suggestions.length - 1 ? 0 : prev + 1
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev <= 0 ? suggestions.length - 1 : prev - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          performSearch(suggestions[selectedIndex])
        } else if (suggestions.length > 0) {
          performSearch(suggestions[0])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const performSearch = async (suggestion: SearchSuggestion) => {
    if (!suggestion || searching) return

    setSearching(true)
    setShowSuggestions(false)
    setErrorMessage(null)
    
    try {
      switch (suggestion.type) {
        case 'transaction':
          if (!/^0x[a-fA-F0-9]{64}$/.test(suggestion.value)) {
            setErrorMessage('⚠️ Invalid transaction hash. Must be 66 characters (0x + 64 hex)')
            setSearching(false)
            return
          }
          // Verify transaction exists
          try {
            await rethClient.getTransaction(suggestion.value)
            addToRecentSearches(suggestion)
            router.push(`/tx/${suggestion.value}`)
          } catch (err) {
            setErrorMessage(`❌ Transaction not found: ${suggestion.value.slice(0, 10)}...${suggestion.value.slice(-8)}`)
            setSearching(false)
            return
          }
          break
          
        case 'block':
          const blockNum = parseInt(suggestion.value)
          if (isNaN(blockNum) || blockNum < 0) {
            setErrorMessage('⚠️ Invalid block number. Must be a positive integer')
            setSearching(false)
            return
          }
          // Verify block exists
          try {
            await rethClient.getBlock(blockNum)
            addToRecentSearches(suggestion)
            router.push(`/block/${suggestion.value}`)
          } catch (err) {
            setErrorMessage(`❌ Block #${blockNum} not found. Latest block may be lower.`)
            setSearching(false)
            return
          }
          break
          
        case 'address':
          if (!/^0x[a-fA-F0-9]{40}$/.test(suggestion.value)) {
            if (suggestion.value.endsWith('.eth')) {
              setErrorMessage('🔄 ENS resolution coming soon! Please use the raw address (0x...)')
              setSearching(false)
              return
            }
            setErrorMessage('⚠️ Invalid address. Must be 42 characters (0x + 40 hex)')
            setSearching(false)
            return
          }
          addToRecentSearches(suggestion)
          router.push(`/address/${suggestion.value}`)
          break
          
        case 'recent':
          // Re-perform the recent search
          performSearch({ ...suggestion, type: suggestion.type as any })
          return
          
        case 'callId':
          addToRecentSearches(suggestion)
          router.push(`/scheduled?callId=${suggestion.value}`)
          break
          
        case 'precompile':
          addToRecentSearches(suggestion)
          router.push(`/address/${suggestion.value}`)
          break
          
        case 'originTx':
          addToRecentSearches(suggestion)
          router.push(`/tx/${suggestion.value}`)
          break
          
        case 'validator':
          addToRecentSearches(suggestion)
          router.push(`/validators?address=${suggestion.value}`)
          break
          
        case 'peer':
          addToRecentSearches(suggestion)
          router.push(`/validators?ip=${suggestion.value}`)
          break
      }
      
      setQuery('')
    } catch (error) {
      console.error('Search error:', error)
      setErrorMessage('❌ An unexpected error occurred. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    // Keyboard shortcut: Press '/' to focus search
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      // Focus search on '/' key (but not in input fields)
      if (event.key === '/' && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault()
        inputRef.current?.focus()
      }
      
      // Global ESC to blur search
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
        setQuery('')
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyboardShortcut)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyboardShortcut)
    }
  }, [])

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query || getRecentSearches().length > 0) {
              setShowSuggestions(true)
            }
          }}
          placeholder="Search: Address, Hash, Block, Call ID, Validator, IP... (Press / to focus)"
          className="w-full pl-10 pr-4 py-3 bg-black/50 border border-lime-500/30 rounded-lg text-white placeholder-lime-300/60 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 backdrop-blur-sm"
          disabled={searching}
        />
        {searching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lime-400"></div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-start space-x-2">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-red-400 hover:text-red-200"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-black/95 backdrop-blur-sm border border-lime-500/30 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.value}-${index}`}
              className={`px-4 py-3 cursor-pointer border-b border-lime-500/10 last:border-b-0 ${
                index === selectedIndex
                  ? 'bg-lime-500/20'
                  : 'hover:bg-lime-500/10'
              }`}
              onClick={() => performSearch(suggestion)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      suggestion.type === 'transaction' ? 'bg-lime-800/30 text-lime-300' :
                      suggestion.type === 'block' ? 'bg-white/20 text-white' :
                      suggestion.type === 'address' ? 'bg-lime-600/30 text-lime-200' :
                      suggestion.type === 'callId' ? 'bg-purple-800/30 text-purple-300' :
                      suggestion.type === 'precompile' ? 'bg-orange-800/30 text-orange-300' :
                      suggestion.type === 'originTx' ? 'bg-blue-800/30 text-blue-300' :
                      suggestion.type === 'validator' ? 'bg-green-800/30 text-green-300' :
                      suggestion.type === 'peer' ? 'bg-cyan-800/30 text-cyan-300' :
                      'bg-gray-800/30 text-gray-300'
                    }`}>
                      {suggestion.type === 'recent' ? '📅' : 
                       suggestion.type === 'transaction' ? '📜' :
                       suggestion.type === 'block' ? '⏹️' :
                       suggestion.type === 'callId' ? '🔄' :
                       suggestion.type === 'precompile' ? '⚙️' :
                       suggestion.type === 'originTx' ? '🔗' :
                       suggestion.type === 'validator' ? '🏛️' :
                       suggestion.type === 'peer' ? '🌐' : '👤'}
                      {suggestion.label}
                    </span>
                    <span className="text-white font-mono text-sm truncate">
                      {suggestion.value}
                    </span>
                  </div>
                  {suggestion.description && (
                    <p className="text-lime-300/80 text-xs mt-1">
                      {suggestion.description}
                    </p>
                  )}
                  {/* Preview metadata */}
                  {suggestion.metadata && (
                    <div className="mt-2 pt-2 border-t border-lime-500/10">
                      {suggestion.type === 'transaction' && suggestion.metadata.blockNumber && (
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="text-lime-300/60">From:</span>
                            <span className="text-white/80 font-mono text-[10px]">{suggestion.metadata.from?.slice(0, 8)}...{suggestion.metadata.from?.slice(-6)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lime-300/60">To:</span>
                            <span className="text-white/80 font-mono text-[10px]">{suggestion.metadata.to?.slice(0, 8)}...{suggestion.metadata.to?.slice(-6)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lime-300/60">Block:</span>
                            <span className="text-white/80">#{parseInt(suggestion.metadata.blockNumber, 16)}</span>
                          </div>
                        </div>
                      )}
                      {(suggestion.type === 'address' || suggestion.type === 'validator') && suggestion.metadata.balance !== undefined && (
                        <div className="text-xs">
                          <span className="text-lime-300/60">Balance: </span>
                          <span className="text-white/80 font-mono">{(parseInt(suggestion.metadata.balance, 16) / 1e18).toFixed(4)} ETH</span>
                        </div>
                      )}
                      {suggestion.type === 'block' && suggestion.metadata.timestamp && (
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="text-lime-300/60">Transactions:</span>
                            <span className="text-white/80">{suggestion.metadata.transactions}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lime-300/60">Miner:</span>
                            <span className="text-white/80 font-mono text-[10px]">{suggestion.metadata.miner?.slice(0, 8)}...{suggestion.metadata.miner?.slice(-6)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lime-300/60">Time:</span>
                            <span className="text-white/80">{new Date(parseInt(suggestion.metadata.timestamp, 16) * 1000).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {loadingPreview && !suggestion.metadata && (
                    <div className="mt-2 pt-2 border-t border-lime-500/10">
                      <div className="flex items-center space-x-2 text-xs text-lime-300/60">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-lime-400"></div>
                        <span>Loading preview...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-lime-400 text-xs flex-shrink-0">
                  Press Enter
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
