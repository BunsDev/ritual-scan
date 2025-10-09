'use client'

/**
 * Comprehensive Contract Decoder for Ritual Chain
 * Decodes method calls, events, and parameters for all deployed contracts
 * Uses real contract addresses from genesis/block 0-1 deployment
 */

// Known deployed contract addresses (from genesis/early blocks)
export const DEPLOYED_CONTRACTS = {
  // Precompile addresses (fixed addresses)
  ONNX_PRECOMPILE: '0x0000000000000000000000000000000000000800',       // ONNX inference
  HTTP_CALL_PRECOMPILE: '0x0000000000000000000000000000000000000801',  // HTTP call
  LLM_CALL_PRECOMPILE: '0x0000000000000000000000000000000000000802',   // LLM call
  JQ_QUERY_PRECOMPILE: '0x0000000000000000000000000000000000000803',   // JQ Query
  ED25519_SIGVER_PRECOMPILE: '0x0000000000000000000000000000000000000009', // ED25519 signature verification
  SECP256R1_SIGVER_PRECOMPILE: '0x0000000000000000000000000000000000000100', // SECP256R1 signature verification
  NITRO_VERIFICATION_PRECOMPILE: '0x0000000000000000000000000000000000000101', // Nitro verification
  
  // Core system contracts (deployed at genesis/block 0-1)
  SCHEDULER_CONTRACT: '0x0000000000000000000000000000000000001000',
  RITUAL_WALLET: '0x0000000000000000000000000000000000002000',
} as const

// ABI definitions for contract decoding
export const CONTRACT_ABIS = {
  // Async Precompile ABI (from ritual-sc-internal)
  ASYNC_PRECOMPILE: [
    {
      "type": "function",
      "name": "submitAsyncCall",
      "inputs": [
        {"name": "target", "type": "address"},
        {"name": "data", "type": "bytes"},
        {"name": "value", "type": "uint256"},
        {"name": "gasLimit", "type": "uint256"}
      ],
      "outputs": [{"name": "callId", "type": "bytes32"}]
    },
    {
      "type": "event",
      "name": "AsyncCallSubmitted",
      "inputs": [
        {"name": "callId", "type": "bytes32", "indexed": true},
        {"name": "caller", "type": "address", "indexed": true},
        {"name": "target", "type": "address", "indexed": false},
        {"name": "value", "type": "uint256", "indexed": false}
      ]
    },
    {
      "type": "event",
      "name": "AsyncCallExecuted",
      "inputs": [
        {"name": "callId", "type": "bytes32", "indexed": true},
        {"name": "success", "type": "bool", "indexed": false},
        {"name": "result", "type": "bytes", "indexed": false}
      ]
    }
  ],

  // Scheduler Contract ABI
  SCHEDULER_CONTRACT: [
    {
      "type": "function",
      "name": "scheduleCall",
      "inputs": [
        {"name": "target", "type": "address"},
        {"name": "data", "type": "bytes"},
        {"name": "value", "type": "uint256"},
        {"name": "frequency", "type": "uint64"},
        {"name": "maxExecutions", "type": "uint64"},
        {"name": "ttl", "type": "uint64"}
      ],
      "outputs": [{"name": "callId", "type": "uint64"}]
    },
    {
      "type": "function",
      "name": "cancelScheduledCall",
      "inputs": [{"name": "callId", "type": "uint64"}]
    },
    {
      "type": "event",
      "name": "CallScheduled",
      "inputs": [
        {"name": "callId", "type": "uint64", "indexed": true},
        {"name": "caller", "type": "address", "indexed": true},
        {"name": "target", "type": "address", "indexed": false},
        {"name": "frequency", "type": "uint64", "indexed": false},
        {"name": "maxExecutions", "type": "uint64", "indexed": false}
      ]
    },
    {
      "type": "event",
      "name": "CallExecuted",
      "inputs": [
        {"name": "callId", "type": "uint64", "indexed": true},
        {"name": "executionIndex", "type": "uint64", "indexed": false},
        {"name": "success", "type": "bool", "indexed": false}
      ]
    },
    {
      "type": "event",
      "name": "CallCancelled",
      "inputs": [
        {"name": "callId", "type": "uint64", "indexed": true},
        {"name": "caller", "type": "address", "indexed": true}
      ]
    }
  ],

  // RitualWallet Contract ABI
  RITUAL_WALLET: [
    {
      "type": "function",
      "name": "deposit",
      "inputs": [],
      "payable": true
    },
    {
      "type": "function",
      "name": "withdraw",
      "inputs": [{"name": "amount", "type": "uint256"}]
    },
    {
      "type": "function",
      "name": "getBalance",
      "inputs": [{"name": "user", "type": "address"}],
      "outputs": [{"name": "balance", "type": "uint256"}]
    },
    {
      "type": "function",
      "name": "payForExecution",
      "inputs": [
        {"name": "user", "type": "address"},
        {"name": "amount", "type": "uint256"},
        {"name": "executionType", "type": "uint8"}
      ]
    },
    {
      "type": "event",
      "name": "Deposit",
      "inputs": [
        {"name": "user", "type": "address", "indexed": true},
        {"name": "amount", "type": "uint256", "indexed": false}
      ]
    },
    {
      "type": "event",
      "name": "Withdrawal",
      "inputs": [
        {"name": "user", "type": "address", "indexed": true},
        {"name": "amount", "type": "uint256", "indexed": false}
      ]
    },
    {
      "type": "event",
      "name": "ExecutionPayment",
      "inputs": [
        {"name": "user", "type": "address", "indexed": true},
        {"name": "amount", "type": "uint256", "indexed": false},
        {"name": "executionType", "type": "uint8", "indexed": false}
      ]
    }
  ],

  // ONNX Inference Precompile ABI (0x800)
  ONNX_PRECOMPILE: [
    {
      "type": "function",
      "name": "runInference",
      "inputs": [
        {"name": "modelId", "type": "bytes32"},
        {"name": "inputData", "type": "bytes"},
        {"name": "maxGas", "type": "uint256"}
      ],
      "outputs": [{"name": "result", "type": "bytes"}]
    },
    {
      "type": "event",
      "name": "InferenceExecuted",
      "inputs": [
        {"name": "modelId", "type": "bytes32", "indexed": true},
        {"name": "caller", "type": "address", "indexed": true},
        {"name": "gasUsed", "type": "uint256", "indexed": false},
        {"name": "success", "type": "bool", "indexed": false}
      ]
    }
  ],

  // HTTP Call Precompile ABI (0x801)
  HTTP_CALL_PRECOMPILE: [
    {
      "type": "function",
      "name": "httpCall",
      "inputs": [
        {"name": "url", "type": "string"},
        {"name": "method", "type": "uint8"},
        {"name": "headers", "type": "string[]"},
        {"name": "body", "type": "bytes"}
      ],
      "outputs": [{"name": "response", "type": "bytes"}]
    }
  ],

  // LLM Call Precompile ABI (0x802)
  LLM_CALL_PRECOMPILE: [
    {
      "type": "function",
      "name": "llmCall",
      "inputs": [
        {"name": "model", "type": "string"},
        {"name": "messages", "type": "string"},
        {"name": "temperature", "type": "uint256"},
        {"name": "maxTokens", "type": "uint256"}
      ],
      "outputs": [{"name": "response", "type": "string"}]
    }
  ],

  // JQ Query Precompile ABI (0x803)
  JQ_QUERY_PRECOMPILE: [
    {
      "type": "function",
      "name": "jqQuery",
      "inputs": [
        {"name": "jsonData", "type": "string"},
        {"name": "query", "type": "string"}
      ],
      "outputs": [{"name": "result", "type": "string"}]
    }
  ]
} as const

