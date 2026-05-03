"use client"

import { useMemo, useRef, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  OPENING_ARCHETYPES,
  OPENING_OUTCOMES,
  OPENING_CATEGORIES,
  OPENING_ARCHETYPE_ID_TO_API_INDEX,
  type OpeningArchetype,
  type OpeningOutcome,
} from "@/lib/story-opening-data"
import { archetypes, outcomes } from "@/lib/data"
import type { StoryBeat } from "@/lib/types"
import { getBeatPercentage } from "@/lib/story-generator"

type RefSlot = { id: string; url: string; name: string; file: File }

const accentText: Record<string, string> = {
  cyan: "text-cyan-400",
  fuchsia: "text-fuchsia-400",
  amber: "text-amber-400",
}

const OUTCOME_ID_TO_INDEX: Record<string, number> = {
  happy: 0,
  tragedy: 1,
  redemption: 2,
  ambiguous: 3,
}

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
  const [archetype, setArchetype] = useState<OpeningArchetype | null>(null)
  const [hovered, setHovered] = useState<OpeningArchetype | null>(null)
  const [outcome, setOutcome] = useState<OpeningOutcome | null>(null)
  const [images, setImages] = useState<RefSlot[]>([])
  const [category, setCategory] = useState<(typeof OPENING_CATEGORIES)[number]>("All")
  const [drag, setDrag] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef(images)
  imagesRef.current = images

  const filtered = useMemo(
    () =>
      category === "All"
        ? OPENING_ARCHETYPES
        : OPENING_ARCHETYPES.filter((a) => a.category === category),
    [category]
  )

  const completion = useMemo(() => {
    let score = 0
    if (archetype) score += 1
    if (images.length > 0) score += 1
    if (outcome) score += 1
    return score
  }, [archetype, images.length, outcome])

  const ready = completion === 3
  const showcase = hovered ?? archetype

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url))
    }
  }, [])

  const resetForm = useCallback(() => {
    setImages((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.url))
      return []
    })
    setArchetype(null)
    setOutcome(null)
    setCategory("All")
    setHovered(null)
    setError(null)
  }, [])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const remaining = 3 - images.length
    if (remaining <= 0) return
    const next: RefSlot[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue
      if (next.length >= remaining) break
      next.push({
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        url: URL.createObjectURL(f),
        name: f.name,
        file: f,
      })
    }
    if (next.length === 0) return
    setImages((prev) => [...prev, ...next].slice(0, 3))
  }

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((i) => i.id !== id)
    })
  }

  const handleGenerate = async () => {
    if (!archetype || !outcome || images.length === 0) return

    const apiIndex = OPENING_ARCHETYPE_ID_TO_API_INDEX[archetype.id]
    if (apiIndex === undefined) {
      setError("Unknown archetype mapping")
      return
    }
    const outIdx = OUTCOME_ID_TO_INDEX[outcome.id]
    if (outIdx === undefined) {
      setError("Unknown outcome")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const formData = new FormData()
      images.forEach((s) => formData.append("images", s.file))

      const uploadResponse = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      })
      const uploadData = await uploadResponse.json()
      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(uploadData.error || "Image upload failed")
      }
      const uploadedUrls: string[] = uploadData.urls || []

      const arch = archetypes[apiIndex]
      const out = outcomes[outIdx]

      const response = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archetypeIndex: apiIndex,
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

      onGenerate(beats, apiIndex, uploadedUrls[0], data.storyId, data.title, data.logline, data.storySeed, out.title)
      setIsGenerating(false)
      onClose()
    } catch (err) {
      console.error("Story opening error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate story")
      setIsGenerating(false)
    }
  }

  return (
    <div className="opening-panel-root fixed inset-0 z-[100] flex min-h-0 flex-col bg-[#0a0a0a] text-[#a0a0a0] selection:bg-cyan-500/15 selection:text-[#e6edf3]">
      <header className="flex h-9 flex-shrink-0 select-none items-center border-b border-[#1a1a1a] bg-[#0e0e0e] px-3 text-[12px] text-[#666]">
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-cyan-600 text-[10px] font-bold text-[#0a0a0a]">
            S
          </div>
          <span className="text-[#ccc]">Storyception</span>
          <span className="text-[#444]">—</span>
          <span className="text-[#888]">New Story</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center text-[#555] hover:bg-white/[0.04] hover:text-[#888]"
            title="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex h-7 flex-shrink-0 select-none items-center gap-1 border-b border-[#1a1a1a] bg-[#0e0e0e] px-2 text-[12px] text-[#888]">
        {["File", "Edit", "View", "Story", "Tools", "Help"].map((m) => (
          <button key={m} type="button" className="h-6 rounded-sm px-2 hover:bg-white/[0.06]">
            {m}
          </button>
        ))}
      </div>

      <div className="flex h-10 flex-shrink-0 items-center gap-3 border-b border-[#1a1a1a] bg-[#0e0e0e] px-3 text-[12px] text-[#888]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetForm}
            className="h-7 rounded-sm border border-transparent px-2 hover:border-white/[0.08] hover:bg-white/[0.05]"
            title="New"
          >
            ＋ New
          </button>
          <button
            type="button"
            className="h-7 rounded-sm border border-transparent px-2 hover:border-white/[0.08] hover:bg-white/[0.05]"
            title="Open (coming soon)"
            disabled
          >
            ⌂ Open
          </button>
          <button
            type="button"
            className="h-7 rounded-sm border border-transparent px-2 hover:border-white/[0.08] hover:bg-white/[0.05]"
            title="Save (coming soon)"
            disabled
          >
            💾 Save
          </button>
        </div>
        <div className="h-5 w-px bg-[#1a1a1a]" />
        <div className="flex items-center gap-2 text-[#555]">
          <span>Project</span>
          <span className="text-[#444]">›</span>
          <span className="text-[#b0b0b0]">Untitled Story</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[#555]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Ready</span>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 border-b border-red-500/40 bg-red-950/40 px-3 py-2 text-center text-[12px] text-red-300">
          {error}
          <button type="button" className="ml-3 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-[#0a0a0a]/95">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/25 border-t-cyan-400" />
          <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-[#555]">Generating story…</p>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-hidden p-3">
        <div className="grid h-[min(100%,calc(100dvh-8.5rem))] grid-cols-1 gap-3 lg:grid-cols-12">
          <section className="flex min-h-[320px] flex-col overflow-hidden rounded-sm border border-[#1a1a1a] bg-[#0a0a0a] lg:col-span-8">
            <div className="flex h-9 flex-shrink-0 items-center border-b border-[#1a1a1a] bg-[#0e0e0e] px-3 text-[11px] font-medium uppercase tracking-wider text-[#666]">
              <span className="text-[#e0e0e0]">Story Configuration</span>
              <span className="ml-3 normal-case tracking-normal text-[#444]">— Choose your narrative structure</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <Section number={1} title="Narrative Archetype" status={archetype ? "done" : "pending"}>
                <div className="mb-3 flex flex-wrap items-center gap-1">
                  {OPENING_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`h-7 rounded-sm border px-2.5 text-[12px] transition-colors ${
                        category === c
                          ? "border-cyan-700 bg-cyan-600 text-[#0a0a0a] hover:bg-cyan-500"
                          : "border-[#1a1a1a] bg-[#131313] text-[#b0b0b0] hover:bg-[#161616]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-[#555]">{filtered.length} templates</span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((a) => {
                    const selected = archetype?.id === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setArchetype(a)}
                        onMouseEnter={() => setHovered(a)}
                        onMouseLeave={() => setHovered(null)}
                        className={`rounded-sm border p-3 text-left transition-colors ${
                          selected
                            ? "border-cyan-600/50 bg-[#0e1620] ring-1 ring-cyan-500/15"
                            : "border-[#1a1a1a] bg-[#131313] hover:border-[#2a2a2a] hover:bg-[#161616]"
                        }`}
                      >
                        <div className="mb-1.5 flex items-start justify-between">
                          <div className="text-[13px] font-medium leading-tight text-[#e0e0e0]">{a.name}</div>
                          {selected && (
                            <div className="ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-cyan-500 text-[10px] text-[#0a0a0a]">
                              ✓
                            </div>
                          )}
                        </div>
                        <div className={`mb-2 text-[10px] uppercase tracking-wider ${accentText[a.accent]}`}>{a.engine}</div>
                        <div className="mb-3 min-h-[2.5rem] text-[12px] leading-snug text-[#666]">{a.description}</div>
                        <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-2 text-[11px]">
                          <span className="truncate pr-2 italic text-[#555]">{a.examples}</span>
                          <span className="shrink-0 tabular-nums text-[#888]">{a.beats} beats</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Section>

              <Divider />

              <Section
                number={2}
                title="Reference Images"
                status={images.length > 0 ? "done" : "pending"}
                subtitle="1–3 images"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDrag(true)
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDrag(false)
                    handleFiles(e.dataTransfer.files)
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`cursor-pointer rounded-sm border border-dashed p-4 transition-colors ${
                    drag ? "border-cyan-500 bg-cyan-950/20" : "border-[#252525] bg-[#131313] hover:bg-[#161616]"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => {
                      const img = images[i]
                      if (img) {
                        return (
                          <div
                            key={img.id}
                            className="group relative aspect-[4/3] overflow-hidden rounded-sm border border-[#1a1a1a] bg-black"
                          >
                            <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeImage(img.id)
                              }}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm bg-black/80 text-[11px] text-white opacity-0 hover:bg-red-600 group-hover:opacity-100"
                              title="Remove"
                            >
                              ✕
                            </button>
                            <div className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1.5 py-0.5 text-[10px] text-[#ccc]">
                              {img.name}
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div
                          key={i}
                          className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-[#2a2a2a] text-[11px] text-[#555]"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="1" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                          </svg>
                          <span>Slot {i + 1}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-[#555]">
                    <span>Drag and drop image files, or click to browse</span>
                    <span className="tabular-nums">
                      {images.length} / 3
                    </span>
                  </div>
                </div>
              </Section>

              <Divider />

              <Section number={3} title="Story Outcome" status={outcome ? "done" : "pending"}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {OPENING_OUTCOMES.map((o) => {
                    const selected = outcome?.id === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setOutcome(o)}
                        className={`flex items-start gap-3 rounded-sm border p-3 text-left transition-colors ${
                          selected
                            ? "border-cyan-600/50 bg-[#0e1620] ring-1 ring-cyan-500/15"
                            : "border-[#1a1a1a] bg-[#131313] hover:border-[#2a2a2a] hover:bg-[#161616]"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                            selected ? "border-cyan-400 bg-cyan-500" : "border-[#444]"
                          }`}
                        >
                          {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#e0e0e0]">
                            <span>{o.emoji}</span>
                            <span>{o.name}</span>
                          </div>
                          <div className="mt-0.5 text-[12px] leading-snug text-[#666]">{o.description}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Section>
            </div>
          </section>

          <aside className="flex min-h-[280px] flex-col overflow-hidden rounded-sm border border-[#1a1a1a] bg-[#0a0a0a] lg:col-span-4">
            <div className="flex h-9 flex-shrink-0 items-center border-b border-[#1a1a1a] bg-[#0e0e0e] px-3 text-[11px] font-medium uppercase tracking-wider">
              <span className="text-[#e0e0e0]">Inspector</span>
              <span className="ml-auto normal-case tracking-normal text-[#555]">{completion}/3 complete</span>
            </div>

            <div className="h-1 bg-[#1a1a1a]">
              <div className="h-full bg-cyan-500 transition-all" style={{ width: `${(completion / 3) * 100}%` }} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <InspectorBlock label="Archetype">
                {showcase ? (
                  <div>
                    <div className="text-[13px] font-medium text-[#e0e0e0]">{showcase.name}</div>
                    <div className={`mt-0.5 text-[10px] uppercase tracking-wider ${accentText[showcase.accent]}`}>
                      {showcase.engine}
                    </div>
                    <div className="mt-1.5 text-[11px] italic text-[#555]">{showcase.examples}</div>
                  </div>
                ) : (
                  <Empty>No archetype selected</Empty>
                )}
              </InspectorBlock>

              <InspectorBlock label={`Beat Structure ${showcase ? `(${showcase.beatList.length})` : ""}`}>
                {showcase ? (
                  <ol className="space-y-px">
                    {showcase.beatList.map((b, i) => (
                      <li
                        key={`${b}-${i}`}
                        className="flex h-6 items-center gap-2 rounded-sm px-2 text-[12px] text-[#aaa] hover:bg-white/[0.04]"
                      >
                        <span className="w-9 text-right tabular-nums text-[#555]">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-[#444]">·</span>
                        <span className="truncate">{b}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty>Beats will appear here</Empty>
                )}
              </InspectorBlock>

              <InspectorBlock label={`References (${images.length})`}>
                {images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="aspect-square overflow-hidden rounded-sm border border-[#1a1a1a] bg-black"
                      >
                        <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>No images attached</Empty>
                )}
              </InspectorBlock>

              <InspectorBlock label="Outcome">
                {outcome ? (
                  <div>
                    <div className="text-[13px] font-medium text-[#e0e0e0]">
                      {outcome.emoji} {outcome.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#666]">{outcome.description}</div>
                  </div>
                ) : (
                  <Empty>No outcome chosen</Empty>
                )}
              </InspectorBlock>

              <InspectorBlock label="Validation">
                <ul className="space-y-1 text-[12px]">
                  <CheckRow ok={!!archetype} label="Archetype selected" />
                  <CheckRow ok={images.length > 0} label="At least one reference image" />
                  <CheckRow ok={!!outcome} label="Outcome chosen" />
                </ul>
              </InspectorBlock>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2 border-t border-[#1a1a1a] bg-[#0e0e0e] p-2">
              <button
                type="button"
                onClick={resetForm}
                className="h-8 rounded-sm border border-[#1a1a1a] bg-[#141414] px-3 text-[12px] text-[#ccc] hover:bg-[#1a1a1a]"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={!ready || isGenerating}
                onClick={handleGenerate}
                className={`h-8 flex-1 rounded-sm border text-[12px] font-medium transition-colors ${
                  ready && !isGenerating
                    ? "border-cyan-700 bg-cyan-600 text-[#0a0a0a] hover:bg-cyan-500"
                    : "cursor-not-allowed border-[#1a1a1a] bg-[#141414] text-[#444]"
                }`}
              >
                {ready ? "Generate Story →" : `Complete ${3 - completion} more step${3 - completion === 1 ? "" : "s"}`}
              </button>
            </div>
          </aside>
        </div>
      </main>

      <footer className="flex h-6 flex-shrink-0 items-center gap-4 border-t border-[#1a1a1a] bg-[#0e0e0e] px-3 text-[11px] text-[#555]">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
          {ready ? "Ready to generate" : "Awaiting input"}
        </span>
        <span>Archetype: {archetype?.name ?? "—"}</span>
        <span>
          Images: {images.length}/3
        </span>
        <span>Outcome: {outcome?.name ?? "—"}</span>
        <span className="ml-auto">Storyception</span>
      </footer>
    </div>
  )
}

function Section({
  number,
  title,
  subtitle,
  status,
  children,
}: {
  number: number
  title: string
  subtitle?: string
  status: "done" | "pending"
  children: ReactNode
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-sm text-[11px] font-medium ${
            status === "done"
              ? "bg-cyan-600 text-[#0a0a0a]"
              : "border border-[#1a1a1a] bg-[#161616] text-[#666]"
          }`}
        >
          {status === "done" ? "✓" : number}
        </div>
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[#e0e0e0]">{title}</h2>
        {subtitle && <span className="text-[11px] text-[#555]">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="mx-4 h-px bg-[#1a1a1a]" />
}

function InspectorBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-[#1a1a1a]">
      <div className="flex h-7 items-center bg-[#101010] px-3 text-[10px] font-medium uppercase tracking-wider text-[#666]">
        {label}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="text-[12px] italic text-[#555]">{children}</div>
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[#666]">
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[9px] ${
          ok ? "border-emerald-800 bg-emerald-600 text-white" : "border-[#333] bg-[#131313] text-transparent"
        }`}
      >
        ✓
      </span>
      <span className={ok ? "text-[#ccc]" : ""}>{label}</span>
    </li>
  )
}
