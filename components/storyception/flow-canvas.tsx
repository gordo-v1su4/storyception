"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  MarkerType,
  Panel,
  Position,
  ConnectionLineType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { StoryBeatNode } from "./nodes/story-beat-node"
import { BranchNode } from "./nodes/branch-node"
import { generateBranchOptions } from "@/lib/story-generator"
import type { StoryBeat, BranchOption } from "@/lib/types"
import { motion } from "framer-motion"
import { ArrowRight, ArrowDown, Move, RotateCcw, Lock, Unlock } from "lucide-react"
import { getBeatHexColor, BRANCH_COLORS } from "@/lib/colors"

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
}

// Default edge options - cyan arrows
const defaultEdgeOptions = {
  type: 'smoothstep',
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

export function FlowCanvas({ beats, selectedBeatId, onSelectBeat, onUpdateBeat, onAddBeat }: FlowCanvasProps) {
  const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set())
  const [layout, setLayout] = useState<LayoutDirection>("horizontal")
  const [locked, setLocked] = useState(false)
  
  const [selectedBranchPaths, setSelectedBranchPaths] = useState<Map<string, BranchOption>>(new Map())

  // Calculate node positions based on layout
  const getNodePosition = useCallback((idx: number, level: number = 0) => {
    const HORIZONTAL_SPACING = 420
    const VERTICAL_SPACING = 280
    const BRANCH_OFFSET = 180

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

  // Handle branch selection
  const handleSelectBranch = useCallback((beatId: number, branch: BranchOption) => {
    const pathKey = `${beatId}-${branch.id}`
    
    onUpdateBeat(beatId, {
      selectedBranchId: branch.id,
      branches: beats.find(b => b.id === beatId)?.branches?.map(b => ({
        ...b,
        selected: b.id === branch.id
      }))
    })
    
    setSelectedBranchPaths(prev => new Map(prev).set(pathKey, branch))
    
    setExpandedBranches(prev => {
      const next = new Set(prev)
      next.delete(beatId)
      return next
    })
  }, [beats, onUpdateBeat])

  // Convert beats to React Flow nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (beats.length === 0) return { nodes: [], edges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []

    beats.forEach((beat, idx) => {
      const position = getNodePosition(idx)
      const isExpanded = expandedBranches.has(beat.id)
      
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
              const branches = generateBranchOptions(beat)
              onUpdateBeat(beat.id, { branches })
            }
            toggleBranch(beat.id)
          },
          onUpdateBeat: (updates: Partial<StoryBeat>) => onUpdateBeat(beat.id, updates),
        },
      })

      // EDGE: Connect to next beat with visible arrow (color matches beat position)
      if (idx < beats.length - 1) {
        const nextBeat = beats[idx + 1]
        const selectedBranch = beat.branches?.find(b => b.selected)
        const beatColor = getBeatHexColor(idx, beats.length)
        
        edges.push({
          id: `edge-${beat.id}-${nextBeat.id}`,
          source: `beat-${beat.id}`,
          target: `beat-${nextBeat.id}`,
          type: 'smoothstep',
          animated: !!selectedBranch,
          style: {
            strokeWidth: 4,
            stroke: beatColor, // Use unified color based on beat position
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: beatColor,
          },
          label: selectedBranch ? selectedBranch.title.split(": ")[1] || selectedBranch.title : undefined,
          labelStyle: { 
            fill: beatColor, 
            fontSize: 11, 
            fontWeight: 600,
          },
          labelBgStyle: { 
            fill: '#18181b', // zinc-900
            fillOpacity: 0.95,
            rx: 4,
            ry: 4,
          },
          labelBgPadding: [8, 4] as [number, number],
        })
      }

      // Branch nodes when expanded
      if (beat.branches && beat.branches.length > 0 && isExpanded) {
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
            type: 'smoothstep',
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
        })
      }
    })

    return { nodes, edges }
  }, [beats, selectedBeatId, expandedBranches, layout, locked, getNodePosition, onSelectBeat, onUpdateBeat, toggleBranch, handleSelectBranch])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes when beats or layout changes
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

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
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ strokeWidth: 3, stroke: '#22d3ee' }}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
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
                  {beats.length} beats
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
