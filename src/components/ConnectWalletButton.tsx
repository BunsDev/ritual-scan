'use client'

import { useAccount, useConnect, useDisconnect, useEnsName } from 'wagmi'
import { useState, useEffect } from 'react'
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
      const rpcUrl = config.primary || 'http://35.196.101.134:8545'
      
      // Create account from private key
      const faucetAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`)
      
      // Create clients
      const publicClient = createPublicClient({
        transport: http(rpcUrl)
      })
      
      const walletClient = createWalletClient({
        account: faucetAccount,
        transport: http(rpcUrl)
      })
      
      // Get nonce and gas price
      const nonce = await publicClient.getTransactionCount({ address: faucetAccount.address })
      const gasPrice = await publicClient.getGasPrice()
      
      // Sign and send transaction using eth_sendRawTransaction
      const hash = await walletClient.sendTransaction({
        to: userAddress as `0x${string}`,
        value: parseEther('100'),
        nonce,
        gasPrice,
        gas: 21000n,
      })

      console.log(`Faucet TX sent: ${hash}`)
      setFaucetSent(true)
    } catch (error) {
      console.error('Faucet error:', error)
      // Continue silently - faucet is optional
    } finally {
      setFaucetSending(false)
    }
  }

  // Auto-send faucet when wallet connects
  useEffect(() => {
    if (isConnected && address && !faucetSent && !faucetSending) {
      sendFaucetTokens(address)
    }
  }, [isConnected, address])

  // Add Ritual Network to MetaMask  
  const addRitualNetwork = async () => {
    setAddingNetwork(true)
    try {
      const config = rethClient.getConfiguration()
      let rpcUrl = config.primary || 'http://35.196.101.134:8545'
      
      // MetaMask requires HTTPS for security, but allows HTTP for localhost
      // For production, convert HTTP to HTTPS if not localhost
      if (rpcUrl.startsWith('http://') && !rpcUrl.includes('localhost') && !rpcUrl.includes('127.0.0.1')) {
        // Try HTTPS version (most public RPC nodes support both)
        rpcUrl = rpcUrl.replace('http://', 'https://')
      }
      
      const params = {
        chainId: '0x1B58', // 7000 in hex
        chainName: 'Ritual Chain (Shrinenet)',
        nativeCurrency: {
          name: 'Ritual',
          symbol: 'RITUAL',
          decimals: 18,
        },
        rpcUrls: [rpcUrl],
        blockExplorerUrls: ['https://ding.fish'],
      }
      
      console.log('Adding network with params:', params)
      
      await window.ethereum?.request({
        method: 'wallet_addEthereumChain',
        params: [params],
      })
      
      console.log('Ritual Network added to MetaMask')
    } catch (error: any) {
      console.error('Failed to add network:', error)
      // If HTTPS failed, try with HTTP (for localhost/dev)
      if (error?.message?.includes('HTTPS')) {
        alert('MetaMask requires HTTPS RPC URLs. Please use an HTTPS endpoint in Settings or add the network manually.')
      }
    } finally {
      setAddingNetwork(false)
    }
  }


  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowModal(!showModal)}
          className="px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-md transition-colors flex items-center space-x-2 font-mono text-xs"
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
        className="px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-md transition-colors text-xs font-medium"
      >
        Connect Wallet
      </button>

      {/* Wallet Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black border-2 border-lime-500/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
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
        </div>
      )}
    </>
  )
}

