/**
 * Precompile Input Decoder
 * 
 * Decodes async precompile inputs from raw bytes to human-readable structures.
 * Based on the encoding logic in ritual-common-internal (Python).
 */

import { ethers } from 'ethers'
import { defaultAbiCoder, toUtf8String } from 'ethers/lib/utils'

// Precompile addresses
export const PRECOMPILE_ADDRESSES = {
  HTTP_CALL: '0x0000000000000000000000000000000000000801',
  LLM_CALL: '0x0000000000000000000000000000000000000802',
} as const

// HTTP Methods enum matching Python
export enum HTTPMethod {
  GET = 1,
  POST = 2,
  PUT = 3,
  DELETE = 4,
  PATCH = 5,
  HEAD = 6,
  OPTIONS = 7,
}

export function getHTTPMethodName(value: number): string {
  switch (value) {
    case HTTPMethod.GET: return 'GET'
    case HTTPMethod.POST: return 'POST'
    case HTTPMethod.PUT: return 'PUT'
    case HTTPMethod.DELETE: return 'DELETE'
    case HTTPMethod.PATCH: return 'PATCH'
    case HTTPMethod.HEAD: return 'HEAD'
    case HTTPMethod.OPTIONS: return 'OPTIONS'
    default: return `UNKNOWN(${value})`
  }
}

// Base ExecutorRequest fields
export interface ExecutorRequest {
  executor: string
  encrypted_secrets: string
  ttl: bigint
}

// HTTPCallRequest structure
export interface HTTPCallRequest extends ExecutorRequest {
  url: string
  method: HTTPMethod
  headers: Record<string, string>
  body: string | null
}

// LLMCallRequest structure (simplified - only showing key fields)
export interface LLMCallRequest extends ExecutorRequest {
  messages: any[]
  model: string
  temperature: number
  max_completion_tokens: number | null
  frequency_penalty: number
  presence_penalty: number
  n: number
  // ... other fields omitted for brevity
}

/**
 * Decode HTTPCallRequest from ABI-encoded bytes
 * 
 * ABI structure: ["address", "bytes", "uint256", "string", "uint8", "string[]", "string[]", "bytes"]
 */
export function decodeHTTPCallRequest(data: string): HTTPCallRequest | null {
  try {
    // Remove 0x prefix if present
    const cleanData = data.startsWith('0x') ? data : `0x${data}`
    
    // ABI types for HTTPCallRequest
    const types = [
      'address',      // executor
      'bytes',        // encrypted_secrets
      'uint256',      // ttl
      'string',       // url
      'uint8',        // method
      'string[]',     // headers_keys
      'string[]',     // headers_values
      'bytes'         // body
    ]
    
    const decoded = defaultAbiCoder.decode(types, cleanData)
    
    // Reconstruct headers from parallel arrays
    const headers: Record<string, string> = {}
    const headerKeys = decoded[5] as string[]
    const headerValues = decoded[6] as string[]
    
    for (let i = 0; i < headerKeys.length; i++) {
      headers[headerKeys[i]] = headerValues[i]
    }
    
    // Decode body if present
    let body: string | null = null
    const bodyBytes = decoded[7] as string
    if (bodyBytes && bodyBytes !== '0x' && bodyBytes.length > 2) {
      try {
        // Try to decode as UTF-8 string
        body = toUtf8String(bodyBytes)
      } catch {
        // If not valid UTF-8, keep as hex
        body = bodyBytes
      }
    }
    
    return {
      executor: decoded[0] as string,
      encrypted_secrets: decoded[1] as string,
      ttl: decoded[2] as bigint,
      url: decoded[3] as string,
      method: decoded[4] as HTTPMethod,
      headers,
      body
    }
  } catch (error) {
    console.error('Failed to decode HTTPCallRequest:', error)
    return null
  }
}

/**
 * Decode LLMCallRequest from ABI-encoded bytes (simplified version)
 * 
 * Full ABI has 25 fields - this decodes the most important ones
 */
