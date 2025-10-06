'use client'

import { useAccount, useConnect, useDisconnect, useEnsName } from 'wagmi'
import { useState, useEffect } from 'react'
import { createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { rethClient } from '@/lib/reth-client'
import { ritualChain } from '@/lib/wagmi-config'

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })
  const [showModal, setShowModal] = useState(false)
  const [faucetSent, setFaucetSent] = useState(false)
  const [addingNetwork, setAddingNetwork] = useState(false)

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Add Ritual Network to MetaMask
  const addRitualNetwork = async () => {
    setAddingNetwork(true)
    try {
      const config = rethClient.getConfiguration()
      await window.ethereum?.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x1B58', // 7000 in hex
            chainName: 'Ritual Chain (Shrinenet)',
            nativeCurrency: {
              name: 'Ritual',
              symbol: 'RITUAL',
              decimals: 18,
            },
            rpcUrls: [config.primary || 'http://35.196.101.134:8545'],
            blockExplorerUrls: ['https://ding.fish'],
          },
        ],
      })
      console.log('✅ Ritual Network added to MetaMask')
    } catch (error) {
      console.error('Failed to add network:', error)
    } finally {
      setAddingNetwork(false)
    }
  }

  // Faucet: Send 100 RITUAL from anvil default account
  const sendFaucetTokens = async (userAddress: string) => {
    try {
      console.log('🚰 Sending 100 RITUAL from faucet...')
      
      const config = rethClient.getConfiguration()
      const rpcUrl = config.primary || 'http://35.196.101.134:8545'
      
      // Create wallet client with anvil default account
      const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
      const client = createWalletClient({
        account,
        chain: ritualChain,
        transport: http(rpcUrl)
      })

      // Send 100 RITUAL tokens
      const hash = await client.sendTransaction({
        to: userAddress as `0x${string}`,
        value: parseEther('100'), // 100 RITUAL tokens
      })

      console.log(`✅ Faucet transaction sent: ${hash}`)
      setFaucetSent(true)
    } catch (error) {
      console.error('❌ Faucet failed:', error)
    }
  }

  // Auto-send faucet when wallet connects
  useEffect(() => {
    if (isConnected && address && !faucetSent) {
      sendFaucetTokens(address)
    }
  }, [isConnected, address, faucetSent])

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowModal(!showModal)}
          className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors flex items-center space-x-2 font-mono text-sm"
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span>{ensName || formatAddress(address)}</span>
        </button>

        {showModal && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-black border border-lime-500/50 rounded-lg p-4 shadow-xl z-50">
            <div className="text-xs text-lime-400 mb-2">Connected Wallet</div>
            <div className="font-mono text-sm text-white mb-4 break-all">
              {address}
            </div>
            
            {faucetSent && (
              <div className="mb-3 p-2 bg-green-900/20 border border-green-500/30 rounded text-xs text-green-300">
                ✅ 100 RITUAL tokens sent!
              </div>
            )}
            
            <div className="space-y-2">
              <button
                onClick={addRitualNetwork}
                disabled={addingNetwork}
                className="w-full px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>🦊</span>
                <span>{addingNetwork ? 'Adding...' : 'Add Ritual Shrinenet'}</span>
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
        className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors text-sm font-medium"
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
                    <div className="w-10 h-10 bg-lime-600/20 rounded-lg flex items-center justify-center">
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
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>🦊</span>
                <span>{addingNetwork ? 'Adding Network...' : 'Add Ritual Shrinenet'}</span>
              </button>
              <p className="text-xs text-lime-400/60 text-center mt-2">
                Adds Ritual Chain to your MetaMask
              </p>
            </div>

            <div className="mt-4 text-xs text-lime-400/60 text-center">
              Auto-faucet: 100 RITUAL tokens sent on first connection
            </div>
          </div>
        </div>
      )}
    </>
  )
}

