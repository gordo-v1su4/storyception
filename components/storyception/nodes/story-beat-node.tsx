"use client"

import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { motion, AnimatePresence } from "framer-motion"
import { GitBranch, ChevronDown, ImageIcon, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react"
import type { StoryBeat } from "@/lib/types"
import { getBeatColorSet } from "@/lib/colors"

type LayoutDirection = "horizontal" | "vertical" | "free"

interface StoryBeatNodeData {
  beat: StoryBeat
  isSelected: boolean
  isExpanded: boolean
  isRevealing?: boolean  // Animation state for progressive reveal
  layout?: LayoutDirection
  onSelect: () => void
  onToggleBranch: () => void
  onUpdateBeat: (updates: Partial<StoryBeat>) => void
}

export const StoryBeatNode = memo(({ data }: { data: StoryBeatNodeData }) => {
  const { beat, isSelected, isExpanded, isRevealing = false, layout = "horizontal", onSelect, onToggleBranch } = data
  const beatIndex = beat.id - 1
  const totalBeats = 15
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  
  // Get frames from beat or use placeholders
  const frames = beat.frames || []
  const hasFrames = frames.length > 0
  const isGenerating = beat.status === 'generating'

  // Get handle positions based on layout

  // Vertical: flows top-to-bottom, branches spread below
  // Horizontal: flows left-to-right, branches spread below
  const getHandlePositions = () => {
    switch (layout) {
      case "horizontal":
        return { source: Position.Right, target: Position.Left, branch: Position.Bottom }
      case "vertical":
        return { source: Position.Bottom, target: Position.Top, branch: Position.Bottom }
      case "free":
        return { source: Position.Bottom, target: Position.Top, branch: Position.Bottom }
      default:
        return { source: Position.Bottom, target: Position.Top, branch: Position.Bottom }
    }
  }

  const handlePositions = getHandlePositions()

  // Get unified color set based on beat position
  const colors = getBeatColorSet(beatIndex, totalBeats)
  const selectedBranch = beat.branches?.find((b: { selected: boolean }) => b.selected)

  return (
    <div className="relative group">
      {/* Input handle - always present (React Flow ignores unused handles) */}
      <Handle
        type="target"
        position={handlePositions.target}
        className={`!w-4 !h-4 ${colors.bg} !border-2 !border-black !rounded-full transition-transform group-hover:scale-125`}
        style={{ opacity: beatIndex > 0 ? 1 : 0 }} // Hide visually for first beat but keep for edges
      />

      {/* Main card - Fixed 4:5 aspect ratio (320x400) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, delay: beatIndex * 0.05 }}
        onClick={onSelect}
        className={`
          w-[320px] h-[400px] overflow-hidden cursor-pointer transition-all duration-200
          bg-zinc-900 flex flex-col
        `}
        style={{
          boxShadow: isSelected ? `0 0 20px ${colors.glow}` : undefined,
          outline: isSelected ? `2px solid ${colors.glow}` : 'none'
        }}
      >
        {/* TOP - Header with beat number and title */}
        <div className="px-3 py-2 bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 ${colors.bg} flex items-center justify-center shrink-0`}>
              <span className="text-[10px] font-bold text-black">{beat.id}</span>
            </div>
            <h3 className={`text-[11px] font-bold ${colors.text} uppercase tracking-wide truncate flex-1`}>
              {beat.label}
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono shrink-0">{beat.duration}</span>
          </div>
        </div>

        {/* MIDDLE - 3x3 cinematic keyframe grid */}
        <div className="p-1 bg-black relative">
          {isGenerating && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
              <Loader2 className={`w-8 h-8 ${colors.text} animate-spin`} />
              <span className="text-[10px] text-zinc-400 mt-2 uppercase tracking-wider">Generating...</span>
            </div>
          )}
          <div className={`grid grid-cols-3 gap-[1px] bg-zinc-800 ${isGenerating ? 'opacity-30' : ''}`}>
            {hasFrames ? (
              frames.slice(0, 9).map((frame: string, idx: number) => (
                <div
                  key={idx}
                  className="aspect-video bg-zinc-900 relative cursor-pointer hover:brightness-125 transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxIndex(idx)
                  }}
                >
                  <img src={frame} alt={`KF${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 text-[7px] font-mono text-white/60 bg-black/70 px-1">
                    {idx + 1}
                  </span>
                </div>
              ))
            ) : (
              Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="aspect-video bg-zinc-900 flex items-center justify-center relative">
                  <ImageIcon className="w-4 h-4 text-zinc-700" />
                  <span className="absolute bottom-0 left-0 text-[7px] font-mono text-zinc-600 px-1">
                    {idx + 1}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* BOTTOM - Scene description + branch button */}
        <div className="px-3 py-3 bg-zinc-950 flex-1">
          <p className="text-[11px] text-zinc-400 line-clamp-4 mb-3 leading-relaxed">
            {beat.generatedIdea || beat.desc || "Scene description will appear here..."}
          </p>
          
          <div className="flex items-center justify-between">
            {selectedBranch ? (
              <div className="flex items-center gap-1.5 text-pink-400 flex-1 min-w-0">
                <GitBranch size={14} />
                <span className="text-[10px] font-medium truncate">{selectedBranch.title}</span>
              </div>
            ) : (
              <div className="text-[10px] text-zinc-600">Choose your path...</div>
            )}
            
            {/* Branch button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation()
                onToggleBranch()
              }}
              className={`
                text-[10px] px-3 py-2 font-bold uppercase flex items-center gap-1.5 transition-all shrink-0
                ${isExpanded 
                  ? "bg-pink-500 text-white" 
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }
              `}
            >
              <GitBranch size={14} />
              {beat.branches?.length || 0}
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                <ChevronDown size={12} />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && hasFrames && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIndex(null)
            }}
          >
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(null) }}
              className="absolute top-6 right-6 w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors z-10"
            >
              <X size={20} />
            </button>

            {/* Prev button */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1) }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-zinc-800/80 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors z-10"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Next button */}
            {lightboxIndex < frames.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1) }}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-zinc-800/80 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors z-10"
              >
                <ChevronRight size={24} />
              </button>
            )}

            {/* Image */}
            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={frames[lightboxIndex]}
              alt={`Keyframe ${lightboxIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Frame indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <span className="text-zinc-400 text-sm font-mono">
                KF {lightboxIndex + 1} / {frames.length}
              </span>
              <span className="text-zinc-600 text-xs">
                {beat.label}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Output handle */}
      <Handle
        type="source"
        position={handlePositions.source}
        className={`!w-4 !h-4 ${colors.bg} !border-2 !border-black !rounded-full transition-transform group-hover:scale-125`}
      />

      {/* Branch handle */}
      <Handle
        type="source"
        position={handlePositions.branch}
        id="branch"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-black !rounded-full transition-transform group-hover:scale-125"
      />
    </div>
  )
})

StoryBeatNode.displayName = "StoryBeatNode"
