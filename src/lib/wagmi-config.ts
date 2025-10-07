import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

// Define Ritual Chain
export const ritualChain = {
  id: 7000,
  name: 'Ritual Chain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ritual',
    symbol: 'RITUAL',
  },
  rpcUrls: {
    default: {
      http: ['http://35.185.119.14:8545'],
      webSocket: ['ws://35.185.119.14:8546'],
    },
    public: {
      http: ['http://35.185.119.14:8545'],
      webSocket: ['ws://35.185.119.14:8546'],
    },
  },
  blockExplorers: {
    default: { name: 'Ritual Scan', url: 'https://ding.fish' },
  },
} as const

export const config = createConfig({
  chains: [ritualChain, mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID',
      metadata: {
        name: 'Ritual Scan',
        description: 'Blockchain Explorer for Ritual Chain',
        url: 'https://ding.fish',
        icons: ['https://ding.fish/favicon.ico']
      }
    }),
    coinbaseWallet({
      appName: 'Ritual Scan',
      darkMode: true
    }),
  ],
  transports: {
    [ritualChain.id]: http('http://35.185.119.14:8545'),
    [mainnet.id]: http(),
  },
})

