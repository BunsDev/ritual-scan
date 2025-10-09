'use client'

import { useState, useEffect } from 'react'

interface PasswordProtectionProps {
  children: React.ReactNode
}

export function PasswordProtection({ children }: PasswordProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is already authenticated
  useEffect(() => {
    const authStatus = localStorage.getItem('ritual-scan-auth')
    if (authStatus === 'authenticated') {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password === 'notthelastlayer1~') {
      setIsAuthenticated(true)
      localStorage.setItem('ritual-scan-auth', 'authenticated')
      setError('')
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white/5 border border-lime-500/20 rounded-lg p-8 backdrop-blur-sm">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-lime-400 mb-2">
                Ritual Chain Explorer
              </h1>
              <p className="text-lime-200">
                Enter password to access the explorer
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-lime-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-black/50 border border-lime-500/30 rounded-lg text-white placeholder-lime-400/50 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400"
                  placeholder="Enter password"
                  required
                />
              </div>
              
              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                className="w-full bg-lime-500/20 hover:bg-lime-500/30 text-lime-300 font-medium py-3 px-4 rounded-lg border border-lime-500/30 transition-all duration-200 hover:border-lime-400"
              >
                Access Explorer
              </button>
            </form>
            
            <div className="mt-6 text-center text-xs text-lime-400/60">
              Ritual Chain • Blockchain Explorer
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
