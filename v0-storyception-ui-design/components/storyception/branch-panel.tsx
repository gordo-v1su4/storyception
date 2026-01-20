"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, GitBranch, Sparkles, Check, RotateCcw, ChevronRight, ArrowRight } from "lucide-react"
import type { StoryBeat, BranchOption } from "@/lib/types"
import { generateBranchOptions } from "@/lib/story-generator"

interface BranchPanelProps {
  parentBeat: StoryBeat
  nextBeat?: StoryBeat
  onClose: () => void
  onSelectBranch: (branchId: number, branch: BranchOption) => void
  onUndoBranch: () => void
}

export function BranchPanel({ parentBeat, nextBeat, onClose, onSelectBranch, onUndoBranch }: BranchPanelProps) {
  const [options, setOptions] = useState<BranchOption[]>(() => parentBeat.branches || generateBranchOptions(parentBeat))
  const [isGenerating, setIsGenerating] = useState(false)
  const [hoveredOption, setHoveredOption] = useState<number | null>(null)

  const handleRegenerateOptions = async () => {
    setIsGenerating(true)
    setTimeout(() => {
      setOptions(generateBranchOptions(parentBeat))
      setIsGenerating(false)
    }, 600)
  }

  const handleSelectPath = (opt: BranchOption) => {
    const updatedOptions = options.map((o) => ({ ...o, selected: o.id === opt.id }))
    setOptions(updatedOptions)
    onSelectBranch(opt.id, { ...opt, selected: true })
  }

  const selectedOption = options.find((o) => o.selected)

  return (
    <motion.div
      initial={{ opacity: 0, x: 10, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 10, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="absolute top-0 left-[calc(100%+20px)] w-[360px] bg-card border border-border rounded-xl shadow-xl z-30 flex flex-col max-h-[550px] hidden lg:flex"
    >
      {/* Connector line */}
      <svg className="absolute top-1/2 right-full w-5 h-4 -translate-y-1/2 overflow-visible">
        <path d="M 20 8 L 4 8" stroke="var(--primary)" strokeWidth="2" fill="none" />
        <circle cx="4" cy="8" r="3" fill="var(--primary)" />
      </svg>

      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-muted/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-primary" />
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">Choose Direction</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded"
        >
          <X size={14} />
        </motion.button>
      </div>

      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
          <span>Story Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-primary rounded text-[9px] text-primary-foreground font-mono">
            {parentBeat.label.split(".")[0]}
          </div>
          <ArrowRight size={12} className="text-muted-foreground" />
          <div
            className={`px-2 py-1 rounded text-[9px] font-mono ${selectedOption ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {selectedOption ? selectedOption.title.split(": ")[1] : "?"}
          </div>
          {nextBeat && (
            <>
              <ArrowRight size={12} className="text-muted-foreground" />
              <div className="px-2 py-1 bg-muted rounded text-[9px] text-muted-foreground font-mono">
                {nextBeat.label.split(".")[0]}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Branch options - Solid backgrounds, faster animations */}
      <div className="p-3 overflow-y-auto flex-1">
        <div className="space-y-2">
          <AnimatePresence mode="wait">
            {options.map((opt, i) => (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                onMouseEnter={() => setHoveredOption(opt.id)}
                onMouseLeave={() => setHoveredOption(null)}
                onClick={() => handleSelectPath(opt)}
                className={`
                  relative border rounded-lg p-3 transition-all duration-150 cursor-pointer group overflow-hidden
                  ${
                    opt.selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                {/* Selection indicator */}
                <AnimatePresence>
                  {opt.selected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                    >
                      <Check size={10} className="text-primary-foreground" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Path header */}
                <div className="flex items-start justify-between mb-1.5 pr-6">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-colors ${
                        opt.selected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground group-hover:border-primary"
                      }`}
                    >
                      {opt.selected && <div className="w-1 h-1 bg-primary-foreground rounded-full" />}
                    </div>
                    <span
                      className={`text-[10px] font-bold transition-colors ${
                        opt.selected ? "text-primary" : "text-foreground group-hover:text-primary"
                      }`}
                    >
                      {opt.title}
                    </span>
                  </div>
                  <span className="text-[8px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                    {opt.duration}
                  </span>
                </div>

                {/* Description */}
                <div className="ml-5">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">&ldquo;{opt.desc}&rdquo;</p>

                  {/* Preview on hover */}
                  <AnimatePresence>
                    {(hoveredOption === opt.id || opt.selected) && opt.generatedIdea && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <p className="text-[9px] text-chart-3 mt-2 italic">{opt.generatedIdea}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action hint */}
                  {!opt.selected && (
                    <div className="flex items-center gap-1 mt-1 text-[8px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Select path</span>
                      <ChevronRight size={8} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Generating state */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 p-3 border border-dashed border-primary rounded-lg flex items-center justify-center gap-2 bg-primary/5"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full"
              />
              <span className="text-[9px] text-primary font-medium">Generating...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer actions - Solid backgrounds */}
      <div className="p-3 border-t border-border bg-muted/30 rounded-b-xl flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRegenerateOptions}
          disabled={isGenerating}
          className="flex-1 py-2 bg-primary text-primary-foreground text-[9px] rounded-lg hover:bg-primary/90 uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 font-bold"
        >
          <Sparkles size={10} /> Regenerate
        </motion.button>

        {selectedOption && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onUndoBranch}
            className="py-2 px-3 bg-destructive text-destructive-foreground text-[9px] rounded-lg hover:bg-destructive/90 uppercase tracking-widest transition-all flex items-center gap-1.5 font-bold"
          >
            <RotateCcw size={10} /> Undo
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
