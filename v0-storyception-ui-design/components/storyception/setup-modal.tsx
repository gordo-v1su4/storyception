"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Upload, Sparkles, ChevronRight, ChevronLeft, Plus } from "lucide-react"
import { archetypes, outcomes, beatStructures } from "@/lib/data"
import type { StoryBeat } from "@/lib/types"
import { getBeatPercentage, autoGenerateBeatIdea } from "@/lib/story-generator"

interface SetupModalProps {
  onClose: () => void
  onGenerate: (beats: StoryBeat[], archIdx: number) => void
}

export function SetupModal({ onClose, onGenerate }: SetupModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedArch, setSelectedArch] = useState<number | null>(null)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3)
    const imageUrls = files.map((file) => URL.createObjectURL(file))
    setUploadedImages(imageUrls)
  }

  const handleGenerateClick = async () => {
    if (currentStep !== 4) {
      handleNext()
      return
    }

    setIsLoading(true)

    setTimeout(() => {
      const beatStructure = beatStructures[selectedArch ?? 0]

      const beats: StoryBeat[] = beatStructure.map((beat, idx) => {
        const percentage = getBeatPercentage(beat.id)
        const totalDuration = 90
        const duration = (percentage / 100) * totalDuration

        return {
          id: idx + 1,
          label: beat.label,
          duration: `${duration.toFixed(1)}s`,
          percentOfTotal: percentage,
          img: `linear-gradient(135deg, hsl(${180 + idx * 15}, 70%, ${15 + idx * 2}%), hsl(${195 + idx * 10}, 60%, ${10 + idx * 2}%))`,
          desc: beat.desc,
          beatId: beat.id,
          generatedIdea: autoGenerateBeatIdea(beat.id, beat.label),
        }
      })

      onGenerate(beats, selectedArch ?? 0)
      setIsLoading(false)
      onClose()
    }, 1500)
  }

  const canProceed = () => {
    if (currentStep === 1) return selectedArch !== null
    if (currentStep === 2) return uploadedImages.length > 0
    if (currentStep === 3) return selectedOutcome !== null
    return true
  }

  const stepLabels = ["Archetype", "References", "Outcome", "Generate"]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95"
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-[90vw] max-w-[900px] max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles size={14} className="text-primary-foreground" />
            </div>
            <h2 className="text-sm font-bold text-foreground tracking-wide">CREATE NEW STORY</h2>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Steps Indicator */}
        <div className="h-12 border-b border-border flex items-center justify-center gap-2 sm:gap-4 bg-card px-6">
          {[1, 2, 3, 4].map((step, idx) => (
            <div key={step} className="flex items-center gap-2 sm:gap-4">
              <div
                className={`flex items-center gap-2 ${step <= currentStep ? "text-primary" : "text-muted-foreground"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                    step < currentStep
                      ? "bg-primary border-primary"
                      : step === currentStep
                        ? "border-primary"
                        : "border-border"
                  }`}
                >
                  {step < currentStep ? (
                    <Check size={10} className="text-primary-foreground" />
                  ) : (
                    <span className={step === currentStep ? "text-primary" : ""}>{step}</span>
                  )}
                </div>
                <span className="hidden sm:block text-[10px] font-medium uppercase tracking-wide">
                  {stepLabels[idx]}
                </span>
              </div>
              {idx < 3 && (
                <div
                  className={`w-6 sm:w-8 h-[2px] rounded-full transition-colors ${
                    step < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 bg-background flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-background flex flex-col items-center justify-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="w-14 h-14 border-2 border-primary border-t-transparent rounded-full"
                  />
                  <Sparkles className="absolute inset-0 m-auto text-primary" size={20} />
                </div>
                <div className="text-primary font-mono text-sm mt-6">GENERATING STORY...</div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* STEP 1: Select Narrative Archetype */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xs font-bold text-muted-foreground mb-6 uppercase tracking-widest">
                  Step 1: Select Narrative Archetype
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {archetypes.map((arch, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedArch(idx)}
                      className={`
                        relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-150 group
                        ${
                          selectedArch === idx
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/40"
                        }
                      `}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-foreground">{arch.title}</h4>
                        <AnimatePresence>
                          {selectedArch === idx && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Check size={16} className="text-primary" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className="text-[10px] text-primary font-bold mb-2 tracking-wide">{arch.subtitle}</p>
                      <div className="text-[11px] text-muted-foreground mb-2">{arch.desc}</div>
                      <div className="text-[10px] text-muted-foreground/70 italic flex items-center gap-1">
                        <span className="text-primary">●</span> {arch.example}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Upload Images */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xs font-bold text-muted-foreground mb-6 uppercase tracking-widest">
                  Step 2: Upload Reference Images
                </h3>
                <div className="space-y-4">
                  {uploadedImages.length === 0 ? (
                    <motion.label
                      whileHover={{ borderColor: "var(--primary)" }}
                      className="block w-full h-[260px] border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/20 transition-all flex flex-col items-center justify-center gap-4"
                    >
                      <Upload size={40} className="text-muted-foreground" />
                      <div className="text-center">
                        <div className="text-foreground font-bold mb-1">Drag & Drop Images Here</div>
                        <div className="text-[11px] text-muted-foreground">Or click to browse (1-3 images max)</div>
                      </div>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    </motion.label>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {uploadedImages.map((url, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className="relative aspect-video rounded-lg overflow-hidden border border-border group"
                        >
                          <img
                            src={url || "/placeholder.svg"}
                            alt={`Reference ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setUploadedImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </motion.button>
                          <div className="absolute bottom-2 left-2 bg-background px-2 py-1 text-[10px] text-foreground rounded font-mono">
                            {idx + 1}/{uploadedImages.length}
                          </div>
                        </motion.div>
                      ))}
                      {uploadedImages.length < 3 && (
                        <motion.label
                          whileHover={{ borderColor: "var(--primary)" }}
                          className="aspect-video border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/20 flex items-center justify-center transition-all"
                        >
                          <Plus size={24} className="text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </motion.label>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Select Outcome */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xs font-bold text-muted-foreground mb-6 uppercase tracking-widest">
                  Step 3: Select Story Outcome
                </h3>
                <div className="space-y-2">
                  {outcomes.map((outcome, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => setSelectedOutcome(idx)}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all duration-150
                        ${
                          selectedOutcome === idx
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/40"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selectedOutcome === idx ? "border-primary bg-primary" : "border-border"
                              }`}
                            >
                              {selectedOutcome === idx && (
                                <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-foreground">{outcome.title}</h4>
                          </div>
                          <p className="text-[11px] text-muted-foreground ml-7">{outcome.desc}</p>
                        </div>
                        <AnimatePresence>
                          {selectedOutcome === idx && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Check size={16} className="text-primary" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 4: Review & Generate */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xs font-bold text-muted-foreground mb-6 uppercase tracking-widest">
                  Step 4: Review & Generate
                </h3>
                <div className="space-y-3">
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="p-4 border border-border rounded-lg bg-card"
                  >
                    <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wider">
                      Selected Archetype
                    </div>
                    <div className="text-sm font-bold text-foreground">{archetypes[selectedArch ?? 0]?.title}</div>
                    <div className="text-[10px] text-primary mt-1">
                      {beatStructures[selectedArch ?? 0]?.length} beats
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-4 border border-border rounded-lg bg-card"
                  >
                    <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wider">
                      Reference Images
                    </div>
                    <div className="text-sm text-foreground">
                      {uploadedImages.length} image{uploadedImages.length !== 1 ? "s" : ""} uploaded
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="p-4 border border-border rounded-lg bg-card"
                  >
                    <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wider">Story Outcome</div>
                    <div className="text-sm font-bold text-foreground">{outcomes[selectedOutcome ?? 0]?.title}</div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-border flex items-center justify-between px-6 bg-muted/50">
          <motion.button
            whileHover={{ scale: currentStep === 1 ? 1 : 1.02 }}
            whileTap={{ scale: currentStep === 1 ? 1 : 0.98 }}
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-4 py-2 border border-border rounded-lg text-muted-foreground text-[10px] hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-wider font-bold flex items-center gap-2 ${
              currentStep === 1 ? "opacity-30 cursor-not-allowed" : ""
            }`}
          >
            <ChevronLeft size={14} />
            Back
          </motion.button>

          <motion.button
            whileHover={{ scale: canProceed() ? 1.02 : 1 }}
            whileTap={{ scale: canProceed() ? 0.98 : 1 }}
            onClick={handleGenerateClick}
            disabled={!canProceed()}
            className={`px-5 py-2 rounded-lg text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 transition-colors ${
              canProceed()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {currentStep === 4 ? (
              <>
                <Sparkles size={14} />
                Generate Story
              </>
            ) : (
              <>
                Next
                <ChevronRight size={14} />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
