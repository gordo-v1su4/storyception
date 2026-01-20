"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { GitBranch, Pencil, Sparkles, ChevronDown, ArrowDown, Check } from "lucide-react"
import { BranchPanel } from "./branch-panel"
import type { StoryBeat, BranchOption } from "@/lib/types"
import { generateBeatIdea } from "@/lib/story-generator"

interface StoryCanvasProps {
  beats: StoryBeat[]
  selectedBeatId: number | null
  onSelectBeat: (id: number | null) => void
  onUpdateBeat: (id: number, updates: Partial<StoryBeat>) => void
}

export function StoryCanvas({ beats, selectedBeatId, onSelectBeat, onUpdateBeat }: StoryCanvasProps) {
  const [expandedBeat, setExpandedBeat] = useState<number | null>(null)
  const [generatingIdea, setGeneratingIdea] = useState<number | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Scroll to selected beat
  useEffect(() => {
    if (selectedBeatId && canvasRef.current) {
      const element = document.getElementById(`beat-${selectedBeatId}`)
      element?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [selectedBeatId])

  const handleGenerateIdea = async (beat: StoryBeat) => {
    setGeneratingIdea(beat.id)
    setTimeout(() => {
      const idea = generateBeatIdea(beat.beatId)
      onUpdateBeat(beat.id, { generatedIdea: idea })
      setGeneratingIdea(null)
    }, 800)
  }

  const handleSelectBranch = (beatId: number, branchId: number, branch: BranchOption) => {
    onUpdateBeat(beatId, {
      selectedBranchId: branchId,
      branches: beats.find((b) => b.id === beatId)?.branches?.map((b) => ({ ...b, selected: b.id === branchId })),
    })
  }

  const handleUndoBranch = (beatId: number) => {
    onUpdateBeat(beatId, {
      selectedBranchId: undefined,
      branches: beats.find((b) => b.id === beatId)?.branches?.map((b) => ({ ...b, selected: false })),
    })
  }

  if (beats.length === 0) {
    return (
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary flex items-center justify-center">
            <Sparkles size={32} className="text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No Story Yet</h2>
          <p className="text-sm text-muted-foreground">Create a new story to get started</p>
        </motion.div>
      </main>
    )
  }

  const getBeatColor = (index: number, total: number) => {
    const position = index / Math.max(total - 1, 1)
    if (position < 0.25) return "bg-primary"
    if (position < 0.5) return "bg-accent"
    if (position < 0.75) return "bg-chart-3"
    return "bg-chart-4"
  }

  const getBeatBorderColor = (index: number, total: number, isSelected: boolean) => {
    if (isSelected) return "border-foreground"
    const position = index / Math.max(total - 1, 1)
    if (position < 0.25) return "border-primary hover:border-primary/80"
    if (position < 0.5) return "border-accent hover:border-accent/80"
    if (position < 0.75) return "border-chart-3 hover:border-chart-3/80"
    return "border-chart-4 hover:border-chart-4/80"
  }

  const getNodeColor = (index: number, total: number) => {
    const position = index / Math.max(total - 1, 1)
    if (position < 0.25) return "bg-primary"
    if (position < 0.5) return "bg-accent"
    if (position < 0.75) return "bg-chart-3"
    return "bg-chart-4"
  }

  return (
    <main ref={canvasRef} className="flex-1 overflow-y-auto overflow-x-hidden relative p-4 sm:p-8">
      <div className="max-w-4xl mx-auto relative">
        {/* Main vertical connection line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 z-0 bg-border" />

        <div className="flex flex-col items-center gap-4 relative z-10 pb-8">
          {beats.map((beat, idx) => {
            const isSelected = beat.id === selectedBeatId
            const isExpanded = expandedBeat === beat.id
            const hasGeneratedIdea = !!beat.generatedIdea
            const selectedBranch = beat.branches?.find((b) => b.selected)
            const prevBeat = beats[idx - 1]
            const prevSelectedBranch = prevBeat?.branches?.find((b) => b.selected)

            return (
              <motion.div
                key={beat.id}
                id={`beat-${beat.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                className="relative w-full flex justify-center"
              >
                {idx > 0 && prevSelectedBranch && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center"
                  >
                    <div className="px-2 py-0.5 bg-accent rounded text-[8px] text-accent-foreground font-mono whitespace-nowrap">
                      from: {prevSelectedBranch.title.split(": ")[1]}
                    </div>
                    <ArrowDown size={12} className="text-accent mt-1" />
                  </motion.div>
                )}

                {/* Connection node */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 + 0.1 }}
                  className={`absolute left-1/2 -translate-x-1/2 -top-2 w-3 h-3 rounded-full z-20 ${getNodeColor(idx, beats.length)}`}
                />

                {/* Story beat card - Solid background, no transparency */}
                <motion.div
                  whileHover={{ scale: isExpanded ? 1 : 1.005 }}
                  transition={{ duration: 0.15 }}
                  className={`
                    relative w-full max-w-[540px] rounded-xl border-2 transition-colors duration-150 group overflow-hidden cursor-pointer bg-card
                    ${getBeatBorderColor(idx, beats.length, isSelected)}
                  `}
                  onClick={() => {
                    onSelectBeat(beat.id === selectedBeatId ? null : beat.id)
                  }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${getBeatColor(idx, beats.length)}`} />

                  {/* Card content */}
                  <div className="relative p-5 pt-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-sm font-bold text-foreground uppercase tracking-wider">{beat.label}</div>
                      <span className="px-2 py-1 bg-muted rounded text-[10px] text-muted-foreground font-mono">
                        {beat.duration}
                      </span>
                    </div>

                    {/* Beat description */}
                    <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">{beat.desc}</p>

                    {/* Generated idea section - Solid background */}
                    <AnimatePresence>
                      {hasGeneratedIdea && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mb-4 overflow-hidden"
                        >
                          <div className="p-3 bg-muted border border-border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={12} className="text-primary" />
                              <span className="text-[9px] text-primary uppercase tracking-widest font-bold">
                                Generated Scene
                              </span>
                            </div>
                            <p className="text-[11px] text-foreground/90 italic leading-relaxed">
                              &ldquo;{beat.generatedIdea}&rdquo;
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Selected branch indicator - Solid background */}
                    <AnimatePresence>
                      {selectedBranch && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mb-4 overflow-hidden"
                        >
                          <div className="p-3 bg-accent/20 border border-accent rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Check size={12} className="text-accent" />
                              <span className="text-[9px] text-accent uppercase tracking-widest font-bold">
                                Selected Path
                              </span>
                            </div>
                            <p className="text-[11px] text-foreground font-medium">{selectedBranch.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{selectedBranch.desc}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action buttons - Solid backgrounds */}
                    <div className="flex gap-2 flex-wrap">
                      {!hasGeneratedIdea && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleGenerateIdea(beat)
                          }}
                          disabled={generatingIdea === beat.id}
                          className="text-[10px] bg-primary text-primary-foreground px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {generatingIdea === beat.id ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full"
                              />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              Generate Idea
                            </>
                          )}
                        </motion.button>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedBeat(isExpanded ? null : beat.id)
                        }}
                        className={`text-[10px] px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-2 transition-colors ${
                          isExpanded ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                      >
                        <GitBranch size={12} />
                        Branches
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
                          <ChevronDown size={12} />
                        </motion.div>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="text-[10px] bg-muted text-foreground px-3 py-2 rounded-lg font-bold uppercase hover:bg-muted/80 transition-colors flex items-center gap-2"
                      >
                        <Pencil size={12} />
                        Edit
                      </motion.button>
                    </div>
                  </div>

                  {/* Active selection indicator */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        exit={{ scaleY: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute -left-[2px] top-1/2 -translate-y-1/2 w-1 h-16 bg-foreground rounded-r-full origin-center"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Branch Panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <BranchPanel
                      parentBeat={beat}
                      nextBeat={beats[idx + 1]}
                      onClose={() => setExpandedBeat(null)}
                      onSelectBranch={(branchId, branch) => handleSelectBranch(beat.id, branchId, branch)}
                      onUndoBranch={() => handleUndoBranch(beat.id)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
