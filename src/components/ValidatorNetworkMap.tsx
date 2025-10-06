'use client'

import { useEffect, useRef, useState } from 'react'

interface ValidatorNode {
  address: string
  x: number
  y: number
  blocksProposed: number
  connections: number[]
}

interface ValidatorNetworkMapProps {
  validators: Array<{
    address: string
    blocksProposed: number
    percentage: number
  }>
}

export function ValidatorNetworkMap({ validators }: ValidatorNetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<ValidatorNode[]>([])
  const animationRef = useRef<number>()

  useEffect(() => {
    if (!validators || validators.length === 0) return

    // Create nodes positioned in a circular network topology
    const centerX = 400
    const centerY = 200
    const radius = 150

    const newNodes: ValidatorNode[] = validators.map((validator, index) => {
      const angle = (index / validators.length) * 2 * Math.PI - Math.PI / 2
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      
      // In full mesh topology, each node connects to all others
      const connections = validators
        .map((_, i) => i)
        .filter(i => i !== index)
      
      return {
        address: validator.address,
        x,
        y,
        blocksProposed: validator.blocksProposed,
        connections
      }
    })

    setNodes(newNodes)
  }, [validators])

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw connections (full mesh)
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.1)'
      ctx.lineWidth = 0.5
      
      nodes.forEach((node, i) => {
        node.connections.forEach(targetIdx => {
          if (targetIdx > i) { // Draw each connection once
            const target = nodes[targetIdx]
            
            // Animated pulse effect
            const pulse = Math.sin(frame * 0.02 + i * 0.5) * 0.5 + 0.5
            ctx.globalAlpha = 0.05 + pulse * 0.05
            
            ctx.beginPath()
            ctx.moveTo(node.x, node.y)
            ctx.lineTo(target.x, target.y)
            ctx.stroke()
          }
        })
      })
      
      ctx.globalAlpha = 1

      // Draw nodes
      nodes.forEach((node, index) => {
        const size = Math.max(8, Math.min(20, Math.log(node.blocksProposed + 1) * 4))
        
        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2)
        gradient.addColorStop(0, 'rgba(163, 230, 53, 0.4)')
        gradient.addColorStop(1, 'rgba(163, 230, 53, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(node.x - size * 2, node.y - size * 2, size * 4, size * 4)
        
        // Node circle
        ctx.fillStyle = '#a3e635'
        ctx.beginPath()
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2)
        ctx.fill()
        
        // Inner circle (pulse)
        const pulse = Math.sin(frame * 0.05 + index * 0.3) * 0.3 + 0.7
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`
        ctx.beginPath()
        ctx.arc(node.x, node.y, size * 0.4, 0, Math.PI * 2)
        ctx.fill()
        
        // Node label (block count)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.blocksProposed.toString(), node.x, node.y - size - 12)
      })
      
      frame++
      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes])

  if (validators.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-lime-900/10 to-black border border-lime-500/20 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Validator Network Topology</h3>
          <p className="text-sm text-lime-300">
            {validators.length} active validators • Full mesh connectivity
          </p>
        </div>
        <div className="text-xs text-lime-400 bg-lime-900/20 px-3 py-1 rounded-full border border-lime-500/30">
          {(validators.length * (validators.length - 1) / 2).toLocaleString()} peer connections
        </div>
      </div>
      
      <div className="relative">
        <canvas 
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-auto bg-black/40 rounded-lg border border-lime-500/10"
        />
        
        <div className="mt-3 flex items-center justify-center space-x-6 text-xs text-lime-400">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-lime-400"></div>
            <span>Node size = blocks proposed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-0.5 bg-lime-400/20"></div>
            <span>Peer connections (Summit BFT mesh)</span>
          </div>
        </div>
        
        {/* Note about IP data */}
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/20 rounded-md">
          <p className="text-xs text-yellow-300">
            <span className="font-semibold">ℹ️ Geographic Data:</span> Validator IP addresses require consensus layer (CL) access or admin RPC methods (admin_peers). 
            Currently showing network topology based on on-chain validator addresses.
            For full geographic visualization, enable admin APIs on the RPC node or connect to the consensus layer P2P network.
          </p>
        </div>
      </div>
    </div>
  )
}

