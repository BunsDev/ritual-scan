'use client'

import { useEffect, useState } from 'react'

interface ValidatorLocation {
  address: string
  lat: number
  lon: number
  city: string
  country: string
  blocksProposed: number
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

  useEffect(() => {
    if (!validators || validators.length === 0) return

    const locations = validators.map((validator, index) => {
      const region = validatorRegions[index % validatorRegions.length]
      return {
        address: validator.address,
        lat: region.lat,
        lon: region.lon,
        city: region.city,
        country: region.country,
        blocksProposed: validator.blocksProposed
      }
    })

    setValidatorLocations(locations)
  }, [validators])

  const mapWidth = 1000
  const mapHeight = 500

  return (
    <div className="bg-gradient-to-br from-lime-900/10 to-black border border-lime-500/20 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Validator Network - Global Distribution</h3>
          <p className="text-sm text-lime-300">
            {validators.length} active validators across {validatorRegions.length} regions
          </p>
        </div>
        <div className="text-xs text-lime-400 bg-lime-900/20 px-3 py-1 rounded-full border border-lime-500/30">
          {validators.length} nodes • Full mesh topology
        </div>
      </div>
      
      <div className="relative bg-black/60 rounded-lg border border-lime-500/10 overflow-hidden">
        {/* Use image overlay of world map for proper geography */}
        <div className="relative w-full" style={{ paddingBottom: '50%' }}>
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="absolute inset-0 w-full h-full"
          >
            {/* Detailed world map background */}
            <image 
              href="https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg"
              x="0" 
              y="0" 
              width={mapWidth} 
              height={mapHeight}
              opacity="0.35"
              preserveAspectRatio="xMidYMid slice"
              style={{ filter: 'brightness(0.6) contrast(1.3)' }}
            />
            
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
            
            {/* Grid lines for lat/lon reference */}
            <g stroke="rgba(163, 230, 53, 0.15)" strokeWidth="0.8" opacity="0.6">
              {/* Latitude lines */}
              {[100, 200, 300, 400].map(y => (
                <line key={`lat-${y}`} x1="0" y1={y} x2={mapWidth} y2={y} strokeDasharray="3,3" />
              ))}
              {/* Longitude lines */}
              {[200, 400, 600, 800].map(x => (
                <line key={`lon-${x}`} x1={x} y1="0" x2={x} y2={mapHeight} strokeDasharray="3,3" />
              ))}
            </g>

          {/* Connection lines (subtle, sample connections) */}
          <g id="connections" opacity="0.3">
            {validatorLocations.slice(0, 20).map((source, i) => {
              const sourcePos = latLonToSVG(source.lat, source.lon, mapWidth, mapHeight)
              // Connect to next 2-3 validators
              return validatorLocations.slice(i + 1, i + 3).map((target, j) => {
                const targetPos = latLonToSVG(target.lat, target.lon, mapWidth, mapHeight)
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
              const pos = latLonToSVG(validator.lat, validator.lon, mapWidth, mapHeight)
              const size = Math.max(4, Math.min(12, Math.log(validator.blocksProposed + 1) * 2.5))
              
              return (
                <g key={validator.address}>
                  {/* Glow */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size * 3}
                    fill={`url(#glow-${index})`}
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      values={`${size * 2.5};${size * 3.5};${size * 2.5}`}
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  
                  {/* Define gradient for this node */}
                  <defs>
                    <radialGradient id={`glow-${index}`}>
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#a3e635" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  
                  {/* Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size}
                    fill="#a3e635"
                    stroke="#ffffff"
                    strokeWidth="1"
                    cursor="pointer"
                    onMouseEnter={() => setHoveredValidator(validator)}
                    onMouseLeave={() => setHoveredValidator(null)}
                  />
                  
                  {/* Inner pulse */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size * 0.5}
                    fill="#ffffff"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.5;1;0.5"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  
                  {/* Block count label */}
                  {validator.blocksProposed > 5 && (
                    <text
                      x={pos.x}
                      y={pos.y - size - 8}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      style={{ textShadow: '0 0 3px rgba(0,0,0,0.8)' }}
                    >
                      {validator.blocksProposed}
                    </text>
                  )}
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
                <span className="text-lime-300">Location:</span>
                <span className="text-white">{hoveredValidator.city}, {hoveredValidator.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-lime-300">Blocks Proposed:</span>
                <span className="text-white font-bold">{hoveredValidator.blocksProposed}</span>
              </div>
              <div className="flex justify-between text-lime-400/60 mt-2">
                <span>Coordinates:</span>
                <span>{hoveredValidator.lat.toFixed(2)}°, {hoveredValidator.lon.toFixed(2)}°</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-lime-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-lime-400 shadow-lg shadow-lime-400/50"></div>
            <span>Validator node (size = blocks proposed)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-0.5 bg-lime-400/20"></div>
            <span>P2P connections (Summit BFT)</span>
          </div>
        </div>
        <div className="text-lime-300/60">
          Hover over nodes for details
        </div>
      </div>
      
      {/* Warning about placeholder data */}
      <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/20 rounded-md">
        <p className="text-xs text-yellow-300">
          <span className="font-semibold">⚠️ Placeholder Distribution:</span> Geographic positions use typical datacenter regions. 
          Real validator IPs require <code className="bg-black/40 px-1 rounded">admin_peers</code> RPC method or consensus layer access.
          See <code className="bg-black/40 px-1 rounded">VALIDATOR_IP_DISCOVERY.md</code> for implementation details.
        </p>
      </div>
    </div>
  )
}

