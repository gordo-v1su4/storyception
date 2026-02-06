"use client"

import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  MarkerType,
  Panel,
  Position,
  ConnectionLineType,
  ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { StoryBeatNode } from "./nodes/story-beat-node"
import { BranchNode } from "./nodes/branch-node"
// Branch generation is now on-demand via /api/story/branches
import type { StoryBeat, BranchOption } from "@/lib/types"
import { motion } from "framer-motion"
import { ArrowRight, ArrowDown, Move, RotateCcw, Lock, Unlock, Wand2, Eye, EyeOff } from "lucide-react"
import { getBeatHexColor, BRANCH_COLORS } from "@/lib/colors"
import { calculateHierarchyLayout } from "@/lib/use-hierarchy-layout"

// Custom node types
const nodeTypes = {
  storyBeat: StoryBeatNode,
  branch: BranchNode,
}

type LayoutDirection = "horizontal" | "vertical" | "free"

interface FlowCanvasProps {
  beats: StoryBeat[]
  selectedBeatId: number | null
  onSelectBeat: (id: number | null) => void
  onUpdateBeat: (id: number, updates: Partial<StoryBeat>) => void
  onAddBeat?: (beat: StoryBeat, afterBeatId: number) => void
  referenceImageUrl?: string | null
  sessionId?: string | null
  archetypeIndex?: number
  storyTitle?: string
  storyLogline?: string
}

// Default edge options - bezier curves with cyan arrows
const defaultEdgeOptions = {
  type: 'default', // 'default' = bezier curves
  animated: false,
  style: {
    strokeWidth: 3,
    stroke: '#22d3ee',
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: '#22d3ee',
  },
}

