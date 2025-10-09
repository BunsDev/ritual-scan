import { NextRequest, NextResponse } from 'next/server'

/**
 * Validator Peers API Route
 * Fetches validator peer list from Summit node (server-side to avoid CORS)
 */
export async function GET(request: NextRequest) {
  try {
    // Get RPC URL to determine Summit node IP
    const rpcUrl = process.env.NEXT_PUBLIC_RETH_RPC_URL || 'http://104.196.102.16:8545'
    const summitIp = rpcUrl.match(/https?:\/\/([^:]+)/)?.[1] || '104.196.102.16'
    const peerListUrl = `http://${summitIp}:3030/get_peer_list`
    
    console.log(`[Validator Peers API] Fetching from: ${peerListUrl}`)
    
    const response = await fetch(peerListUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'Accept': 'application/json',
      }
    })
    
    if (!response.ok) {
      console.error(`[Validator Peers API] Summit node returned ${response.status}`)
      return NextResponse.json(
        { error: `Summit node error: ${response.status}`, validators: [] },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    // Normalize response format (might be 'peers' or 'validators')
    const peers = data.peers || data.validators || []
    
    console.log(`[Validator Peers API] Got ${peers.length} peers`)
    
    return NextResponse.json({ validators: peers })
    
  } catch (error: any) {
    console.error('[Validator Peers API] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch validator peers', validators: [] },
      { status: 500 }
    )
  }
}
