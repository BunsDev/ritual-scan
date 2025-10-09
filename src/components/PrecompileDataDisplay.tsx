'use client'

import { useState, useEffect } from 'react'
import { decodePrecompileInput, formatPrecompileData, PRECOMPILE_ADDRESSES } from '@/lib/precompile-decoder'
import Link from 'next/link'

// Copy to clipboard helper
const copyToClipboard = (text: string) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
  }
}

interface PrecompileDataDisplayProps {
  precompileAddress: string
  precompileInput: string
}

export function PrecompileDataDisplay({ precompileAddress, precompileInput }: PrecompileDataDisplayProps) {
  const [decodedData, setDecodedData] = useState<Record<string, any> | null>(null)
  const [precompileType, setPrecompileType] = useState<string>('Unknown')
  const [probability, setProbability] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setIsLoading(true)
      setError(null)

      if (!precompileInput || precompileInput === '0x' || precompileInput.length < 10) {
        setError('No precompile input data available')
        setIsLoading(false)
        return
      }

      // Decode the precompile input
      const result = decodePrecompileInput(precompileAddress, precompileInput)
      
      setProbability(result.probability)
      
      if (result.decoded) {
        const formatted = formatPrecompileData(result.type, result.decoded)
        setDecodedData(formatted)
        
        // Set precompile type name
        if (result.type === 'http_call') {
          setPrecompileType('HTTP Call Precompile')
        } else if (result.type === 'llm_call') {
          setPrecompileType('LLM Call Precompile')
        } else {
          setPrecompileType('Unknown Precompile')
        }
      } else {
        setError('Failed to decode precompile input')
      }
      
      setIsLoading(false)
    } catch (err: any) {
      console.error('Error decoding precompile data:', err)
      setError(err.message || 'Failed to decode precompile data')
      setIsLoading(false)
    }
  }, [precompileAddress, precompileInput])

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6">
        <div className="flex items-center space-x-3 text-lime-400 mb-4">
          <span className="w-4 h-4">🔧</span>
          <span className="text-sm font-medium">Decoding Precompile Input...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6">
        <div className="flex items-center space-x-3 text-lime-400 mb-4">
          <span className="w-4 h-4">🔧</span>
          <span className="text-sm font-medium">Precompile Input</span>
        </div>
        <div className="text-red-400 text-sm">{error}</div>
        <div className="mt-4">
          <div className="text-lime-400 text-sm mb-2">Raw Input (Hex):</div>
          <div className="bg-black/30 rounded p-3 font-mono text-xs text-white break-all">
            {precompileInput}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-lime-500/20 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3 text-lime-400">
          <span className="w-4 h-4">🔧</span>
          <span className="text-sm font-medium">Decoded Precompile Input</span>
        </div>
        {probability < 1.0 && (
          <div className="text-xs text-yellow-400">
            Confidence: {(probability * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {decodedData && (
        <div className="space-y-3">
          {Object.entries(decodedData).map(([key, value]) => (
            <div key={key} className="flex flex-col space-y-1">
              <div className="text-lime-400 text-sm font-medium">{key}:</div>
              <div className="relative group">
                <div className="text-white text-sm bg-black/30 rounded p-2 pr-12 break-all whitespace-pre-wrap font-mono">
                  {typeof value === 'string' && value.startsWith('0x') && value.length === 42 ? (
                    <Link href={`/address/${value}`} className="text-lime-300 hover:text-white">
                      {value}
                    </Link>
                  ) : (
                    String(value)
                  )}
                </div>
                {/* Copy button */}
                <button
                  onClick={() => copyToClipboard(String(value))}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-lime-500/20 hover:bg-lime-500/30 text-lime-300 px-2 py-1 rounded text-xs"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show precompile address */}
      <div className="mt-4 pt-4 border-t border-lime-500/10">
        <div className="flex items-center justify-between">
          <div className="text-lime-400 text-sm">Precompile Address:</div>
          <Link 
            href={`/address/${precompileAddress}`} 
            className="text-lime-300 hover:text-white font-mono text-sm"
          >
            {precompileAddress}
          </Link>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          {precompileAddress.toLowerCase() === PRECOMPILE_ADDRESSES.HTTP_CALL.toLowerCase() && (
            'This is the HTTP Call precompile for making external HTTP requests.'
          )}
          {precompileAddress.toLowerCase() === PRECOMPILE_ADDRESSES.LLM_CALL.toLowerCase() && (
            'This is the LLM Call precompile for making AI model inference requests.'
          )}
        </div>
      </div>
    </div>
  )
}
