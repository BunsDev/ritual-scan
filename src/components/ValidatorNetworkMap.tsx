'use client'

import { useEffect, useRef, useState } from 'react'

interface ValidatorNode {
  address: string
  lat: number
  lon: number
  x: number
  y: number
  blocksProposed: number
  location: string
}

interface ValidatorNetworkMapProps {
  validators: Array<{
    address: string
    blocksProposed: number
    percentage: number
  }>
}

// World map coordinates (simplified continents)
const worldMapPaths = `
M 150 80 L 200 70 L 250 80 L 280 100 L 300 90 L 320 110 L 280 140 L 240 130 L 200 140 L 160 120 Z
M 100 150 L 140 140 L 180 160 L 200 180 L 180 200 L 140 190 L 100 170 Z
M 400 100 L 480 90 L 520 100 L 540 120 L 560 140 L 540 160 L 500 150 L 460 140 L 420 130 Z
M 600 120 L 650 110 L 700 120 L 720 140 L 700 160 L 650 150 L 600 140 Z
M 120 220 L 160 210 L 180 230 L 160 250 L 120 240 Z
M 600 200 L 680 190 L 720 210 L 700 240 L 640 230 Z
`

// Placeholder geographic distribution (until we get real IPs)
// Distributed across major regions where validators typically run
const geographicRegions = [
  { name: 'US East', lat: 40, lon: -74, mapX: 200, mapY: 140 },      // New York
  { name: 'US West', lat: 37, lon: -122, mapX: 120, mapY: 150 },     // San Francisco  
  { name: 'US Central', lat: 41, lon: -87, mapX: 180, mapY: 145 },   // Chicago
  { name: 'Canada', lat: 43, lon: -79, mapX: 190, mapY: 120 },       // Toronto
  { name: 'UK', lat: 51, lon: 0, mapX: 380, mapY: 110 },             // London
  { name: 'Germany', lat: 52, lon: 13, mapX: 420, mapY: 115 },       // Berlin
  { name: 'France', lat: 48, lon: 2, mapX: 400, mapY: 125 },         // Paris
  { name: 'Netherlands', lat: 52, lon: 4, mapX: 410, mapY: 110 },    // Amsterdam
  { name: 'Singapore', lat: 1, lon: 103, mapX: 640, mapY: 180 },     // Singapore
  { name: 'Japan', lat: 35, lon: 139, mapX: 720, mapY: 155 },        // Tokyo
  { name: 'Australia', lat: -33, lon: 151, mapX: 700, mapY: 250 },   // Sydney
  { name: 'Brazil', lat: -23, lon: -46, mapX: 250, mapY: 230 },      // São Paulo
]

export function ValidatorNetworkMap({ validators }: ValidatorNetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<ValidatorNode[]>([])
  const animationRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!validators || validators.length === 0) return

    // Distribute validators across geographic regions
    const newNodes: ValidatorNode[] = validators.map((validator, index) => {
      // Assign to region (cycle through regions, multiple validators per region)
      const region = geographicRegions[index % geographicRegions.length]
      
      // Add some jitter so validators in same region don't overlap
      const jitterX = (Math.random() - 0.5) * 30
      const jitterY = (Math.random() - 0.5) * 30
      
      return {
        address: validator.address,
        lat: region.lat,
        lon: region.lon,
        x: region.mapX + jitterX,
        y: region.mapY + jitterY,
        blocksProposed: validator.blocksProposed,
        location: region.name
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

    // Draw world map function
    const drawWorldMap = () => {
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.15)'
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      // Draw simplified continents
      const continents = [
        // North America
        [[100,130],[140,120],[180,130],[200,150],[180,170],[140,165],[100,150]],
        // South America  
        [[150,190],[180,185],[200,200],[220,240],[190,260],[160,240],[140,210]],
        // Europe
        [[380,100],[420,95],[450,100],[460,120],[440,130],[400,125],[380,115]],
        // Africa
        [[360,150],[400,145],[420,160],[410,200],[380,210],[360,190],[350,170]],
        // Asia
        [[480,110],[560,100],[620,110],[660,130],[650,160],[590,155],[520,140],[480,130]],
        // Australia
        [[660,230],[700,225],[720,240],[710,260],[680,255],[660,245]],
      ]
      
      continents.forEach(continent => {
        ctx.beginPath()
        ctx.moveTo(continent[0][0], continent[0][1])
        continent.slice(1).forEach(([x, y]) => ctx.lineTo(x, y))
        ctx.closePath()
        ctx.stroke()
        
        // Fill continents with very subtle color
        ctx.fillStyle = 'rgba(163, 230, 53, 0.03)'
        ctx.fill()
      })
    }

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw world map
      drawWorldMap()
      
      // Draw connection lines between some validators (sample for visual effect)
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.08)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([5, 5])
      
      // Draw connections to top 10 validators
      const topValidators = nodes
        .map((n, i) => ({ node: n, index: i }))
        .sort((a, b) => b.node.blocksProposed - a.node.blocksProposed)
        .slice(0, Math.min(10, nodes.length))
      
      topValidators.forEach(({node: source, index: i}, idx) => {
        // Connect to 3-5 other top validators
        const targets = topValidators
          .filter((_, targetIdx) => targetIdx !== idx && targetIdx < idx + 5)
          .slice(0, 3)
        
        targets.forEach(({node: target}) => {
          const pulse = Math.sin(frame * 0.02 + i * 0.5) * 0.3 + 0.3
          ctx.globalAlpha = pulse
          
          ctx.beginPath()
          ctx.moveTo(source.x, source.y)
          ctx.lineTo(target.x, target.y)
          ctx.stroke()
        })
      })
      
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // Draw validator nodes
      nodes.forEach((node, index) => {
        const size = Math.max(6, Math.min(18, Math.log(node.blocksProposed + 1) * 3.5))
        
        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2.5)
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.6)')
        gradient.addColorStop(0.5, 'rgba(163, 230, 53, 0.3)')
        gradient.addColorStop(1, 'rgba(163, 230, 53, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(node.x, node.y, size * 2.5, 0, Math.PI * 2)
        ctx.fill()
        
        // Node circle
        ctx.fillStyle = '#a3e635'
        ctx.beginPath()
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2)
        ctx.fill()
        
        // Inner circle (pulse)
        const pulse = Math.sin(frame * 0.05 + index * 0.3) * 0.3 + 0.7
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`
        ctx.beginPath()
        ctx.arc(node.x, node.y, size * 0.5, 0, Math.PI * 2)
        ctx.fill()
        
        // Block count label
        if (node.blocksProposed > 5) {
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 11px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
          ctx.shadowBlur = 4
          ctx.fillText(node.blocksProposed.toString(), node.x, node.y - size - 10)
          ctx.shadowBlur = 0
        }
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
        
        {/* Note about placeholder data */}
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/20 rounded-md">
          <p className="text-xs text-yellow-300">
            <span className="font-semibold">⚠️ Placeholder Locations:</span> Geographic positions are placeholder distribution across major data center regions. 
            Actual validator IP addresses require admin RPC methods (admin_peers) or consensus layer P2P access.
            See <code className="bg-black/40 px-1 py-0.5 rounded">VALIDATOR_IP_DISCOVERY.md</code> for methods to get real geographic data.
          </p>
        </div>
      </div>
    </div>
  )
}