export function decodeLLMCallRequest(data: string): Partial<LLMCallRequest> | null {
  try {
    // Remove 0x prefix if present
    const cleanData = data.startsWith('0x') ? data : `0x${data}`
    
    // ABI types for LLMCallRequest (first 12 fields)
    const types = [
      'address',      // executor
      'bytes',        // encrypted_secrets
      'uint256',      // ttl
      'string',       // messages_json
      'string',       // model
      'int256',       // frequency_penalty (as int)
      'string',       // logit_bias_json
      'bool',         // logprobs
      'int256',       // max_completion_tokens
      'string',       // metadata_json
      'string',       // modalities_json
      'uint256',      // n
    ]
    
    const decoded = defaultAbiCoder.decode(types, cleanData)
    
    // Parse JSON fields
    let messages: any[] = []
    try {
      const messagesJson = decoded[3] as string
      if (messagesJson) {
        messages = JSON.parse(messagesJson)
      }
    } catch {
      messages = []
    }
    
    // Convert fixed-point integers back to floats
    // The Python code multiplies by 1e18 before encoding
    const frequencyPenalty = Number(decoded[5] as bigint) / 1e18
    const maxCompletionTokens = decoded[8] as bigint
    
    return {
      executor: decoded[0] as string,
      encrypted_secrets: decoded[1] as string,
      ttl: decoded[2] as bigint,
      messages,
      model: decoded[4] as string,
      frequency_penalty: frequencyPenalty,
      max_completion_tokens: maxCompletionTokens > BigInt(0) ? Number(maxCompletionTokens) : null,
      n: Number(decoded[11] as bigint),
    }
  } catch (error) {
    console.error('Failed to decode LLMCallRequest:', error)
    return null
  }
}

/**
 * Identify precompile type from address and decode input
 */
export function decodePrecompileInput(precompileAddress: string, inputData: string): {
  type: 'http_call' | 'llm_call' | 'unknown'
  decoded: HTTPCallRequest | Partial<LLMCallRequest> | null
  probability: number
} {
  const normalizedAddress = precompileAddress.toLowerCase()
  
  if (normalizedAddress === PRECOMPILE_ADDRESSES.HTTP_CALL.toLowerCase()) {
    return {
      type: 'http_call',
      decoded: decodeHTTPCallRequest(inputData),
      probability: 1.0
    }
  } else if (normalizedAddress === PRECOMPILE_ADDRESSES.LLM_CALL.toLowerCase()) {
    return {
      type: 'llm_call',
      decoded: decodeLLMCallRequest(inputData),
      probability: 1.0
    }
  } else {
    // Unknown precompile - try both decoders and rank by probability
    const httpDecoded = decodeHTTPCallRequest(inputData)
    const llmDecoded = decodeLLMCallRequest(inputData)
    
    if (httpDecoded) {
      return {
        type: 'http_call',
        decoded: httpDecoded,
        probability: 0.7 // High probability if decoding succeeded
      }
    } else if (llmDecoded) {
      return {
        type: 'llm_call',
        decoded: llmDecoded,
        probability: 0.7
      }
    } else {
      return {
        type: 'unknown',
        decoded: null,
        probability: 0.0
      }
    }
  }
}

/**
 * Format decoded precompile data for display
 */
export function formatPrecompileData(
  type: 'http_call' | 'llm_call' | 'unknown',
  decoded: HTTPCallRequest | Partial<LLMCallRequest> | null
): Record<string, any> {
  if (!decoded) {
    return { error: 'Failed to decode precompile input' }
  }
  
  if (type === 'http_call') {
    const httpData = decoded as HTTPCallRequest
    
    // Try to prettify Body if it's JSON
    let bodyDisplay = 'None'
    if (httpData.body) {
      try {
        const parsed = JSON.parse(httpData.body)
        bodyDisplay = JSON.stringify(parsed, null, 2)
      } catch {
        // Not valid JSON, keep as-is
        bodyDisplay = httpData.body
      }
    }
    
    return {
      'Precompile Type': 'HTTP Call',
      'URL': httpData.url,
      'Method': getHTTPMethodName(httpData.method),
      'Headers': Object.entries(httpData.headers).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None',
      'Body': bodyDisplay,
      'Executor': httpData.executor,
      'TTL': httpData.ttl.toString() + ' blocks',
    }
  } else if (type === 'llm_call') {
    const llmData = decoded as Partial<LLMCallRequest>
    return {
      'Precompile Type': 'LLM Call',
      'Model': llmData.model || 'Unknown',
      'Messages': llmData.messages ? `${llmData.messages.length} messages` : 'None',
      'Max Tokens': llmData.max_completion_tokens?.toString() || 'Default',
      'Temperature': llmData.frequency_penalty?.toFixed(2) || 'Default',
      'Completions': llmData.n?.toString() || '1',
      'Executor': llmData.executor || 'Unknown',
      'TTL': llmData.ttl?.toString() + ' blocks' || 'Unknown',
    }
  }
  
  return { error: 'Unknown precompile type' }
}
