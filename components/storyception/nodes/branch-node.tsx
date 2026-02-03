"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { motion } from "framer-motion"
import { Check, Sparkles, ArrowRight, ImageIcon, Lock } from "lucide-react"
import type { BranchOption } from "@/lib/types"
import { getBranchColorSet } from "@/lib/colors"

type LayoutDirection = "horizontal" | "vertical" | "free"

interface BranchNodeData {
  branch: BranchOption
  parentBeatId: number
  branchIndex: number  // 0, 1, or 2 for A, B, C
  isSelected: boolean
  isLocked: boolean  // After selection, other branches get locked
  layout?: LayoutDirection
  onSelect: () => void
}

export const BranchNode = memo(({ data }: NodeProps<BranchNodeData>) => {
  const { branch, branchIndex = 0, isSelected, isLocked = false, layout = "horizontal", onSelect } = data
  
  // Get unified color based on branch index (A, B, C)
  const colors = getBranchColorSet(branchIndex)
  const branchLabel = ['A', 'B', 'C'][branchIndex] || 'X'

  // Get frames from branch or use placeholders
  const frames = branch.frames || []
  const hasFrames = frames.length > 0

  // Get handle positions based on layout
  const getHandlePositions = () => {
    switch (layout) {
      case "horizontal":
        return { target: Position.Left, source: Position.Right }
      case "vertical":
        return { target: Position.Top, source: Position.Bottom }
      case "free":
        return { target: Position.Left, source: Position.Right }
      default:
        return { target: Position.Left, source: Position.Right }
    }
  }

  const handlePositions = getHandlePositions()

  // Locked but not selected = faded state
  const isFaded = isLocked && !isSelected

  return (
    <div className="relative group">
      {/* Input handle */}
      <Handle
        type="target"
        position={handlePositions.target}
        className={`!w-3 !h-3 ${colors.bg} !border-2 !border-black !rounded-full`}
        style={{ backgroundColor: colors.hex }}
      />

      {/* Fixed 4:5 aspect ratio (320x400) to match story beat nodes */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ 
          opacity: isFaded ? 0.4 : 1, 
          scale: 1
        }}
        whileHover={{ scale: isFaded ? 1 : 1.01 }}
        whileTap={{ scale: isFaded ? 1 : 0.99 }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isLocked) onSelect()
        }}
        className={`
          w-[320px] h-[400px] overflow-hidden transition-all duration-300 flex flex-col
          ${isLocked && !isSelected ? 'cursor-not-allowed' : 'cursor-pointer'}
          bg-zinc-900
        `}
        style={{
          outline: isSelected ? `2px solid ${colors.hex}` : 'none',
          boxShadow: isSelected ? `0 0 20px ${colors.hex}50` : undefined
        }}
      >
        {/* TOP - Header with path letter and title */}
        <div className={`px-3 py-2 bg-zinc-950 ${isFaded ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 flex items-center justify-center shrink-0 font-bold text-[11px]"
                style={{ backgroundColor: isFaded ? '#3f3f46' : colors.hex, color: '#000' }}
              >
                {branchLabel}
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wide ${isFaded ? 'text-zinc-600' : colors.text}`}>
                Path {branchLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono ${isFaded ? 'text-zinc-700' : 'text-zinc-500'}`}>{branch.duration}</span>
              {isSelected && (
                <div className="w-5 h-5 flex items-center justify-center" style={{ backgroundColor: colors.hex }}>
                  <Check size={12} className="text-black" />
                </div>
              )}
              {isFaded && <Lock size={12} className="text-zinc-600" />}
            </div>
          </div>
        </div>

        {/* MIDDLE - 3x3 cinematic keyframe grid */}
        <div className={`p-1 bg-black ${isFaded ? 'opacity-40 grayscale' : ''}`}>
          <div className="grid grid-cols-3 gap-[1px] bg-zinc-800">
            {hasFrames ? (
              frames.slice(0, 9).map((frame, idx) => (
                <div key={idx} className="aspect-video bg-zinc-900 relative">
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
        
        {/* BOTTOM - Title, description + select action - MORE SPACE */}
        <div className={`px-3 py-3 bg-zinc-950 flex-1 ${isFaded ? 'opacity-50' : ''}`}>
          <h4 className={`text-[11px] font-bold mb-1 ${isSelected ? 'text-white' : isFaded ? 'text-zinc-600' : 'text-zinc-200'}`}>
            {branch.title}
          </h4>
          <p className={`text-[10px] line-clamp-3 leading-relaxed mb-3 ${isFaded ? 'text-zinc-700' : 'text-zinc-500'}`}>
            {branch.desc}
          </p>
          
          {!isLocked && !isSelected && (
            <motion.div 
              className={`flex items-center justify-end gap-1.5 text-[11px] font-bold ${colors.text}`}
              whileHover={{ x: 3 }}
            >
              <span>Select this path</span>
              <ArrowRight size={14} />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Output handle */}
      <Handle
        type="source"
        position={handlePositions.source}
        className={`!w-3 !h-3 !border-2 !border-black !rounded-full transition-colors ${
          isSelected ? '' : '!bg-zinc-600'
        }`}
        style={{ backgroundColor: isSelected ? colors.hex : undefined }}
      />
    </div>
  )
})

BranchNode.displayName = "BranchNode"