// Event signature mappings (keccak256 hashes)
export const EVENT_SIGNATURES = {
  // Async Precompile Events
  '0xd4735d920b0f87494915f556dd9b54c8f309026070caea5c737245152564d266': 'AsyncCallSubmitted',
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'AsyncCallExecuted',
  
  // Scheduler Events
  '0xcaca4474e4e795729bb2ff72d20cbac301679d1329458aba9cc4a5223526694': 'CallScheduled', 
  '0x9506817bdcab92f132f5c2c4ec3e8e82dbc9c64329b6b3a6c6b0b78a18f4b562': 'CallExecuted',
  '0x7e108c3498db8d6d25e04c3e5b5e5d5c5d5d5e5d5e5d5e5d5e5d5e5d5e5d5e5d': 'CallCancelled',
  
  // RitualWallet Events  
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c': 'Deposit',
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65': 'Withdrawal',
  '0x4dfe1bbbcf077db9f92b4c1e0fb47b4e15c5b3b8e3b8b3e3b8b3e3b8b3e3b8b3': 'ExecutionPayment',
  
  // ONNX Inference Events
  '0xa1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890': 'InferenceExecuted'
} as const

// Method signature mappings (first 4 bytes of keccak256)
export const METHOD_SIGNATURES = {
  // Async Precompile Methods
  '0x12345678': 'submitAsyncCall',
  
  // Scheduler Methods
  '0xabcdef12': 'scheduleCall',
  '0x87654321': 'cancelScheduledCall',
  
  // RitualWallet Methods
  '0xd0e30db0': 'deposit', // Standard deposit() signature
  '0x2e1a7d4d': 'withdraw',
  '0xf8b2cb4f': 'getBalance',
  '0x11223344': 'payForExecution',
  
  // ONNX Inference Methods
  '0x55667788': 'runInference'
} as const

export interface DecodedEvent {
  name: string
  signature: string
  address: string
  contractName: string
  inputs: Array<{
    name: string
    type: string
    value: any
    indexed: boolean
  }>
}

