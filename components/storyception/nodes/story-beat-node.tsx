"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { motion } from "framer-motion"
import { GitBranch, Sparkles, ChevronDown, ImageIcon, Play } from "lucide-react"
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

export const StoryBeatNode = memo(({ data }: NodeProps<StoryBeatNodeData>) => {
  const { beat, isSelected, isExpanded, isRevealing = false, layout = "horizontal", onSelect, onToggleBranch } = data
  const beatIndex = beat.id - 1
  const totalBeats = 15
  
  // Get frames from beat or use placeholders
  const frames = beat.frames || []
  const hasFrames = frames.length > 0

  // Get handle positions based on layout
  const getHandlePositions = () => {
    switch (layout) {
      case "horizontal":
        return { source: Position.Right, target: Position.Left, branch: Position.Bottom }
      case "vertical":
        return { source: Position.Bottom, target: Position.Top, branch: Position.Right }
      case "free":
        return { source: Position.Right, target: Position.Left, branch: Position.Bottom }
      default:
        return { source: Position.Right, target: Position.Left, branch: Position.Bottom }
    }
  }

  const handlePositions = getHandlePositions()

  // Get unified color set based on beat position
  const colors = getBeatColorSet(beatIndex, totalBeats)
  const selectedBranch = beat.branches?.find((b) => b.selected)

  return (
    <div className="relative group">
      {/* Input handle */}
      {beatIndex > 0 && (
        <Handle
          type="target"
          position={handlePositions.target}
          className={`!w-4 !h-4 ${colors.bg} !border-2 !border-black !rounded-full transition-transform group-hover:scale-125`}
        />
      )}

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, delay: beatIndex * 0.05 }}
        onClick={onSelect}
        className={`
          w-[340px] rounded-xl overflow-hidden cursor-pointer transition-all duration-200
          bg-zinc-900/95 backdrop-blur-sm
          border-2 ${isSelected ? colors.border : 'border-zinc-700 hover:border-zinc-600'}
        `}
        style={{
          boxShadow: isSelected ? `0 0 30px ${colors.glow}` : undefined
        }}
      >
        {/* Color bar with beat number */}
        <div className={`h-2 ${colors.bg} relative`}>
          <div className="absolute -bottom-3 left-3 w-6 h-6 rounded-full bg-black border-2 border-zinc-700 flex items-center justify-center">
            <span className="text-[10px] font-bold text-zinc-300">{beat.id}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <h3 className={`text-sm font-bold ${colors.text} uppercase tracking-wide leading-tight pr-2`}>
              {beat.label}
            </h3>
            <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-500 font-mono shrink-0">
              {beat.duration}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-zinc-500 mb-3 leading-relaxed line-clamp-2">
            {beat.desc}
          </p>

          {/* 9-Frame Grid */}
          <div className="mb-3 rounded-lg bg-black border border-zinc-800 overflow-hidden">
            {hasFrames ? (
              <div className="grid grid-cols-3 gap-px bg-zinc-800">
                {frames.slice(0, 9).map((frame, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: isRevealing ? idx * 0.1 : 0  // Cascade reveal
                    }}
                    className="aspect-video relative group/frame"
                  >
                    <img 
                      src={frame} 
                      alt={`KF${idx + 1}`} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/70 rounded text-[7px] font-mono text-zinc-400">
                      KF{idx + 1}
                    </div>
                  </motion.div>
                ))}
                {/* Fill remaining slots if less than 9 frames */}
                {frames.length < 9 && Array.from({ length: 9 - frames.length }).map((_, idx) => (
                  <div key={`placeholder-${idx}`} className="aspect-video bg-zinc-900 flex items-center justify-center">
                    <span className="text-[8px] text-zinc-700 font-mono">KF{frames.length + idx + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-px bg-zinc-800">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="aspect-video bg-zinc-900 flex items-center justify-center relative group/frame"
                  >
                    <div className="text-center">
                      <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-0.5 group-hover/frame:border-cyan-500/50 transition-colors">
                        <ImageIcon className="w-3 h-3 text-zinc-600 group-hover/frame:text-cyan-400 transition-colors" />
                      </div>
                    </div>
                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/50 rounded text-[7px] font-mono text-zinc-500">
                      KF{idx + 1}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Generated idea */}
          {beat.generatedIdea && (
            <div className="mb-3 p-3 bg-black/60 border border-zinc-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={12} className={colors.text} />
                <span className={`text-[9px] ${colors.text} uppercase tracking-widest font-bold`}>Scene</span>
              </div>
              <p className="text-[11px] text-zinc-400 italic leading-relaxed line-clamp-2">
                "{beat.generatedIdea}"
              </p>
            </div>
          )}

          {/* Selected branch indicator */}
          {selectedBranch && (
            <div className="mb-3 p-2.5 bg-pink-500/20 border border-pink-500/40 rounded-lg">
              <div className="flex items-center gap-2">
                <GitBranch size={12} className="text-pink-400" />
                <p className="text-[11px] text-pink-300 font-medium">{selectedBranch.title}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation()
                onToggleBranch()
              }}
              className={`
                flex-1 text-[10px] px-3 py-2 rounded-lg font-bold uppercase flex items-center justify-center gap-2 transition-all
                ${isExpanded 
                  ? "bg-pink-500 text-white shadow-lg shadow-pink-500/30" 
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }
              `}
            >
              <GitBranch size={12} />
              {beat.branches && beat.branches.length > 0 ? `Branches (${beat.branches.length})` : 'Branches'}
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={12} />
              </motion.div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] bg-zinc-800 text-zinc-400 px-3 py-2 rounded-lg font-bold uppercase hover:bg-zinc-700 hover:text-zinc-200 transition-all flex items-center gap-1.5"
            >
              <Play size={12} />
              Preview
            </motion.button>
          </div>
        </div>

        {/* Selection glow effect */}
        {isSelected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${colors.glow} 0%, transparent 50%)`,
            }}
          />
        )}
      </motion.div>

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
