"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Upload, Sparkles, Plus, ImageIcon, Clapperboard } from "lucide-react"
import { archetypes, outcomes, beatStructures } from "@/lib/data"
import type { StoryBeat } from "@/lib/types"
import { getBeatPercentage, autoGenerateBeatIdea } from "@/lib/story-generator"

interface SetupPanelProps {
  onClose: () => void
  onGenerate: (beats: StoryBeat[], archIdx: number, referenceImageUrl?: string, storyId?: string, title?: string, logline?: string) => void
}

export function SetupPanel({ onClose, onGenerate }: SetupPanelProps) {
  const [selectedArch, setSelectedArch] = useState<number | null>(null)
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; previewUrl: string }>>([])
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - uploadedImages.length)
    const newEntries = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    setUploadedImages(prev => [...prev, ...newEntries].slice(0, 3))
  }, [uploadedImages.length])

  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => {
      const item = prev[index]
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // Images required for full pipeline
  const canGenerate = selectedArch !== null && selectedOutcome !== null && uploadedImages.length > 0

  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!canGenerate) return
    
    setIsGenerating(true)
    setError(null)

    try {
      // Upload reference images to Nextcloud first
      const formData = new FormData()
      uploadedImages.forEach((img) => formData.append("images", img.file))

      const uploadResponse = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      })

      const uploadData = await uploadResponse.json()

      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(uploadData.error || "Image upload failed")
      }

      const uploadedUrls: string[] = uploadData.urls || []

      // Call the story generation API with uploaded URLs
      const response = await fetch('/api/story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archetypeIndex: selectedArch,
          archetypeName: archetypes[selectedArch!].title,
          outcomeName: outcomes[selectedOutcome!].title,
          referenceImages: uploadedUrls,
          totalDuration: 90,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Story generation failed')
      }

      // Store session ID for future use
      if (typeof window !== 'undefined') {
        localStorage.setItem('storyception_session', data.storyId)
      }

      // Convert API response to StoryBeat format
      const beats: StoryBeat[] = data.beats.map((beat: {
        id: string
        label: string
        scene_description: string
        duration_seconds: number
        keyframe_prompts: string[]
        index: number
        status: string
        gridImageUrl: string | null
        keyframeUrls?: string[]
      }, idx: number) => {
        const percentage = getBeatPercentage(beat.id) || (100 / data.beats.length)
        
        return {
          id: idx + 1,
          label: beat.label,
          duration: `${beat.duration_seconds || 6}s`,
          percentOfTotal: percentage,
          img: `linear-gradient(135deg, hsl(${180 + idx * 15}, 70%, ${15 + idx * 2}%), hsl(${195 + idx * 10}, 60%, ${10 + idx * 2}%))`,
          desc: beat.scene_description,
          beatId: beat.id,
          generatedIdea: beat.scene_description,
          keyframePrompts: beat.keyframe_prompts,
          status: beat.status,
          gridImageUrl: beat.gridImageUrl,
          frames: beat.keyframeUrls,
        }
      })

      console.log(`✅ Story generated: ${data.storyId} with ${beats.length} beats`)
      onGenerate(beats, selectedArch ?? 0, uploadedUrls[0], data.storyId, data.title, data.logline)
      setIsGenerating(false)
      onClose()
    } catch (err) {
      console.error('Story generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate story')
      setIsGenerating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-[95vw] max-w-[1100px] max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Clapperboard size={20} className="text-zinc-950" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 tracking-wide">Create New Story</h2>
              <p className="text-[11px] text-zinc-500">Choose your narrative structure</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center"
          >
            <X size={16} />
          </motion.button>
        </div>

        {/* Loading Overlay */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-zinc-950/95 flex flex-col items-center justify-center"
            >
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full"
                />
                <Sparkles className="absolute inset-0 m-auto text-cyan-400" size={24} />
              </div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 text-center"
              >
                <div className="text-cyan-400 font-mono text-sm tracking-wider">CRAFTING YOUR STORY</div>
                <div className="text-zinc-500 text-xs mt-2">Generating story beats with AI...</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        <AnimatePresence>
          {error && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              <X size={14} />
              {error}
              <button onClick={() => setError(null)} className="ml-2 hover:text-red-300">
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content - Three Sections */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Section 1: Archetype Selection */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-cyan-400">1</span>
                </div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Narrative Archetype
                </h3>
                {selectedArch !== null && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto"
                  >
                    <Check size={14} className="text-cyan-400" />
                  </motion.div>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {archetypes.map((arch, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedArch(idx)}
                    className={`
                      relative p-4 rounded-xl border-2 text-left transition-all duration-150
                      ${selectedArch === idx
                        ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                      }
                    `}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-xs font-bold text-zinc-200 leading-tight">{arch.title}</h4>
                      <AnimatePresence>
                        {selectedArch === idx && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                          >
                            <div className="w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center">
                              <Check size={10} className="text-zinc-950" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="text-[9px] text-cyan-400 font-bold mb-1.5 tracking-wide">{arch.subtitle}</p>
                    <p className="text-[10px] text-zinc-500 mb-2 line-clamp-2">{arch.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-600 italic">{arch.example}</span>
                      <span className="text-[9px] text-zinc-600 font-mono">{beatStructures[idx].length} beats</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Right Column: Images + Outcome */}
            <div className="space-y-6">
              
              {/* Section 2: Image Upload */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-cyan-400">2</span>
                  </div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Reference Images
                  </h3>
                  {uploadedImages.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto"
                    >
                      <Check size={14} className="text-cyan-400" />
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {uploadedImages.map((img, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800 group"
                    >
                      <img src={img.previewUrl} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </motion.button>
                    </motion.div>
                  ))}
                  
                  {uploadedImages.length < 3 && (
                    <motion.label
                      whileHover={{ borderColor: "#22d3ee" }}
                      className={`
                        aspect-square border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer 
                        hover:bg-zinc-900/50 flex flex-col items-center justify-center transition-all
                        ${uploadedImages.length === 0 ? "col-span-3" : ""}
                      `}
                    >
                      {uploadedImages.length === 0 ? (
                        <>
                          <ImageIcon size={24} className="text-zinc-600 mb-2" />
                          <span className="text-[10px] text-zinc-500 text-center px-2">
                            Drop images or click
                          </span>
                          <span className="text-[9px] text-zinc-600 mt-1">1-3 images</span>
                        </>
                      ) : (
                        <Plus size={20} className="text-zinc-600" />
                      )}
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
              </div>

              {/* Section 3: Outcome Selection */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-cyan-400">3</span>
                  </div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Story Outcome
                  </h3>
                  {selectedOutcome !== null && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto"
                    >
                      <Check size={14} className="text-cyan-400" />
                    </motion.div>
                  )}
                </div>

                <div className="space-y-2">
                  {outcomes.map((outcome, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedOutcome(idx)}
                      className={`
                        w-full p-3 rounded-lg border-2 text-left transition-all duration-150
                        ${selectedOutcome === idx
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedOutcome === idx ? "border-cyan-500 bg-cyan-500" : "border-zinc-600"
                          }`}
                        >
                          {selectedOutcome === idx && (
                            <div className="w-1 h-1 bg-zinc-950 rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-zinc-200">{outcome.title}</div>
                          <div className="text-[10px] text-zinc-500">{outcome.desc}</div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 border-t border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className={selectedArch !== null ? "text-cyan-400" : ""}>
              {selectedArch !== null ? `✓ ${archetypes[selectedArch].title}` : "Select archetype"}
            </span>
            <span className="text-zinc-700">•</span>
            <span className={uploadedImages.length > 0 ? "text-cyan-400" : "text-zinc-600"}>
              {uploadedImages.length > 0 ? `✓ ${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}` : "Add image"}
            </span>
            <span className="text-zinc-700">•</span>
            <span className={selectedOutcome !== null ? "text-cyan-400" : ""}>
              {selectedOutcome !== null ? `✓ ${outcomes[selectedOutcome].title}` : "Pick outcome"}
            </span>
          </div>

          <motion.button
            whileHover={{ scale: canGenerate ? 1.02 : 1 }}
            whileTap={{ scale: canGenerate ? 0.98 : 1 }}
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`
              px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold flex items-center gap-2 transition-all
              ${canGenerate
                ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-zinc-950 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }
            `}
          >
            <Sparkles size={14} />
            Begin Your Story
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
