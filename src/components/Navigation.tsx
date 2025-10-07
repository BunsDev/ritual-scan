'use client'

import Link from 'next/link'
import { ConnectWalletButton } from './ConnectWalletButton'

interface NavigationProps {
  currentPage?: string
}

const NAV_ITEMS = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/blocks', label: 'Blocks', key: 'blocks' },
  { href: '/transactions', label: 'Transactions', key: 'transactions' },
  { href: '/validators', label: 'Validators', key: 'validators' },
  { href: '/mempool', label: 'Mempool', key: 'mempool' },
  { href: '/scheduled', label: 'Scheduled', key: 'scheduled' },
  { href: '/async', label: 'Async', key: 'async' },
  { href: '/settings', label: 'Settings', key: 'settings' },
] as const

const ANALYTICS_ITEMS = [
  { href: '/charts', label: 'Charts', key: 'charts' },
  { href: '/stats', label: 'Stats', key: 'stats' },
  { href: '/leaderboard', label: 'Network Leaderboard', key: 'leaderboard' },
] as const

export function Navigation({ currentPage }: NavigationProps) {
  return (
    <header className="border-b border-lime-500/25 bg-black/98 backdrop-blur-md shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-lime-400 hover:text-lime-300 transition-all duration-200 hover:scale-105">
              <span className="bg-gradient-to-r from-lime-400 to-lime-300 bg-clip-text text-transparent">
                Shrinenet
              </span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-3">
            <nav className="flex items-center space-x-1">
              {NAV_ITEMS.map((item) => (
                currentPage === item.key ? (
                  <span 
                    key={item.key}
                    className="relative text-white bg-lime-500/10 border border-lime-500/30 rounded-lg px-4 py-2 text-sm font-medium shadow-lg inline-flex items-center h-[38px]"
                  >
                    <span className="relative z-10">{item.label}</span>
                    <div className="absolute inset-0 bg-lime-500/5 rounded-lg"></div>
                  </span>
                ) : (
                  <a 
                    key={item.key}
                    href={item.href}
                    className="text-lime-300/90 hover:text-white hover:bg-white/5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:shadow-md border border-transparent hover:border-lime-500/20 inline-flex items-center h-[38px]"
                  >
                    {item.label}
                  </a>
                )
              ))}
              
              {/* Analytics Dropdown */}
              <div className="relative group">
                <button 
                  className={`${
                    currentPage === 'charts' || currentPage === 'stats'
                      ? 'relative text-white bg-lime-500/10 border border-lime-500/30 rounded-lg px-4 py-2 text-sm font-medium shadow-lg'
                      : 'text-lime-300/90 hover:text-white hover:bg-white/5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:shadow-md border border-transparent hover:border-lime-500/20'
                  } inline-flex items-center gap-1 h-[38px]`}
                >
                  Analytics
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 border border-lime-500/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-2">
                    {ANALYTICS_ITEMS.map((item) => (
                      <Link 
                        key={item.key}
                        href={item.href}
                        prefetch={false}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          currentPage === item.key
                            ? 'text-white bg-lime-500/10 font-medium'
                            : 'text-lime-300 hover:text-white hover:bg-lime-500/10'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </nav>
            
            {/* Connect Wallet Button - aligned with nav */}
            <div className="flex items-center h-[38px] ml-2">
              <div className="scale-90">
                <ConnectWalletButton />
              </div>
            </div>
          </div>

          {/* Medium Screen Navigation */}
          <nav className="hidden md:flex lg:hidden items-center space-x-0.5">
            {NAV_ITEMS.slice(0, 6).map((item) => (
              currentPage === item.key ? (
                <span 
                  key={item.key}
                  className="text-white bg-lime-500/10 border border-lime-500/30 rounded-md px-3 py-2 text-xs font-medium"
                >
                  {item.label}
                </span>
              ) : (
                <Link 
                  key={item.key}
                  href={item.href}
                  prefetch={false}
                  className="text-lime-300/90 hover:text-white hover:bg-white/5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 border border-transparent hover:border-lime-500/20"
                >
                  {item.label}
                </Link>
              )
            ))}
            
            {/* Analytics Dropdown */}
            <div className="relative group">
              <button 
                className={`${
                  currentPage === 'charts' || currentPage === 'stats' || currentPage === 'leaderboard'
                    ? 'text-white bg-lime-500/10 border border-lime-500/30 rounded-md px-3 py-2 text-xs font-medium'
                    : 'text-lime-300/90 hover:text-white hover:bg-white/5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 border border-transparent hover:border-lime-500/20'
                } flex items-center gap-0.5`}
              >
                Analytics
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 border border-lime-500/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-2">
                  {ANALYTICS_ITEMS.map((item) => (
                    <Link 
                      key={item.key}
                      href={item.href}
                      prefetch={false}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        currentPage === item.key
                          ? 'text-white bg-lime-500/10 font-medium'
                          : 'text-lime-300 hover:text-white hover:bg-lime-500/10'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            
            {/* More Menu for remaining items */}
            <div className="relative group">
              <button className="text-lime-300/90 hover:text-white hover:bg-white/5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 border border-transparent hover:border-lime-500/20">
                More
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-black/95 border border-lime-500/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-2">
                  {NAV_ITEMS.slice(6).map((item) => (
                    <Link 
                      key={item.key}
                      href={item.href}
                      prefetch={false}
                      className="block px-4 py-2 text-sm text-lime-300 hover:text-white hover:bg-lime-500/10 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="text-lime-400 hover:text-lime-300 p-2 rounded-lg hover:bg-lime-500/10 transition-all duration-200">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
