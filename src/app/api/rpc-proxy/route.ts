import { NextRequest, NextResponse } from 'next/server'

/**
 * RPC Proxy Route - Solves HTTPS mixed content issues
 * 
 * Forwards JSON-RPC requests from HTTPS browser to HTTP RPC endpoint
 * This prevents mixed content errors when the app is deployed over HTTPS
 */
export async function POST(request: NextRequest) {
  try {
    // Get the JSON-RPC request from the browser
    const rpcRequest = await request.json()
    
    // Allow client to specify RPC URL via header (for dynamic settings)
    const clientRpcUrl = request.headers.get('x-rpc-url')
    const rpcUrl = clientRpcUrl || process.env.NEXT_PUBLIC_RETH_RPC_URL || process.env.NEXT_PUBLIC_RETH_HTTP_URL
    
    if (!rpcUrl) {
      console.error('❌ [RPC-Proxy] No RPC URL configured')
      return NextResponse.json(
        { error: 'RPC endpoint not configured' },
        { status: 500 }
      )
    }
    
    console.log(`📡 [RPC-Proxy] Forwarding request: ${rpcRequest.method} (ID: ${rpcRequest.id})`)
    
    // Forward the request to the actual RPC endpoint
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
    })

    if (!response.ok) {
      console.error(`❌ [RPC-Proxy] RPC endpoint error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: `RPC endpoint error: ${response.status}` },
        { status: response.status }
      )
    }

    const rpcResponse = await response.json()
    
    // Return the RPC response back to the browser
    return NextResponse.json(rpcResponse)
    
  } catch (error) {
    console.error('❌ [RPC-Proxy] Proxy error:', error)
    return NextResponse.json(
      { error: 'Internal proxy error' },
      { status: 500 }
    )
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST for JSON-RPC requests.' },
    { status: 405 }
  )
}
