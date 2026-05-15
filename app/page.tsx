"use client"

import { useState, useCallback, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { Header } from "@/components/storyception/header"
import { StoryOpeningPanel } from "@/components/storyception/story-opening-panel"
import { StoryCanvas } from "@/components/storyception/story-canvas"
import { FlowCanvas } from "@/components/storyception/flow-canvas"
import { Timeline } from "@/components/storyception/timeline"
import type { StoryBeat } from "@/lib/types"
import type { CharacterRecord } from "@/lib/storyception-schema"

export default function StoryceptionPage() {
  const [storyBeats, setStoryBeats] = useState<StoryBeat[]>([])
  const [showModal, setShowModal] = useState(false) // Start false, show after checking for session
  const [isLoading, setIsLoading] = useState(true) // Loading state for session check
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"flow" | "cards">("flow")
  const [sessionId, setSessionId] = useState<string | null>(null)

  const [currentBeatIndex, setCurrentBeatIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null,
  )
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [characters, setCharacters] = useState<CharacterRecord[]>([])
  const [archetypeIndex, setArchetypeIndex] = useState(0)
  const [storyTitle, setStoryTitle] = useState("")
  const [storyLogline, setStoryLogline] = useState("")
  const [storySeed, setStorySeed] = useState("")
  const [outcomeName, setOutcomeName] = useState("")

  // Load existing session on mount
  useEffect(() => {
    const loadExistingSession = async () => {
      const savedSessionId = localStorage.getItem("storyception_session")

      if (!savedSessionId) {
        setIsLoading(false)
        setShowModal(true)
        return
      }

      try {
        console.log(`🔄 Loading session: ${savedSessionId}`)
        const response = await fetch(`/api/story/${savedSessionId}`)
        const data = await response.json()

        if (data.success && data.beats && data.beats.length > 0) {
          // Convert API response to StoryBeat format
          // Note: beat.id from API is 0-indexed, but UI expects 1-indexed
          const beats: StoryBeat[] = data.beats.map(
            (
              beat: {
                id: number
                beatId: string
                label: string
                desc: string
                generatedIdea: string
                duration: string
                percentOfTotal: number
                status: string
                branches?: Array<{
                  id: number
                  branchId: string
                  title: string
                  desc: string
                  type: string
                  duration: string
                  selected: boolean
                  depth: number
                }>
                keyframeUrls?: string[]
              },
              idx: number,
            ) => ({
              id: idx + 1, // UI expects 1-indexed IDs
              beatId: beat.beatId,
              label: beat.label,
              desc: beat.desc,
              generatedIdea: beat.generatedIdea,
              duration: beat.duration,
              percentOfTotal:
                beat.percentOfTotal || Math.round(100 / data.beats.length),
              img: `linear-gradient(135deg, hsl(${180 + idx * 15}, 70%, ${15 + idx * 2}%), hsl(${195 + idx * 10}, 60%, ${10 + idx * 2}%))`,
              status: beat.status,
              branches: beat.branches?.map((b, bIdx) => ({
                id: bIdx + 1, // Branch IDs also 1-indexed
                title: b.title,
                desc: b.desc,
                type: b.type as "direct" | "hidden" | "sacrifice",
                duration: b.duration,
                selected: b.selected,
                depth: b.depth,
              })),
              frames: beat.keyframeUrls,
            }),
          )

          setStoryBeats(beats)
          setSessionId(savedSessionId)

          // Restore progressive generation state from session data
          if (data.storyData?.storySeed) setStorySeed(data.storyData.storySeed)
          if (data.storyData?.storyTitle)
            setStoryTitle(data.storyData.storyTitle)
          if (data.storyData?.storyLogline)
            setStoryLogline(data.storyData.storyLogline)
          if (data.storyData?.outcomeName)
            setOutcomeName(data.storyData.outcomeName)
          else if (data.outcome) setOutcomeName(data.outcome)
          const restoredReferenceImages = Array.isArray(data.referenceImages)
            ? data.referenceImages
            : []
          if (data.referenceImageUrl)
            setReferenceImageUrl(data.referenceImageUrl)
          setReferenceImages(
            restoredReferenceImages.length > 0
              ? restoredReferenceImages
              : data.referenceImageUrl
                ? [data.referenceImageUrl]
                : [],
          )
          if (Array.isArray(data.characters)) setCharacters(data.characters)
          const currentBeat =
            typeof data.currentBeat === "number" ? data.currentBeat : 0
          setCurrentBeatIndex(
            Math.max(0, Math.min(currentBeat, beats.length - 1)),
          )
          setSelectedBeatId(beats[currentBeat]?.id ?? beats[0]?.id ?? null)

          console.log(`✅ Loaded ${beats.length} beats from session`)
        } else {
          // Session not found or empty, clear and show modal
          console.log("⚠️ Session not found or empty, starting fresh")
          localStorage.removeItem("storyception_session")
          setShowModal(true)
        }
      } catch (error) {
        console.error("Failed to load session:", error)
        localStorage.removeItem("storyception_session")
        setShowModal(true)
      }

      setIsLoading(false)
    }

    loadExistingSession()
  }, [])

  const handleGenerate = (
    beats: StoryBeat[],
    archIdx: number,
    refImageUrl?: string,
    storyId?: string,
    title?: string,
    logline?: string,
    seed?: string,
    outcome?: string,
    refs: string[] = [],
    generatedCharacters: CharacterRecord[] = [],
  ) => {
    setStoryBeats(beats)
    setShowModal(false)
    setCurrentBeatIndex(0)
    setArchetypeIndex(archIdx)
    if (refImageUrl) setReferenceImageUrl(refImageUrl)
    setReferenceImages(
      refs.length > 0 ? refs : refImageUrl ? [refImageUrl] : [],
    )
    setCharacters(generatedCharacters)
    if (storyId) setSessionId(storyId)
    if (title) setStoryTitle(title)
    if (logline) setStoryLogline(logline)
    if (seed) setStorySeed(seed)
    if (outcome) setOutcomeName(outcome)
  }

  const handleNewStory = () => {
    // Clear existing session and show modal
    localStorage.removeItem("storyception_session")
    setSessionId(null)
    setStoryBeats([])
    setSelectedBeatId(null)
    setCurrentBeatIndex(0)
    setIsPlaying(false)
    setReferenceImageUrl(null)
    setReferenceImages([])
    setCharacters([])
    setStoryTitle("")
    setStoryLogline("")
    setStorySeed("")
    setOutcomeName("")
    setShowModal(true)
  }

  const handleUpdateBeat = useCallback(
    (id: number, updates: Partial<StoryBeat>) => {
      setStoryBeats((prev) => {
        return prev.map((beat) =>
          beat.id === id ? { ...beat, ...updates } : beat,
        )
      })
    },
    [],
  )

  const handleSelectBeat = (id: number | null) => {
    setSelectedBeatId(id)
    if (id) {
      const index = storyBeats.findIndex((b) => b.id === id)
      if (index !== -1) setCurrentBeatIndex(index)
    }
  }

  const handleTimelineSelect = (id: number) => {
    setSelectedBeatId(id)
  }

  const handleSetCurrentBeat = (index: number) => {
    setCurrentBeatIndex(index)
    if (storyBeats[index]) {
      setSelectedBeatId(storyBeats[index].id)
    }
  }

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev)
  }

  useEffect(() => {
    if (isPlaying && storyBeats.length > 0) {
      const currentBeat = storyBeats[currentBeatIndex]
      const duration =
        Number.parseFloat(currentBeat?.duration.replace("s", "") || "4") * 1000

      const timer = setTimeout(() => {
        if (currentBeatIndex < storyBeats.length - 1) {
          setCurrentBeatIndex((prev) => prev + 1)
          setSelectedBeatId(storyBeats[currentBeatIndex + 1]?.id || null)
        } else {
          setIsPlaying(false)
          setCurrentBeatIndex(0)
          setSelectedBeatId(storyBeats[0]?.id || null)
        }
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isPlaying, currentBeatIndex, storyBeats])

  // Show loading screen while checking for session
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center animate-pulse">
            <svg
              className="w-8 h-8 text-cyan-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <p className="text-zinc-400 text-sm">Loading story...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <AnimatePresence>
        {showModal && (
          <StoryOpeningPanel
            onClose={() => setShowModal(false)}
            onGenerate={handleGenerate}
          />
        )}
      </AnimatePresence>

      <Header
        onNewStory={handleNewStory}
        viewMode={viewMode}
        onToggleView={() =>
          setViewMode((v) => (v === "flow" ? "cards" : "flow"))
        }
      />

      {viewMode === "flow" ? (
        <FlowCanvas
          beats={storyBeats}
          selectedBeatId={selectedBeatId}
          onSelectBeat={handleSelectBeat}
          onUpdateBeat={handleUpdateBeat}
          referenceImageUrl={referenceImageUrl}
          referenceImages={referenceImages}
          characters={characters}
          sessionId={sessionId}
          archetypeIndex={archetypeIndex}
          storyTitle={storyTitle}
          storyLogline={storyLogline}
          storySeed={storySeed}
          outcomeName={outcomeName}
        />
      ) : (
        <StoryCanvas
          beats={storyBeats}
          selectedBeatId={selectedBeatId}
          onSelectBeat={handleSelectBeat}
          onUpdateBeat={handleUpdateBeat}
        />
      )}

      <Timeline
        beats={storyBeats}
        selectedBeatId={selectedBeatId}
        currentBeatIndex={currentBeatIndex}
        isPlaying={isPlaying}
        onSelectBeat={handleTimelineSelect}
        onSetCurrentBeat={handleSetCurrentBeat}
        onTogglePlay={handleTogglePlay}
      />
    </div>
  )
}