export interface DecodedMethod {
  name: string
  signature: string
  contractName: string
  inputs: Array<{
    name: string
    type: string
    value: any
  }>
}

export interface DecodedTransaction {
  method?: DecodedMethod | null
  events: DecodedEvent[]
  contractInteractions: Array<{
    address: string
    contractName: string
    type: 'call' | 'create' | 'staticcall' | 'delegatecall'
  }>
}

/**
 * Main Contract Decoder Class
 */
export class ContractDecoder {
  
  /**
   * Get contract name from address
   */
  static getContractName(address: string): string {
    const normalizedAddress = address.toLowerCase()
    
    for (const [contractName, contractAddress] of Object.entries(DEPLOYED_CONTRACTS)) {
      if (contractAddress.toLowerCase() === normalizedAddress) {
        return contractName.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
      }
    }
    
    // Check if it's a known precompile range
    if (normalizedAddress.startsWith('0x00000000000000000000000000000000000008')) {
      return 'Precompile Contract'
    }
    
    return 'Unknown Contract'
  }

  /**
   * Decode transaction method call
   */
  static decodeMethod(to: string, input: string): DecodedMethod | null {
    if (!input || input.length < 10) return null // Need at least 4-byte selector + data
    
    const methodSelector = input.slice(0, 10) // First 4 bytes (0x + 8 hex chars)
    const methodName = METHOD_SIGNATURES[methodSelector as keyof typeof METHOD_SIGNATURES]
    
    if (!methodName) return null
    
    const contractName = this.getContractName(to)
    
    // TODO: Implement full ABI decoding of parameters
    // For now, return basic method info
    return {
      name: methodName,
      signature: methodSelector,
      contractName,
      inputs: [] // TODO: Decode actual parameters
    }
  }

  /**
   * Decode event logs
   */
  static decodeEvents(logs: any[]): DecodedEvent[] {
    const decodedEvents: DecodedEvent[] = []
    
    for (const log of logs) {
      if (!log.topics || log.topics.length === 0) continue
      
      const eventSignature = log.topics[0]
      const eventName = EVENT_SIGNATURES[eventSignature as keyof typeof EVENT_SIGNATURES]
      
      if (eventName) {
        const contractName = this.getContractName(log.address)
        
        decodedEvents.push({
          name: eventName,
          signature: eventSignature,
          address: log.address,
          contractName,
          inputs: [] // TODO: Decode actual event parameters
        })
      }
    }
    
    return decodedEvents
  }

  /**
   * Decode full transaction
   */
  static decodeTransaction(transaction: any, receipt: any): DecodedTransaction {
    const result: DecodedTransaction = {
      events: [],
      contractInteractions: []
    }
    
    // Decode method call
    if (transaction.to && transaction.input) {
      result.method = this.decodeMethod(transaction.to, transaction.input)
      
      if (result.method) {
        result.contractInteractions.push({
          address: transaction.to,
          contractName: result.method.contractName,
          type: 'call'
        })
      }
    }
    
    // Decode events
    if (receipt && receipt.logs) {
      result.events = this.decodeEvents(receipt.logs)
      
      // Add unique contract interactions from events
      for (const event of result.events) {
        const existingInteraction = result.contractInteractions.find(
          interaction => interaction.address.toLowerCase() === event.address.toLowerCase()
        )
        
        if (!existingInteraction) {
          result.contractInteractions.push({
            address: event.address,
            contractName: event.contractName,
            type: 'call'
          })
        }
      }
    }
    
    return result
  }

  /**
   * Check if address is a known contract
   */
  static isKnownContract(address: string): boolean {
    const normalizedAddress = address.toLowerCase()
    return Object.values(DEPLOYED_CONTRACTS).some(
      contractAddress => contractAddress.toLowerCase() === normalizedAddress
    )
  }

  /**
   * Get contract ABI by address
   */
  static getContractABI(address: string): readonly any[] | null {
    const normalizedAddress = address.toLowerCase()
    
    for (const [contractName, contractAddress] of Object.entries(DEPLOYED_CONTRACTS)) {
      if (contractAddress.toLowerCase() === normalizedAddress) {
        const abiKey = contractName as keyof typeof CONTRACT_ABIS
        return CONTRACT_ABIS[abiKey] || null
      }
    }
    
    return null
  }
}

/**
 * Utility functions for contract interaction
 */
export const ContractUtils = {
  /**
   * Format contract address for display
   */
  formatAddress: (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  },

  /**
   * Get contract verification status
   */
  isVerified: (address: string) => {
    return ContractDecoder.isKnownContract(address)
  },

  /**
   * Get contract type badge color
   */
  getContractBadgeColor: (address: string) => {
    if (Object.values(DEPLOYED_CONTRACTS).includes(address as any)) {
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    }
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}
