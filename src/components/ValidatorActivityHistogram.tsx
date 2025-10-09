'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface ValidatorActivityHistogramProps {
  validators: Array<{
    address: string
    blocksProposed: number
    percentage: number
  }>
}

export function ValidatorActivityHistogram({ validators }: ValidatorActivityHistogramProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || validators.length === 0) {
    return null
  }

  // Sort validators by blocks proposed (descending)
  const sortedValidators = [...validators].sort((a, b) => b.blocksProposed - a.blocksProposed)

  // Prepare data for Plotly
  const validatorLabels = sortedValidators.map((v, i) => 
    `#${i + 1}: ${v.address.slice(0, 6)}...${v.address.slice(-4)}`
  )
  const blockCounts = sortedValidators.map(v => v.blocksProposed)
  const percentages = sortedValidators.map(v => v.percentage)

  return (
    <div className="bg-gradient-to-br from-lime-900/10 to-black border border-lime-500/20 rounded-lg p-6 mt-8">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">Validator Activity Distribution</h3>
        <p className="text-sm text-lime-300">
          Real-time histogram of block production across {validators.length} validators
        </p>
      </div>

      <div className="bg-black/40 rounded-lg p-4">
        <Plot
          data={[
            {
              type: 'bar',
              x: validatorLabels,
              y: blockCounts,
              text: percentages.map(p => `${p.toFixed(1)}%`),
              textposition: 'outside',
              textfont: {
                color: '#a3e635',
                size: 10
              },
              marker: {
                color: blockCounts.map((count) => {
                  // Gradient from bright lime (most active) to dark lime/black (least active)
                  const intensity = count / Math.max(...blockCounts)
                  // Bright lime (#a3e635) to dark lime (#4d7c0f) to almost black
                  const r = Math.round(163 * intensity + 40 * (1 - intensity))
                  const g = Math.round(230 * intensity + 80 * (1 - intensity))
                  const b = Math.round(53 * intensity + 15 * (1 - intensity))
                  return `rgba(${r}, ${g}, ${b}, ${0.7 + intensity * 0.3})`
                }),
                line: {
                  color: '#a3e635',
                  width: 1.5
                }
              },
              hovertemplate: 
                '<b>%{x}</b><br>' +
                'Blocks: %{y}<br>' +
                'Share: %{text}<br>' +
                '<extra></extra>',
            }
          ]}
          layout={{
            title: {
              text: '',
              font: { color: '#ffffff' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0.2)',
            font: {
              color: '#a3e635',
              family: 'JetBrains Mono, monospace'
            },
            xaxis: {
              title: {
                text: 'Validators (sorted by activity)',
                font: { color: '#a3e635', size: 12 }
              },
              tickangle: -45,
              tickfont: { size: 9, color: '#86efac' },
              gridcolor: 'rgba(163, 230, 53, 0.1)',
              showgrid: true
            },
            yaxis: {
              title: {
                text: 'Blocks Proposed',
                font: { color: '#a3e635', size: 12 }
              },
              tickfont: { size: 10, color: '#86efac' },
              gridcolor: 'rgba(163, 230, 53, 0.1)',
              showgrid: true,
              zeroline: false
            },
            margin: { t: 40, b: 120, l: 60, r: 20 },
            height: 400,
            hovermode: 'closest',
            hoverlabel: {
              bgcolor: 'rgba(0, 0, 0, 0.9)',
              bordercolor: '#a3e635',
              font: { color: '#ffffff', size: 12 }
            },
            bargap: 0.1,
          }}
          config={{
            displayModeBar: false,
            responsive: true
          }}
          className="w-full"
          style={{ width: '100%' }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-lime-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-r from-lime-400 to-lime-900 rounded"></div>
            <span>Color intensity = block production volume</span>
          </div>
        </div>
        <div className="text-lime-300/60">
          Updates in real-time via WebSocket
        </div>
      </div>
    </div>
  )
}