// Inner component that has access to useReactFlow
function FlowCanvasInner({ beats, selectedBeatId, onSelectBeat, onUpdateBeat, onAddBeat, referenceImageUrl, sessionId, archetypeIndex = 0, storyTitle = '', storyLogline = '' }: FlowCanvasProps) {
  const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set())
  const [layout, setLayout] = useState<LayoutDirection>("vertical") // Vertical = top-to-bottom flow
  const [locked, setLocked] = useState(false)
  const [autoLayout, setAutoLayout] = useState(true)
  const [revealedBeats, setRevealedBeats] = useState(1) // Progressive reveal - start with 1 beat
  const [generatingBeatId, setGeneratingBeatId] = useState<number | null>(null) // Track which beat is generating images
  
  const [selectedBranchPaths, setSelectedBranchPaths] = useState<Map<string, BranchOption>>(new Map())
  const { fitView, setCenter, getZoom } = useReactFlow()
  const layoutTimeoutRef = useRef<NodeJS.Timeout>()
  const isInitialMount = useRef(true) // Track first render to only fitView once
  const prevRevealedBeats = useRef(revealedBeats) // Track previous to detect reveals

  // Calculate node positions based on layout (fallback for manual positioning)
  const getNodePosition = useCallback((idx: number, level: number = 0) => {
    const HORIZONTAL_SPACING = 450
    const VERTICAL_SPACING = 350
    const BRANCH_OFFSET = 220

    switch (layout) {
      case "horizontal":
        return { 
          x: idx * HORIZONTAL_SPACING, 
          y: 200 + (level * BRANCH_OFFSET) 
        }
      case "vertical":
        return { 
          x: 400 + (level * BRANCH_OFFSET), 
          y: idx * VERTICAL_SPACING 
        }
      case "free":
        const cols = Math.ceil(Math.sqrt(beats.length))
        const row = Math.floor(idx / cols)
        const col = idx % cols
        return { 
          x: col * HORIZONTAL_SPACING, 
          y: row * VERTICAL_SPACING + (level * BRANCH_OFFSET) 
        }
      default:
        return { x: idx * HORIZONTAL_SPACING, y: 200 }
    }
  }, [layout, beats.length])

  // Toggle branch expansion
  const toggleBranch = useCallback((beatId: number) => {
    setExpandedBranches(prev => {
      const next = new Set(prev)
      if (next.has(beatId)) {
        next.delete(beatId)
      } else {
        next.add(beatId)
      }
      return next
    })
  }, [])

  // Generate keyframes for a beat using the on-demand image generation API
  const generateKeyframes = useCallback(async (beat: StoryBeat): Promise<string[] | null> => {
    if (!sessionId || !referenceImageUrl) {
      console.log('⚠️ No session ID or reference image, skipping keyframe generation')
      return null
    }

    try {
      console.log(`🎬 Generating keyframes for beat: ${beat.label}`)
      
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          beatId: beat.beatId || `beat-${beat.id}`,
          referenceImageUrl,
          beatLabel: beat.label,
          beatDescription: beat.desc || beat.generatedIdea || '',
          beatDuration: beat.duration,
          beatPercent: beat.percentOfTotal,
        }),
      })

      if (!response.ok) {
        console.error('Image generation failed:', response.status)
        return null
      }

      const result = await response.json()
      
      if (result.success && result.keyframeUrls?.length > 0) {
        console.log(`✅ Got ${result.keyframeUrls.length} keyframe URLs`)
        return result.keyframeUrls
      }
      
      console.log('⚠️ No keyframes in response')
      return null
    } catch (error) {
      console.error('Keyframe generation error:', error)
      return null
    }
  }, [sessionId, referenceImageUrl])

  // Handle branch selection - generate images for next beat, then reveal
  const handleSelectBranch = useCallback(async (beatId: number, branch: BranchOption) => {
    const pathKey = `${beatId}-${branch.id}`
    
    // 1. Update the current beat to show branch selection
    onUpdateBeat(beatId, {
      selectedBranchId: branch.id,
      branches: beats.find(b => b.id === beatId)?.branches?.map(b => ({
        ...b,
        selected: b.id === branch.id
      }))
    })
    
    setSelectedBranchPaths(prev => new Map(prev).set(pathKey, branch))
    
    // 2. Find the next beat
    const beatIndex = beats.findIndex(b => b.id === beatId)
    if (beatIndex >= 0 && beatIndex + 1 < beats.length) {
      const nextBeat = beats[beatIndex + 1]
      
      // 3. Mark next beat as generating
      setGeneratingBeatId(nextBeat.id)
      onUpdateBeat(nextBeat.id, { status: 'generating' })
      
      // 4. Generate keyframes for the next beat
      const keyframes = await generateKeyframes(nextBeat)
      
      // 5. Update the next beat with generated frames
      if (keyframes && keyframes.length > 0) {
        onUpdateBeat(nextBeat.id, { 
          frames: keyframes,
          status: 'ready'
        })
      } else {
        // Even if generation fails, mark as ready so user can proceed
        onUpdateBeat(nextBeat.id, { status: 'ready' })
      }
      
      setGeneratingBeatId(null)
      
      // 6. Reveal the next beat
      setRevealedBeats(prev => Math.max(prev, beatIndex + 2))
    }
  }, [beats, onUpdateBeat, generateKeyframes])

  // Convert beats to React Flow nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (beats.length === 0) return { nodes: [], edges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []
    
    // Only show revealed beats (progressive reveal)
    const visibleBeats = beats.slice(0, revealedBeats)
    const hasMoreBeats = revealedBeats < beats.length
    
    // First pass: create all nodes with placeholder positions
    visibleBeats.forEach((beat, idx) => {
      const position = getNodePosition(idx) // Will be overridden by hierarchy layout
      const isExpanded = expandedBranches.has(beat.id)
      const hasSelectedBranch = beat.branches?.some(b => b.selected)
      const showBranches = isExpanded || hasSelectedBranch // Show branches if expanded OR if one is selected
      
      // Main beat node
      nodes.push({
        id: `beat-${beat.id}`,
        type: "storyBeat",
        position,
        draggable: !locked,
        data: {
          beat,
          isSelected: beat.id === selectedBeatId,
          isExpanded,
          layout,
          onSelect: () => onSelectBeat(beat.id),
          onToggleBranch: () => {
            if (!beat.branches || beat.branches.length === 0) {
              // Generate branches on-demand via Claude API
              if (sessionId) {
                const prevBeats = beats.slice(0, idx).map(b => ({
                  label: b.label,
                  description: b.desc || b.generatedIdea || '',
                  selectedBranch: b.branches?.find(br => br.selected)?.title,
                }))
                fetch('/api/story/branches', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sessionId,
                    beatId: beat.beatId || `beat-${beat.id}`,
                    beatLabel: beat.label,
                    beatDescription: beat.desc || beat.generatedIdea || '',
                    archetypeIndex,
                    archetypeBeatId: beat.beatId?.split('-').pop() || '',
                    storyTitle,
                    storyLogline,
                    previousBeats: prevBeats,
                  }),
                })
                  .then(r => r.json())
                  .then(data => {
                    if (data.success && data.branches?.length > 0) {
                      const branches: BranchOption[] = data.branches.map((b: { id: number; title: string; description: string; type: string; duration: string }) => ({
                        id: b.id,
                        title: b.title,
                        desc: b.description,
                        type: b.type,
                        duration: b.duration,
                        selected: false,
                      }))
                      onUpdateBeat(beat.id, { branches })
                    }
                  })
                  .catch(err => console.error('Branch gen failed:', err))
              }
            }
            toggleBranch(beat.id)
          },
          onUpdateBeat: (updates: Partial<StoryBeat>) => onUpdateBeat(beat.id, updates),
        },
      })

      // EDGE: Connect to next beat
      // If a branch is selected, connect FROM the selected branch TO the next beat
      // Otherwise, connect beat to beat (when no branches expanded/selected)
      if (idx < visibleBeats.length - 1) {
        const nextBeat = visibleBeats[idx + 1]
        const selectedBranch = beat.branches?.find(b => b.selected)
        const beatColor = getBeatHexColor(idx, beats.length)
        
        // Only draw beat-to-beat edge if NO branch is selected for this beat
        if (!selectedBranch) {
          edges.push({
            id: `edge-${beat.id}-${nextBeat.id}`,
            source: `beat-${beat.id}`,
            sourceHandle: undefined,
            target: `beat-${nextBeat.id}`,
            targetHandle: undefined,
            type: 'default', // Bezier curve
            animated: false,
            style: {
              strokeWidth: 3,
              stroke: beatColor,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
              color: beatColor,
            },
          })
        }
      }

      // Branch nodes - show when expanded OR when a branch is selected
      if (beat.branches && beat.branches.length > 0 && showBranches) {
        const branchCount = beat.branches.length
        const hasBranchSelected = beat.branches.some(b => b.selected)
        
        // Branch colors for A, B, C
        const branchColorKeys = ['a', 'b', 'c'] as const
        
        beat.branches.forEach((branch, branchIdx) => {
          // Better spacing: spread branches out more, stagger vertically
          const horizontalOffset = 200  // Distance from parent beat
          const verticalSpread = 280    // Vertical distance between branches
          const spreadFactor = (branchIdx - (branchCount - 1) / 2) * verticalSpread
          
          const branchPosition = layout === "horizontal" 
            ? { 
                x: position.x + horizontalOffset + (branchIdx * 40), // Slight horizontal stagger
                y: position.y + 300 + spreadFactor 
              }
            : { 
                x: position.x + 300 + spreadFactor, 
                y: position.y + horizontalOffset + (branchIdx * 40)
              }
          
          const branchNodeId = `branch-${beat.id}-${branch.id}`
          const branchColor = BRANCH_COLORS[branchColorKeys[branchIdx % 3]]
          
          nodes.push({
            id: branchNodeId,
            type: "branch",
            position: branchPosition,
            draggable: !locked,
            data: {
              branch,
              parentBeatId: beat.id,
              branchIndex: branchIdx,  // Pass the index for color selection
              isSelected: branch.selected,
              isLocked: hasBranchSelected && !branch.selected,  // Lock other branches after selection
              layout,
              onSelect: () => handleSelectBranch(beat.id, branch),
            },
          })

          // EDGE: Connect beat to branch with color-coded arrow
          edges.push({
            id: `branch-edge-${beat.id}-${branch.id}`,
            source: `beat-${beat.id}`,
            sourceHandle: 'branch',
            target: branchNodeId,
            type: 'default', // Bezier curve
            animated: !hasBranchSelected || branch.selected,
            style: {
              strokeWidth: branch.selected ? 4 : 2,
              stroke: branch.selected 
                ? branchColor.hex 
                : hasBranchSelected 
                  ? '#3f3f46' // zinc-700 for locked
                  : branchColor.hex,
              strokeDasharray: branch.selected ? undefined : '8 4',
              opacity: hasBranchSelected && !branch.selected ? 0.3 : 1,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: branch.selected 
                ? branchColor.hex 
                : hasBranchSelected 
                  ? '#3f3f46'
                  : branchColor.hex,
            },
          })

          // EDGE: Connect SELECTED branch to NEXT beat
          // Skip if next beat is the first in the list (idx 0 has no target handle)
          if (branch.selected && idx < visibleBeats.length - 1) {
            const nextBeat = visibleBeats[idx + 1]
            // Only create edge if it's not pointing to the first beat in visible list
            edges.push({
              id: `selected-branch-${beat.id}-to-beat-${nextBeat.id}`,
              source: branchNodeId,
              target: `beat-${nextBeat.id}`,
              type: 'default',
              animated: true,
              style: {
                strokeWidth: 4,
                stroke: branchColor.hex,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: branchColor.hex,
              },
            })
          }
        })
      }
    })

    // Add "teaser" node if there are more beats to reveal
    if (hasMoreBeats && visibleBeats.length > 0) {
      const lastVisibleBeat = visibleBeats[visibleBeats.length - 1]
      const nextBeat = beats[revealedBeats]
      const remainingBeats = beats.length - revealedBeats
      
      // Teaser node - position will be set by layout algorithm
      nodes.push({
        id: 'teaser-next',
        type: 'default',
        position: { x: 0, y: 0 }, // Will be overwritten by layout
        draggable: false,
        selectable: false,
        data: {
          label: `⬇ ${nextBeat?.label || 'Next'} (${remainingBeats} more)`,
        },
        style: {
          background: '#18181b',
          border: '2px dashed #3f3f46',
          borderRadius: '4px',
          width: 280,
          padding: '16px',
          fontSize: '11px',
          color: '#71717a',
          textAlign: 'center',
        },
      })

      // Connect to teaser from selected branch if exists, otherwise from beat
      const selectedBranch = lastVisibleBeat.branches?.find(b => b.selected)
      const sourceNode = selectedBranch 
        ? `branch-${lastVisibleBeat.id}-${selectedBranch.id}`
        : `beat-${lastVisibleBeat.id}`
      
      edges.push({
        id: `edge-to-teaser`,
        source: sourceNode,
        target: 'teaser-next',
        type: 'default',
        animated: true,
        style: {
          strokeWidth: 2,
          stroke: '#3f3f46',
          strokeDasharray: '8 4',
        },
      })
    }

    // Apply hierarchical layout if autoLayout is enabled
    if (autoLayout && nodes.length > 0) {
      const layoutOptions = {
        nodeWidth: 320,
        nodeHeight: 400,                // 4:5 aspect ratio
        beatGap: 60,                    // Gap below beat
        branchHorizontalSpacing: 350,   // Space between branches
        branchGap: 80,                  // Gap below branches to next beat
      }
      
      const positions = calculateHierarchyLayout(nodes, edges, layoutOptions)
      
      // Apply calculated positions to nodes
      nodes.forEach(node => {
        const pos = positions.get(node.id)
        if (pos) {
          node.position = pos
        }
      })
    }

    return { nodes, edges }
  }, [beats, selectedBeatId, expandedBranches, layout, locked, autoLayout, revealedBeats, getNodePosition, onSelectBeat, onUpdateBeat, toggleBranch, handleSelectBranch])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes when beats or layout changes
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    
    // Only fit view on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current)
      }
      layoutTimeoutRef.current = setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 })
      }, 100)
    }
    
    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current)
      }
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView])

  // Camera follow: pan to newly revealed beat when revealedBeats increases
  useEffect(() => {
    if (prevRevealedBeats.current < revealedBeats && revealedBeats <= beats.length) {
      // Find the newly revealed beat node position
      const newBeatNode = initialNodes.find(n => n.id === `beat-${revealedBeats}`)
      if (newBeatNode) {
        const currentZoom = getZoom()
        // Center on the new beat with a slight delay to let layout settle
        setTimeout(() => {
          setCenter(
            newBeatNode.position.x + 160, // Center of 320px wide node
            newBeatNode.position.y + 200, // Center of 400px tall node
            { zoom: Math.max(currentZoom, 0.7), duration: 400 }
          )
        }, 150)
      }
    }
    prevRevealedBeats.current = revealedBeats
  }, [revealedBeats, beats.length, initialNodes, setCenter, getZoom])

  // Generate keyframes for first beat on initial load
  const hasGeneratedFirstBeat = useRef(false)
  useEffect(() => {
    if (beats.length > 0 && !hasGeneratedFirstBeat.current && sessionId) {
      const firstBeat = beats[0]
      // Only generate if the first beat doesn't have frames yet
      if (!firstBeat.frames || firstBeat.frames.length === 0) {
        hasGeneratedFirstBeat.current = true
        console.log('🎬 Auto-generating keyframes for opening beat...')
        
        // Mark as generating and trigger generation
        setGeneratingBeatId(firstBeat.id)
        onUpdateBeat(firstBeat.id, { status: 'generating' })
        
        generateKeyframes(firstBeat).then(keyframes => {
          if (keyframes && keyframes.length > 0) {
            onUpdateBeat(firstBeat.id, { frames: keyframes, status: 'ready' })
            console.log('✅ Opening beat keyframes ready')
          } else {
            onUpdateBeat(firstBeat.id, { status: 'ready' })
          }
          setGeneratingBeatId(null)
        })
      } else {
        hasGeneratedFirstBeat.current = true // Already has frames
      }
    }
  }, [beats, sessionId, generateKeyframes, onUpdateBeat])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 3, stroke: '#22d3ee' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#22d3ee',
        },
      }, eds))
    },
    [setEdges]
  )

  // MiniMap uses the same unified colors
  const getMiniMapBeatColor = (index: number, total: number) => {
    return getBeatHexColor(index, total)
  }

  const resetView = useCallback(() => {
    setNodes([...initialNodes])
    setEdges([...initialEdges])
  }, [initialNodes, initialEdges, setNodes, setEdges])

  if (beats.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-100 mb-2">No Story Yet</h2>
          <p className="text-sm text-zinc-500">Create a new story to see the flow</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 relative bg-black">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ strokeWidth: 3, stroke: '#22d3ee' }}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={!locked}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnScroll={true}
        selectionOnDrag={false}
        panOnDrag={[1, 2]}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          color="#3f3f46" // zinc-700
          gap={24} 
          size={2}
          style={{ backgroundColor: '#09090b' }} // zinc-950 / black
        />
        <Controls
          className="!bg-zinc-900 !border-zinc-700 !rounded-lg !shadow-xl [&>button]:!bg-zinc-800 [&>button]:!border-zinc-600 [&>button]:hover:!bg-zinc-700 [&>button>svg]:!fill-zinc-300"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-zinc-900 !border-zinc-700 !rounded-lg"
          nodeColor={(node) => {
            if (node.type === "branch") {
              // Get branch index from node id
              const match = node.id.match(/branch-\d+-(\d+)/)
              const branchIdx = match ? parseInt(match[1]) % 3 : 0
              return ['#22d3ee', '#2dd4bf', '#facc15'][branchIdx] // A, B, C colors
            }
            const beatIndex = beats.findIndex((b) => `beat-${b.id}` === node.id)
            return getMiniMapBeatColor(beatIndex, beats.length)
          }}
          maskColor="rgba(9, 9, 11, 0.85)"
          style={{ height: 100, width: 150 }}
        />
        
        {/* Layout Controls Panel */}
        <Panel position="top-left" className="!m-4">
          <div className="bg-zinc-900/95 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
            {/* Title */}
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Story Flow
                </span>
                <span className="text-xs text-cyan-400 font-mono">
                  {revealedBeats}/{beats.length} beats
                </span>
              </div>
            </div>
            
            {/* Layout Toggle */}
            <div className="p-3 flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLayout("horizontal")}
                className={`p-2.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${
                  layout === "horizontal"
                    ? "bg-cyan-500 text-zinc-950 shadow-lg shadow-cyan-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
                title="Horizontal Layout (Left to Right)"
              >
                <ArrowRight size={14} />
                <span>L→R</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLayout("vertical")}
                className={`p-2.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${
                  layout === "vertical"
                    ? "bg-cyan-500 text-zinc-950 shadow-lg shadow-cyan-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
                title="Vertical Layout (Top to Bottom)"
              >
                <ArrowDown size={14} />
                <span>T→B</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLayout("free")}
                className={`p-2.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${
                  layout === "free"
                    ? "bg-cyan-500 text-zinc-950 shadow-lg shadow-cyan-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
                title="Free Layout"
              >
                <Move size={14} />
                <span>Free</span>
              </motion.button>

              <div className="w-px bg-zinc-700 mx-1" />

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAutoLayout(!autoLayout)}
                className={`p-2.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${
                  autoLayout
                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
                title={autoLayout ? "Auto-layout ON (no overlaps)" : "Auto-layout OFF (manual positioning)"}
              >
                <Wand2 size={14} />
                <span>Auto</span>
              </motion.button>

              <div className="w-px bg-zinc-700 mx-1" />

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLocked(!locked)}
                className={`p-2.5 rounded-lg transition-all ${
                  locked
                    ? "bg-amber-500 text-zinc-950"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
                title={locked ? "Unlock nodes" : "Lock nodes in place"}
              >
                {locked ? <Lock size={14} /> : <Unlock size={14} />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetView}
                className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-all"
                title="Reset View"
              >
                <RotateCcw size={14} />
              </motion.button>

              <div className="w-px bg-zinc-700 mx-1" />

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRevealedBeats(revealedBeats === beats.length ? 1 : beats.length)}
                className={`p-2.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${
                  revealedBeats === beats.length
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
                title={revealedBeats === beats.length ? "Hide future beats" : "Reveal all beats"}
              >
                {revealedBeats === beats.length ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{revealedBeats === beats.length ? 'Hide' : 'All'}</span>
              </motion.button>
            </div>
          </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="bottom-left" className="!m-4">
          <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Story Flow</div>
            <div className="space-y-1.5">
              {/* Beat colors by position */}
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22d3ee' }} title="Act 1" />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#2dd4bf' }} title="Act 2a" />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#facc15' }} title="Act 2b" />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f472b6' }} title="Act 3" />
                <span className="text-[9px] text-zinc-500 ml-1">Beat progression</span>
              </div>
              
              <div className="border-t border-zinc-800 pt-1.5">
                <div className="text-[8px] text-zinc-600 uppercase tracking-wider mb-1">Branches</div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center" style={{ backgroundColor: '#22d3ee20', color: '#22d3ee' }}>A</div>
                    <div className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center" style={{ backgroundColor: '#2dd4bf20', color: '#2dd4bf' }}>B</div>
                    <div className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center" style={{ backgroundColor: '#facc1520', color: '#facc15' }}>C</div>
                  </div>
                  <span className="text-[9px] text-zinc-500">Path options</span>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </main>
  )
}

// Main export with ReactFlowProvider wrapper
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
