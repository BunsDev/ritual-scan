'use client'

import { useAccount, useConnect, useDisconnect, useEnsName } from 'wagmi'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { rethClient } from '@/lib/reth-client'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })
  const [showModal, setShowModal] = useState(false)
  const [addingNetwork, setAddingNetwork] = useState(false)
  const [faucetSending, setFaucetSending] = useState(false)
  const [faucetSent, setFaucetSent] = useState(false)

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Faucet: Send 100 RITUAL using signed transaction
  const sendFaucetTokens = async (userAddress: string) => {
    setFaucetSending(true)
    try {
      console.log('Sending 100 RITUAL from faucet...')
      
      const config = rethClient.getConfiguration()
      const rpcUrl = config.primary || 'http://35.185.119.14:8545'
      
      // On HTTPS, use /api/rpc-proxy to avoid mixed content
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
      const proxyUrl = isHttps && rpcUrl.startsWith('http://') ? '/api/rpc-proxy' : rpcUrl
      
      // Create account from private key
      const faucetAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`)
      
      // Create clients (will use proxy if needed)
      // Increase timeout for slow RPC responses
      const publicClient = createPublicClient({
        transport: http(proxyUrl, {
          timeout: 30000, // 30 second timeout instead of default 10s
        })
      })
      
      const walletClient = createWalletClient({
        account: faucetAccount,
        transport: http(proxyUrl, {
          timeout: 30000, // 30 second timeout
        })
      })
      
      // Send transaction (Viem will automatically fetch nonce)
      console.log(`Sending 100 RITUAL to ${userAddress}...`)
      const startTime = Date.now()
      
      const hash = await walletClient.sendTransaction({
        to: userAddress as `0x${string}`,
        value: parseEther('100'),
        gas: BigInt(21000),
        chain: null,
      })

      const elapsed = Date.now() - startTime
      console.log(`✅ Faucet TX sent in ${elapsed}ms: ${hash}`)
      
      // Mark this address as having received faucet
      const faucetKey = `faucet-sent-${userAddress.toLowerCase()}`
      localStorage.setItem(faucetKey, 'true')
      
      setFaucetSent(true)
    } catch (error: any) {
      console.error('Faucet error:', error)
      // Mark as sent anyway to prevent retries
      const faucetKey = `faucet-sent-${userAddress.toLowerCase()}`
      localStorage.setItem(faucetKey, 'true')
      setFaucetSent(true) // Show as sent even if failed
    } finally {
      setFaucetSending(false)
    }
  }

  // Auto-send faucet when wallet connects (once per address ever)
  useEffect(() => {
    if (isConnected && address && !faucetSent && !faucetSending) {
      // Check if this address already received faucet tokens
      const faucetKey = `faucet-sent-${address.toLowerCase()}`
      const alreadySent = localStorage.getItem(faucetKey)
      
      if (!alreadySent) {
        sendFaucetTokens(address)
      } else {
        console.log('Address already received faucet tokens')
        setFaucetSent(true) // Show as sent but don't send again
      }
    }
  }, [isConnected, address])

  // Add Ritual Network to MetaMask  
  const addRitualNetwork = async () => {
    setAddingNetwork(true)
    try {
      const config = rethClient.getConfiguration()
      let rpcUrl = config.primary || 'http://35.185.119.14:8545'
      
      // MetaMask requires HTTPS for all non-localhost RPC URLs
      // Convert http://IP:PORT to https://IP:PORT
      if (rpcUrl.startsWith('http://')) {
        const urlObj = new URL(rpcUrl)
        // Only keep HTTP if it's literally localhost or 127.0.0.1
        if (urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
          // FORCE HTTPS - MetaMask requirement
          rpcUrl = rpcUrl.replace('http://', 'https://')
          console.log(`Converted to HTTPS for MetaMask: ${rpcUrl}`)
        }
      }
      
      const params = {
        chainId: '0x1B58', // 7000 in hex
        chainName: 'Ritual Chain',
        nativeCurrency: {
          name: 'Ritual',
          symbol: 'RITUAL',
          decimals: 18,
        },
        rpcUrls: [rpcUrl],
        blockExplorerUrls: ['https://ding.fish'],
      }
      
      console.log('Adding network:', params)
      
      await window.ethereum?.request({
        method: 'wallet_addEthereumChain',
        params: [params],
      })
      
      console.log('Network added successfully')
      alert('✅ Ritual Chain added to MetaMask! Click Approve on any warnings (they are normal for custom networks).')
    } catch (error: any) {
      console.error('Network addition error:', error)
      if (error?.code === 4001) {
        // User rejected - silent
        console.log('User cancelled network addition')
      } else {
        // Show user-friendly error
        alert('Failed to add network. Your RPC is using HTTP but MetaMask requires HTTPS for security. The network may still work - try switching to Ritual Chain in MetaMask dropdown.')
      }
    } finally {
      setAddingNetwork(false)
    }
  }


  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showModal])

  if (!mounted) {
    return (
      <button className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-medium inline-flex items-center h-[38px]">
        Connect Wallet
      </button>
    )
  }

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowModal(!showModal)}
          className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors inline-flex items-center space-x-2 font-mono text-sm h-[38px]"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
          <span>{ensName || formatAddress(address)}</span>
        </button>

        {showModal && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-black border border-lime-500/50 rounded-lg p-4 shadow-xl z-50">
            <div className="text-xs text-lime-400 mb-3">Connected Wallet</div>
            
            {/* Faucet status */}
            {faucetSending && (
              <div className="mb-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-300">
                Sending 100 RITUAL tokens...
              </div>
            )}
            {faucetSent && (
              <div className="mb-3 p-2 bg-green-900/20 border border-green-500/30 rounded text-xs text-green-300">
                ✅ 100 RITUAL tokens sent!
              </div>
            )}
            
            <div className="space-y-2">
              <button
                onClick={addRitualNetwork}
                disabled={addingNetwork}
                className="w-full px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {addingNetwork ? 'Adding Network...' : 'Add Ritual Shrinenet'}
              </button>
              
              <button
                onClick={() => {
                  disconnect()
                  setShowModal(false)
                  setFaucetSent(false)
                }}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors text-xs font-medium inline-flex items-center h-[32px]"
      >
        Connect Wallet
      </button>

      {/* Wallet Selection Modal */}
      {showModal && mounted && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] p-4" 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false)
            }
          }}
        >
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black border-2 border-lime-500/50 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-lime-300 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector })
                    setShowModal(false)
                  }}
                  disabled={isPending}
                  className="w-full flex items-center justify-between p-4 bg-lime-900/20 hover:bg-lime-900/40 border border-lime-600/30 rounded-lg transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-lime-600/20 rounded-lg flex items-center justify-center text-2xl">
                      {connector.name === 'MetaMask' && '🦊'}
                      {connector.name === 'WalletConnect' && '🔗'}
                      {connector.name === 'Coinbase Wallet' && '💼'}
                      {connector.name === 'Injected' && '💳'}
                    </div>
                    <span className="font-medium">{connector.name}</span>
                  </div>
                  <div className="text-lime-400 text-sm">
                    {connector.name === 'MetaMask' && 'INSTALLED'}
                  </div>
                </button>
              ))}
            </div>

            {/* Add Network Button */}
            <div className="mt-4 pt-4 border-t border-lime-500/20">
              <button
                onClick={addRitualNetwork}
                disabled={addingNetwork}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {addingNetwork ? 'Adding Network...' : 'Add Ritual Shrinenet'}
              </button>
              <p className="text-xs text-lime-400/60 text-center mt-2">
                Adds Ritual Chain to your MetaMask
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

