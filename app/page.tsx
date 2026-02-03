"use client"

import { useState, useCallback, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { Header } from "@/components/storyception/header"
import { SetupPanel } from "@/components/storyception/setup-panel"
import { StoryCanvas } from "@/components/storyception/story-canvas"
import { FlowCanvas } from "@/components/storyception/flow-canvas"
import { Timeline } from "@/components/storyception/timeline"
import type { StoryBeat, StoryHistory } from "@/lib/types"

export default function StoryceptionPage() {
  const [storyBeats, setStoryBeats] = useState<StoryBeat[]>([])
  const [showModal, setShowModal] = useState(false) // Start false, show after checking for session
  const [isLoading, setIsLoading] = useState(true) // Loading state for session check
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null)
  const [history, setHistory] = useState<StoryHistory[]>([])
  const [viewMode, setViewMode] = useState<"flow" | "cards">("flow")
  const [sessionId, setSessionId] = useState<string | null>(null)

  const [currentBeatIndex, setCurrentBeatIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null) // For character consistency

  // Load existing session on mount
  useEffect(() => {
    const loadExistingSession = async () => {
      const savedSessionId = localStorage.getItem('storyception_session')
      
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
          const beats: StoryBeat[] = data.beats.map((beat: {
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
          }, idx: number) => ({
            id: idx + 1, // UI expects 1-indexed IDs
            beatId: beat.beatId,
            label: beat.label,
            desc: beat.desc,
            generatedIdea: beat.generatedIdea,
            duration: beat.duration,
            percentOfTotal: beat.percentOfTotal || Math.round(100 / data.beats.length),
            img: `linear-gradient(135deg, hsl(${180 + idx * 15}, 70%, ${15 + idx * 2}%), hsl(${195 + idx * 10}, 60%, ${10 + idx * 2}%))`,
            status: beat.status,
            branches: beat.branches?.map((b, bIdx) => ({
              id: bIdx + 1, // Branch IDs also 1-indexed
              title: b.title,
              desc: b.desc,
              type: b.type as 'direct' | 'hidden' | 'sacrifice',
              duration: b.duration,
              selected: b.selected,
              depth: b.depth,
            })),
            frames: beat.keyframeUrls,
          }))

          setStoryBeats(beats)
          setSessionId(savedSessionId)
          setHistory([{ beats, timestamp: Date.now(), action: "Loaded from session" }])
          console.log(`✅ Loaded ${beats.length} beats from session`)
        } else {
          // Session not found or empty, clear and show modal
          console.log('⚠️ Session not found or empty, starting fresh')
          localStorage.removeItem('storyception_session')
          setShowModal(true)
        }
      } catch (error) {
        console.error('Failed to load session:', error)
        localStorage.removeItem('storyception_session')
        setShowModal(true)
      }
      
      setIsLoading(false)
    }

    loadExistingSession()
  }, [])

  const handleGenerate = (beats: StoryBeat[], archIdx: number, refImageUrl?: string) => {
    setStoryBeats(beats)
    setShowModal(false)
    setCurrentBeatIndex(0)
    setHistory([{ beats, timestamp: Date.now(), action: "Initial generation" }])
    if (refImageUrl) {
      setReferenceImageUrl(refImageUrl)
    }
  }

  const handleNewStory = () => {
    // Clear existing session and show modal
    localStorage.removeItem('storyception_session')
    setSessionId(null)
    setStoryBeats([])
    setShowModal(true)
  }

  const handleUpdateBeat = useCallback((id: number, updates: Partial<StoryBeat>) => {
    setStoryBeats((prev) => {
      const newBeats = prev.map((beat) => (beat.id === id ? { ...beat, ...updates } : beat))
      setHistory((h) => [
        ...h.slice(-9),
        {
          beats: newBeats,
          timestamp: Date.now(),
          action: `Updated ${prev.find((b) => b.id === id)?.label || "beat"}`,
        },
      ])
      return newBeats
    })
  }, [])

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
      const duration = Number.parseFloat(currentBeat?.duration.replace("s", "") || "4") * 1000

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
            <svg className="w-8 h-8 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        {showModal && <SetupPanel onClose={() => setShowModal(false)} onGenerate={handleGenerate} />}
      </AnimatePresence>

      <Header onNewStory={handleNewStory} viewMode={viewMode} onToggleView={() => setViewMode(v => v === "flow" ? "cards" : "flow")} />

      {viewMode === "flow" ? (
        <FlowCanvas
          beats={storyBeats}
          selectedBeatId={selectedBeatId}
          onSelectBeat={handleSelectBeat}
          onUpdateBeat={handleUpdateBeat}
          referenceImageUrl={referenceImageUrl}
          sessionId={sessionId}
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
