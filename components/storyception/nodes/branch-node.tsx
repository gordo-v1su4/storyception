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

      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ 
          opacity: isFaded ? 0.4 : 1, 
          scale: isFaded ? 0.95 : 1, 
          x: 0 
        }}
        whileHover={{ scale: isFaded ? 0.95 : 1.02 }}
        whileTap={{ scale: isFaded ? 0.95 : 0.98 }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isLocked) onSelect()
        }}
        className={`
          w-[220px] rounded-xl overflow-hidden transition-all duration-300
          ${isLocked && !isSelected ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${isSelected 
            ? `${colors.bg} border-2 ${colors.border} shadow-lg`
            : isFaded
              ? 'bg-zinc-900/50 border-2 border-dashed border-zinc-700'
              : `bg-zinc-900/80 border-2 ${colors.border} hover:border-opacity-80`
          }
        `}
        style={{
          boxShadow: isSelected ? `0 0 20px ${colors.hex}40` : undefined
        }}
      >
        {/* Header with branch letter */}
        <div className={`px-3 py-2 ${isSelected ? colors.bg : 'bg-black/40'} border-b ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                  isSelected ? 'bg-black/30 text-white' : `${colors.bg} ${colors.text}`
                }`}
                style={{ backgroundColor: isSelected ? colors.hex : undefined }}
              >
                {branchLabel}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white' : colors.text}`}>
                Path {branchLabel}
              </span>
            </div>
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors.hex }}
              >
                <Check size={12} className="text-black" />
              </motion.div>
            )}
            {isFaded && (
              <Lock size={12} className="text-zinc-600" />
            )}
          </div>
        </div>

        {/* 9-Frame Preview Grid */}
        <div className="p-2">
          <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black">
            {hasFrames ? (
              <div className="grid grid-cols-3 gap-px bg-zinc-800">
                {frames.slice(0, 9).map((frame, idx) => (
                  <div key={idx} className="aspect-video relative">
                    <img 
                      src={frame} 
                      alt={`Preview ${idx + 1}`} 
                      className={`w-full h-full object-cover ${isFaded ? 'grayscale' : ''}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-px bg-zinc-800">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`aspect-video bg-zinc-900 flex items-center justify-center ${isFaded ? 'opacity-30' : ''}`}
                  >
                    <ImageIcon className="w-3 h-3 text-zinc-700" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-3 pb-3">
          <h4 className={`text-xs font-bold mb-1 ${isSelected ? 'text-white' : isFaded ? 'text-zinc-600' : 'text-zinc-200'}`}>
            {branch.title}
          </h4>
          
          <p className={`text-[10px] leading-relaxed line-clamp-2 mb-2 ${isFaded ? 'text-zinc-700' : 'text-zinc-500'}`}>
            {branch.desc}
          </p>

          {/* Duration & Action */}
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-mono ${isFaded ? 'text-zinc-700' : 'text-zinc-600'}`}>
              {branch.duration}
            </span>
            
            {!isLocked && !isSelected && (
              <motion.div 
                className={`flex items-center gap-1 text-[9px] ${colors.text}`}
                whileHover={{ x: 3 }}
              >
                <span>Select</span>
                <ArrowRight size={10} />
              </motion.div>
            )}
          </div>

          {/* Generated idea preview */}
          {branch.generatedIdea && !isFaded && (
            <div className="mt-2 pt-2 border-t border-zinc-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={10} className={colors.text} />
                <span className={`text-[8px] uppercase tracking-wider ${colors.text}`}>Scene</span>
              </div>
              <p className="text-[9px] text-zinc-500 italic line-clamp-1">
                "{branch.generatedIdea}"
              </p>
            </div>
          )}
        </div>

        {/* Selection indicator bar */}
        {isSelected && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: colors.hex }}
          />
        )}
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
