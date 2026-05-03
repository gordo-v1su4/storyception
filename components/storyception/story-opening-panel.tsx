"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { archetypes, outcomes, beatStructures } from "@/lib/data"
import type { StoryBeat } from "@/lib/types"
import { getBeatPercentage } from "@/lib/story-generator"

interface StoryOpeningPanelProps {
  onClose: () => void
  onGenerate: (
    beats: StoryBeat[],
    archIdx: number,
    referenceImageUrl?: string,
    storyId?: string,
    title?: string,
    logline?: string,
    storySeed?: string,
    outcomeName?: string
  ) => void
}

export function StoryOpeningPanel({ onClose, onGenerate }: StoryOpeningPanelProps) {
  const [selectedArchetypeIndex, setSelectedArchetypeIndex] = useState<number | null>(null)
  const [imageSlots, setImageSlots] = useState<Array<{ file: File; url: string }>>([])
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const flatArchetypes = useMemo(() => [...archetypes], [])

  const allDone =
    selectedArchetypeIndex !== null && imageSlots.length > 0 && selectedOutcomeIndex !== null

  const imageSlotsRef = useRef(imageSlots)
  imageSlotsRef.current = imageSlots

  useEffect(() => {
    return () => {
      imageSlotsRef.current.forEach((s) => URL.revokeObjectURL(s.url))
    }
  }, [])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return
      const remaining = 3 - imageSlots.length
      if (remaining <= 0) return
      const toAdd = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining)
      if (toAdd.length === 0) return
      setImageSlots((prev) => [
        ...prev,
        ...toAdd.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ].slice(0, 3))
    },
    [imageSlots.length]
  )

  const removeImage = useCallback((index: number) => {
    setImageSlots((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed?.url) URL.revokeObjectURL(removed.url)
      return next
    })
  }, [])

  const handleBegin = async () => {
    if (selectedArchetypeIndex === null || selectedOutcomeIndex === null || imageSlots.length === 0) {
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const formData = new FormData()
      imageSlots.forEach((s) => formData.append("images", s.file))

      const uploadResponse = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      })
      const uploadData = await uploadResponse.json()
      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(uploadData.error || "Image upload failed")
      }
      const uploadedUrls: string[] = uploadData.urls || []

      const arch = archetypes[selectedArchetypeIndex]
      const out = outcomes[selectedOutcomeIndex]

      const response = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archetypeIndex: selectedArchetypeIndex,
          archetypeName: arch.title,
          outcomeName: out.title,
          referenceImages: uploadedUrls,
          totalDuration: 90,
        }),
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Story generation failed")
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("storyception_session", data.storyId)
      }

      const beats: StoryBeat[] = data.beats.map(
        (
          beat: {
            id: string
            label: string
            scene_description: string
            duration_seconds: number
            keyframe_prompts: string[]
            index: number
            status: string
            gridImageUrl: string | null
            keyframeUrls?: string[]
          },
          idx: number
        ) => {
          const percentage = getBeatPercentage(beat.id) || 100 / data.beats.length
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
        }
      )

      onGenerate(
        beats,
        selectedArchetypeIndex,
        uploadedUrls[0],
        data.storyId,
        data.title,
        data.logline,
        data.storySeed,
        out.title
      )
      setIsGenerating(false)
      onClose()
    } catch (err) {
      console.error("Story opening error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate story")
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a] text-[#a0a0a0] font-sans antialiased">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[#1a1a1a] px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <svg
            className="h-5 w-5 flex-shrink-0 text-[#555]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <path d="m7 2 0 20" />
            <path d="m17 2 0 20" />
            <path d="M2 12h20" />
            <path d="M2 7h5" />
            <path d="M2 17h5" />
            <path d="M17 7h5" />
            <path d="M17 17h5" />
          </svg>
          <span className="truncate text-[13px] font-medium tracking-tight text-[#ccc]">
            Create New Story
          </span>
          <span className="hidden text-[11px] text-[#444] sm:inline">
            — choose structure, add references, pick outcome
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-[#444] transition-colors hover:text-[#888]"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="flex-shrink-0 border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-center text-[12px] text-red-400">
          {error}
          <button type="button" className="ml-3 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0a]/95">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.15em] text-[#666]">
            Crafting your story
          </p>
        </div>
      )}

      {/* Main */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[45vh] min-w-0 flex-1 flex-col border-b border-[#1a1a1a] lg:border-b-0 lg:border-r">
          <div className="flex-shrink-0 px-5 pb-1.5 pt-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#444]">
              1 · Narrative Archetype
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            <div className="grid grid-cols-1 gap-px bg-[#1a1a1a] overflow-hidden rounded-lg sm:grid-cols-2 lg:grid-cols-3">
              {flatArchetypes.map((a) => {
                const idx = archetypes.indexOf(a)
                const sel = selectedArchetypeIndex === idx
                const beatCount = beatStructures[idx]?.length ?? 0
                return (
                  <button
                    key={`${a.title}-${idx}`}
                    type="button"
                    onClick={() => setSelectedArchetypeIndex(sel ? null : idx)}
                    className={`relative cursor-pointer p-3 text-left transition-colors duration-100 ${
                      sel ? "z-10 bg-[#141414] ring-1 ring-white/[0.12]" : "bg-[#0e0e0e] hover:bg-[#131313]"
                    }`}
                  >
                    {sel && (
                      <div className="absolute right-2 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
                        <svg className="h-2.5 w-2.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    <div className="text-[12px] font-semibold uppercase leading-tight tracking-wide text-[#e0e0e0]">
                      {a.title}
                    </div>
                    <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-[#555]">
                      {a.subtitle}
                    </div>
                    <div className="mt-1.5 text-[11px] leading-snug text-[#666]">{a.desc}</div>
                    <div className="mt-2 flex items-center justify-between border-t border-[#1a1a1a] pt-1.5">
                      <span className="text-[9px] text-[#3a3a3a]">{a.example}</span>
                      <span className="tabular-nums text-[9px] text-[#3a3a3a]">{beatCount} beats</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-shrink-0 flex-col lg:w-[300px]">
          <div className="flex min-h-[180px] flex-1 flex-col border-b border-[#1a1a1a]">
            <div className="flex-shrink-0 px-4 pb-1.5 pt-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#444]">
                2 · Reference Images
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
              {imageSlots.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {imageSlots.map((slot, i) => (
                    <div key={slot.url} className="group relative h-16 w-16 overflow-hidden rounded bg-[#111]">
                      <img src={slot.url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove image"
                      >
                        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {imageSlots.length < 3 && (
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    handleFiles(e.dataTransfer.files)
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={`flex min-h-[120px] flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors ${
                    isDragging ? "border-[#444] bg-[#111]" : "border-[#1e1e1e] bg-transparent hover:border-[#333]"
                  }`}
                >
                  <svg className="mb-1 h-5 w-5 text-[#2a2a2a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  <span className="text-[10px] text-[#333]">
                    Drop or click · {imageSlots.length}/3
                  </span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                </div>
              )}
              {imageSlots.length >= 3 && (
                <div className="flex flex-1 items-center justify-center">
                  <span className="text-[10px] text-[#333]">3/3 images added</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[200px] flex-1 flex-col">
            <div className="flex-shrink-0 px-4 pb-1.5 pt-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#444]">
                3 · Story Outcome
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-4 pb-3">
              {outcomes.map((o, oi) => {
                const sel = selectedOutcomeIndex === oi
                return (
                  <button
                    key={o.title}
                    type="button"
                    onClick={() => setSelectedOutcomeIndex(sel ? null : oi)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-100 ${
                      sel ? "bg-[#161616]" : "bg-transparent hover:bg-[#111]"
                    }`}
                  >
                    <div
                      className={`flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        sel ? "border-white" : "border-[#333]"
                      }`}
                    >
                      {sel && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className={`text-[11px] font-semibold uppercase tracking-wide ${sel ? "text-white" : "text-[#888]"}`}>
                        {o.title}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-tight text-[#444]">{o.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#1a1a1a] px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          {(
            [
              { label: "Archetype", done: selectedArchetypeIndex !== null },
              { label: "Images", done: imageSlots.length > 0 },
              { label: "Outcome", done: selectedOutcomeIndex !== null },
            ] as const
          ).map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {s.done ? (
                <svg className="h-3 w-3 text-[#666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <div className="h-1 w-1 rounded-full bg-[#333]" />
              )}
              <span className={`text-[11px] ${s.done ? "text-[#777]" : "text-[#333]"}`}>{s.label}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!allDone || isGenerating}
          onClick={handleBegin}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-medium uppercase tracking-wide transition-colors ${
            allDone && !isGenerating
              ? "cursor-pointer bg-white text-black hover:bg-[#e0e0e0] active:bg-[#ccc]"
              : "cursor-not-allowed bg-[#141414] text-[#333]"
          }`}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Begin Story
        </button>
      </div>
    </div>
  )
}
