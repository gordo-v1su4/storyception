/**
 * Dynamic Hierarchical Layout Hook
 * 
 * Layouts story beats in a vertical column with branches spreading horizontally
 * Branches push subsequent beats down to avoid overlapping
 */

import { useCallback, useMemo } from 'react'
import type { Node } from '@xyflow/react'

interface LayoutOptions {
  nodeWidth: number
  nodeHeight: number
  beatGap: number                   // Gap between beat and next element
  branchHorizontalSpacing: number
  branchGap: number                 // Gap below branches before next beat
}

const defaultOptions: LayoutOptions = {
  nodeWidth: 320,
  nodeHeight: 400,                  // 4:5 aspect ratio
  beatGap: 60,                      // Gap below beat (to branches or next beat)
  branchHorizontalSpacing: 350,    // Space between branches
  branchGap: 80,                    // Gap below branches to next beat
}

/**
 * Calculate layout positions:
 * - Main beats flow vertically, centered
 * - Branches spread horizontally below their parent
 * - Next beat positioned BELOW branches (not overlapping)
 */
export function calculateHierarchyLayout(
  nodes: Node[],
  edges: { source: string; target: string }[],
  options: Partial<LayoutOptions> = {}
): Map<string, { x: number; y: number }> {
  const opts = { ...defaultOptions, ...options }
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) return positions

  // Separate beats from branches and other nodes
  const beatNodes = nodes.filter(n => n.id.startsWith('beat-'))
  
  // Build map of beat -> its branches (from edges)
  const beatToBranches = new Map<string, string[]>()
  edges.forEach(edge => {
    if (edge.target.startsWith('branch-')) {
      if (!beatToBranches.has(edge.source)) {
        beatToBranches.set(edge.source, [])
      }
      beatToBranches.get(edge.source)!.push(edge.target)
    }
  })

  // Center X position for main beat column
  const centerX = 0
  
  // Track current Y position as we layout
  let currentY = 0

  // Layout beats and their branches sequentially
  beatNodes.forEach((beat, idx) => {
    // Position this beat
    positions.set(beat.id, {
      x: centerX,
      y: currentY
    })

    // Check if this beat has branches
    const branchIds = beatToBranches.get(beat.id) || []
    
    if (branchIds.length > 0) {
      // Position branches below this beat
      const branchY = currentY + opts.nodeHeight + opts.beatGap
      const branchCount = branchIds.length
      
      branchIds.forEach((branchId, branchIdx) => {
        // Spread evenly: for 3 branches -> -1, 0, +1 multipliers
        const offsetMultiplier = branchIdx - (branchCount - 1) / 2
        const xOffset = offsetMultiplier * opts.branchHorizontalSpacing
        
        positions.set(branchId, {
          x: centerX + xOffset,
          y: branchY
        })
      })
      
      // Next beat starts BELOW the branches
      currentY = branchY + opts.nodeHeight + opts.branchGap
    } else {
      // No branches - next beat is just below this one
      currentY = currentY + opts.nodeHeight + opts.beatGap
    }
  })

  // Position teaser node if present
  const teaserNode = nodes.find(n => n.id === 'teaser-next')
  if (teaserNode) {
    positions.set('teaser-next', {
      x: centerX,
      y: currentY
    })
  }

  return positions
}

/**
 * Hook to apply hierarchical layout to React Flow nodes
 */
export function useHierarchyLayout(
  nodes: Node[],
  edges: { source: string; target: string }[],
  options: Partial<LayoutOptions> = {}
) {
  const positions = useMemo(() => {
    return calculateHierarchyLayout(nodes, edges, options)
  }, [nodes, edges, options])

  const getLayoutedNodes = useCallback((): Node[] => {
    return nodes.map(node => {
      const position = positions.get(node.id)
      if (position) {
        return {
          ...node,
          position,
        }
      }
      return node
    })
  }, [nodes, positions])

  return {
    positions,
    getLayoutedNodes,
  }
}
