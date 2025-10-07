'use client'

import { useEffect, useState, useMemo } from 'react'
import { getRealtimeManager } from '@/lib/realtime-websocket'

interface ValidatorLocation {
  address: string
  lat: number
  lon: number
  city: string
  country: string
  blocksProposed: number
  percentage: number
  ip_address?: string
  isReal: boolean
}

interface ValidatorWorldMapProps {
  validators: Array<{
    address: string
    blocksProposed: number
    percentage: number
  }>
}

// Convert lat/lon to SVG coordinates (Mercator projection simplified)
function latLonToSVG(lat: number, lon: number, width: number, height: number) {
  const x = (lon + 180) * (width / 360)
  const latRad = (lat * Math.PI) / 180
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  const y = height / 2 - (width * mercN) / (2 * Math.PI)
  return { x, y }
}

// Deterministic pseudo-random based on string (for consistent positioning)
function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(Math.sin(hash)) // 0 to 1
}

// Detect and resolve overlapping validator positions
// Performance: O(n²) for overlap detection, but memoized so only runs when validator set changes
// With typical n < 100 validators, this is negligible (~10ms)
function resolveOverlaps(
  validators: Array<{ address: string; lat: number; lon: number; percentage: number }>,
  width: number,
  height: number,
  overlapThreshold: number = 25 // pixels
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  
  // First pass: calculate raw positions - O(n)
  const rawPositions = validators.map(v => ({
    address: v.address,
    pos: latLonToSVG(v.lat, v.lon, width, height),
    percentage: v.percentage
  }))
  
  // Second pass: detect overlaps and create groups - O(n²)
  const processed = new Set<string>()
  const groups: Array<typeof rawPositions> = []
  
  rawPositions.forEach((validator, i) => {
    if (processed.has(validator.address)) return
    
    // Find all validators within overlap threshold
    const group = [validator]
    processed.add(validator.address)
    
    rawPositions.forEach((other, j) => {
      if (i !== j && !processed.has(other.address)) {
        const dx = validator.pos.x - other.pos.x
        const dy = validator.pos.y - other.pos.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < overlapThreshold) {
          group.push(other)
          processed.add(other.address)
        }
      }
    })
    
    groups.push(group)
  })
  
  // Third pass: arrange each group in a radial pattern - O(n)
  // This creates a "flower" pattern for overlapping validators
  groups.forEach(group => {
    if (group.length === 1) {
      // No overlap, use original position
      positions.set(group[0].address, group[0].pos)
    } else {
      // Multiple validators in same location - spread with randomization
      // Add random jitter to break geometric patterns
      group.sort((a, b) => b.percentage - a.percentage)
      
      // Calculate centroid
      const centroidX = group.reduce((sum, v) => sum + v.pos.x, 0) / group.length
      const centroidY = group.reduce((sum, v) => sum + v.pos.y, 0) / group.length
      
      // Largest validator near center with deterministic jitter (based on address)
      const centerJitterX = (seededRandom(group[0].address + 'x') - 0.5) * 8
      const centerJitterY = (seededRandom(group[0].address + 'y') - 0.5) * 8
      positions.set(group[0].address, { 
        x: centroidX + centerJitterX, 
        y: centroidY + centerJitterY 
      })
      
      // Others scattered with deterministic randomization (based on address)
      const baseRadius = 10 // Reduced from 20 to 10 (more packed)
      const randomAngleOffset = seededRandom(group[0].address + 'angle') * 2 * Math.PI
      
      group.slice(1).forEach((validator, index) => {
        // Deterministic jitter based on validator address
        const angleJitter = (seededRandom(validator.address + 'jitter') - 0.5) * 0.8 // ±0.4 radians
        const angle = randomAngleOffset + (index * 2 * Math.PI / (group.length - 1)) + angleJitter
        const radiusVariation = baseRadius + (seededRandom(validator.address + 'radius') - 0.5) * 6 // ±3px
        
        positions.set(validator.address, {
          x: centroidX + radiusVariation * Math.cos(angle),
          y: centroidY + radiusVariation * Math.sin(angle)
        })
      })
    }
  })
  
  return positions
}

