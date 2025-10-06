'use client'

import { useAccount, useConnect, useDisconnect, useEnsName } from 'wagmi'
import { useState } from 'react'

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })
  const [showModal, setShowModal] = useState(false)

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

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
            <button
              onClick={() => {
                disconnect()
                setShowModal(false)
              }}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
            >
              Disconnect
            </button>
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

            <div className="mt-6 text-xs text-lime-400/60 text-center">
              By connecting, you agree to our Terms of Service
            </div>
          </div>
        </div>
      )}
    </>
  )
}