// Geographic distribution for validators (placeholder until real IPs available)
const validatorRegions = [
  { city: 'New York', country: 'USA', lat: 40.7128, lon: -74.0060 },
  { city: 'San Francisco', country: 'USA', lat: 37.7749, lon: -122.4194 },
  { city: 'Chicago', country: 'USA', lat: 41.8781, lon: -87.6298 },
  { city: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
  { city: 'London', country: 'UK', lat: 51.5074, lon: -0.1278 },
  { city: 'Frankfurt', country: 'Germany', lat: 50.1109, lon: 8.6821 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041 },
  { city: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { city: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777 },
]

export function ValidatorWorldMap({ validators }: ValidatorWorldMapProps) {
  const [validatorLocations, setValidatorLocations] = useState<ValidatorLocation[]>([])
  const [hoveredValidator, setHoveredValidator] = useState<ValidatorLocation | null>(null)
  const [latestBlockMiner, setLatestBlockMiner] = useState<string | null>(null)

  useEffect(() => {
    if (!validators || validators.length === 0) return

    // Get real peer data from WebSocket manager cache
    const manager = getRealtimeManager()
    const realPeers = manager?.getCachedValidatorPeers() || []
    
    console.log(`🗺️ [ValidatorMap] Got ${realPeers.length} peers from cache`)
    
    if (realPeers.length > 0 && realPeers.some(p => p.isReal)) {
      // Use REAL peer data with GeoIP
      const locations = validators.map(validator => {
        // Find matching peer by coinbase address
        const peer = realPeers.find(p => 
          p.coinbase_address?.toLowerCase() === validator.address.toLowerCase()
        )
        
        if (peer && peer.isReal && peer.lat && peer.lon) {
          // Real GeoIP data available!
          return {
            address: validator.address,
            lat: peer.lat,
            lon: peer.lon,
            city: peer.city || 'Unknown',
            country: peer.country || 'Unknown',
            blocksProposed: validator.blocksProposed,
            percentage: validator.percentage,
            ip_address: peer.ip_address,
            isReal: true
          }
        } else {
          // Fallback to placeholder for this validator
          const region = validatorRegions[validators.indexOf(validator) % validatorRegions.length]
          return {
            address: validator.address,
            lat: region.lat,
            lon: region.lon,
            city: region.city,
            country: region.country,
            blocksProposed: validator.blocksProposed,
            percentage: validator.percentage,
            isReal: false
          }
        }
      })
      
      const realCount = locations.filter(l => l.isReal).length
      console.log(`🗺️ [ValidatorMap] Rendered ${realCount} real locations, ${locations.length - realCount} fallback`)
      setValidatorLocations(locations)
    } else {
      // No real data yet - use placeholder
      const locations = validators.map((validator, index) => {
        const region = validatorRegions[index % validatorRegions.length]
        return {
          address: validator.address,
          lat: region.lat,
          lon: region.lon,
          city: region.city,
          country: region.country,
          blocksProposed: validator.blocksProposed,
          percentage: validator.percentage,
          isReal: false
        }
      })
      
      console.log(`🗺️ [ValidatorMap] Rendered ${locations.length} fallback locations (waiting for GeoIP)`)
      setValidatorLocations(locations)
    }
  }, [validators])

  // Subscribe to validator peer updates (for GeoIP enrichment completion)
  useEffect(() => {
    const manager = getRealtimeManager()
    if (!manager) return

    const unsubscribe = manager.subscribe('validator-map-geoip', (update) => {
      if (update.type === 'validatorPeersUpdate') {
        // GeoIP enrichment completed! Re-fetch and update locations
        const enrichedPeers = manager.getCachedValidatorPeers() || []
        
        if (enrichedPeers.length > 0 && enrichedPeers.some(p => p.isReal)) {
          const locations = validators.map(validator => {
            const peer = enrichedPeers.find(p => 
              p.coinbase_address?.toLowerCase() === validator.address.toLowerCase()
            )
            
            if (peer && peer.isReal && peer.lat && peer.lon) {
              return {
                address: validator.address,
                lat: peer.lat,
                lon: peer.lon,
                city: peer.city || 'Unknown',
                country: peer.country || 'Unknown',
                blocksProposed: validator.blocksProposed,
                percentage: validator.percentage,
                ip_address: peer.ip_address,
                isReal: true
              }
            } else {
              const region = validatorRegions[validators.indexOf(validator) % validatorRegions.length]
              return {
                address: validator.address,
                lat: region.lat,
                lon: region.lon,
                city: region.city,
                country: region.country,
                blocksProposed: validator.blocksProposed,
                percentage: validator.percentage,
                isReal: false
              }
            }
          })
          
          const realCount = locations.filter(l => l.isReal).length
          console.log(`🗺️ [ValidatorMap] GeoIP enriched: ${realCount} real locations`)
          setValidatorLocations(locations)
        }
      }
      
      // Also handle block flash
      if (update.type === 'newBlock' && update.data?.miner) {
        const minerAddress = update.data.miner.toLowerCase()
        setLatestBlockMiner(minerAddress)
        
        setTimeout(() => {
          setLatestBlockMiner(null)
        }, 1200)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [validators])

  const mapWidth = 1000
  const mapHeight = 500

  // Calculate adjusted positions to resolve overlaps (MEMOIZED - only recomputes when validators change)
  const adjustedPositions = useMemo(() => {
    console.log(`🔄 [ValidatorMap] Computing overlap resolution for ${validatorLocations.length} validators`)
    return resolveOverlaps(
      validatorLocations.map(v => ({
        address: v.address,
        lat: v.lat,
        lon: v.lon,
        percentage: v.percentage
      })),
      mapWidth,
      mapHeight
    )
  }, [validatorLocations])

  return (
    <div className="bg-gradient-to-br from-lime-900/10 to-black border border-lime-500/20 rounded-lg p-6 mb-8">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Validator Geospatial Distribution</h3>
            <p className="text-sm text-lime-300">
              {validators.length} active proposers • Real-time updates
            </p>
          </div>
          <div className="text-xs text-lime-400 bg-lime-900/20 px-3 py-1 rounded-full border border-lime-500/30">
            Full mesh topology
          </div>
        </div>
      </div>
      
      <div className="relative bg-black/60 rounded-lg border border-lime-500/10 overflow-hidden">
        {/* Use image overlay of world map for proper geography */}
        <div className="relative w-full" style={{ paddingBottom: '45%' }}>
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight * 0.85}`}
            className="absolute inset-0 w-full h-full"
          >
            {/* CSS Animation for red flash when validator proposes block */}
            <style>{`
              @keyframes flashRed {
                0% { fill: #a3e635; }
                20% { fill: #fca5a5; }
                40% { fill: #ef4444; }
                60% { fill: #fca5a5; }
                80% { fill: #ef4444; }
                100% { fill: #a3e635; }
              }
              @keyframes pulseRedGlow {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.9; }
              }
              .flash-red-validator {
                animation: flashRed 1s ease-in-out;
              }
              .flash-red-glow {
                animation: pulseRedGlow 1s ease-in-out;
              }
            `}</style>
            
            {/* Detailed world map background - cropped to exclude Antarctica */}
            <image 
              href="https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg"
              x="0" 
              y="-20"
              width={mapWidth} 
              height={mapHeight * 0.9}
              opacity="0.35"
              preserveAspectRatio="xMidYMid slice"
              style={{ filter: 'brightness(0.6) contrast(1.3)' }}
              clipPath="url(#cropAntarctica)"
            />
            
            {/* Clip path to remove Antarctica */}
            <defs>
              <clipPath id="cropAntarctica">
                <rect x="0" y="0" width={mapWidth} height={mapHeight * 0.75} />
              </clipPath>
            </defs>
            
            {/* Overlay to enhance continents */}
            <rect
              x="0"
              y="0"
              width={mapWidth}
              height={mapHeight}
              fill="url(#mapOverlay)"
              opacity="0.4"
            />
            <defs>
              <radialGradient id="mapOverlay">
                <stop offset="0%" stopColor="rgba(163, 230, 53, 0.05)" />
                <stop offset="100%" stopColor="rgba(0, 0, 0, 0.3)" />
              </radialGradient>
            </defs>
            
          {/* Connection lines (subtle, sample connections) */}
          <g id="connections" opacity="0.3">
            {validatorLocations.slice(0, 20).map((source, i) => {
              // Use adjusted positions for connections too
              const sourcePos = adjustedPositions.get(source.address) || latLonToSVG(source.lat, source.lon, mapWidth, mapHeight)
              // Connect to next 2-3 validators
              return validatorLocations.slice(i + 1, i + 3).map((target, j) => {
                const targetPos = adjustedPositions.get(target.address) || latLonToSVG(target.lat, target.lon, mapWidth, mapHeight)
                return (
                  <line
                    key={`conn-${i}-${j}`}
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke="rgba(163, 230, 53, 0.15)"
                    strokeWidth="0.5"
                    strokeDasharray="3,3"
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values="0.1;0.3;0.1"
                      dur={`${2 + i * 0.1}s`}
                      repeatCount="indefinite"
                    />
                  </line>
                )
              })
            })}
          </g>

          {/* Validator nodes */}
          <g id="validators">
            {validatorLocations.map((validator, index) => {
              // Use adjusted position to avoid overlaps
              const pos = adjustedPositions.get(validator.address) || latLonToSVG(validator.lat, validator.lon, mapWidth, mapHeight)
              // Log-proportional size: size ~ log(1 + activity_share)
              const percentage = validator.percentage || 0
              const size = Math.max(3, Math.min(12, 3 + Math.log(1 + percentage) * 1.5))
              
              return (
                <g key={validator.address}>
                  {/* Very subtle red glow (barely visible) */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size * 1.5}
                    fill="url(#red-glow)"
                    opacity="0.15"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.1;0.2;0.1"
                      dur="4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  
                  {/* Active validator intense glow (when minted latest block) */}
                  {validator.address.toLowerCase() === latestBlockMiner && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={size * 3}
                      fill="url(#red-flash)"
                      opacity="0.8"
                      className="flash-red-glow"
                    />
                  )}
                  
                  {/* Define red glow gradients (shared) */}
                  {index === 0 && (
                    <defs>
                      <radialGradient id="red-glow">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                        <stop offset="50%" stopColor="#dc2626" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#991b1b" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="red-flash">
                        <stop offset="0%" stopColor="#fca5a5" stopOpacity="1" />
                        <stop offset="50%" stopColor="#ef4444" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                  )}
                  
                  {/* Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size}
                    fill={validator.address.toLowerCase() === latestBlockMiner ? "#fca5a5" : "#a3e635"}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    cursor="pointer"
                    onMouseEnter={() => setHoveredValidator(validator)}
                    onMouseLeave={() => setHoveredValidator(null)}
                    className={validator.address.toLowerCase() === latestBlockMiner ? 'flash-red-validator' : ''}
                    style={{ 
                      transition: 'fill 0.3s ease-in-out',
                      filter: validator.address.toLowerCase() === latestBlockMiner ? 'drop-shadow(0 0 6px #ef4444)' : 'none'
                    }}
                  />
                  
                  {/* Subtle inner highlight */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size * 0.3}
                    fill="#ffffff"
                    opacity="0.5"
                  />
                </g>
              )
            })}
          </g>
        </svg>
        </div>

        {/* Hover tooltip */}
        {hoveredValidator && (
          <div className="absolute top-4 left-4 bg-black/90 border border-lime-500/50 rounded-lg p-4 z-10 min-w-[250px]">
            <div className="text-xs text-lime-400 mb-1">Validator</div>
            <div className="font-mono text-sm text-white mb-2">
              {hoveredValidator.address.slice(0, 10)}...{hoveredValidator.address.slice(-8)}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-lime-300">IP Address:</span>
                <span className="text-white font-mono">
                  {hoveredValidator.ip_address ? hoveredValidator.ip_address.split(':')[0] : 'Waiting...'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-lime-300">Location:</span>
                <span className="text-white">{hoveredValidator.city}, {hoveredValidator.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-lime-300">Blocks Proposed:</span>
                <span className="text-white font-bold">{hoveredValidator.blocksProposed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-lime-300">Activity Share:</span>
                <span className="text-white font-bold">{hoveredValidator.percentage.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-lime-400/60 mt-2">
                <span>Coordinates:</span>
                <span>{hoveredValidator.lat.toFixed(2)}°, {hoveredValidator.lon.toFixed(2)}°</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

