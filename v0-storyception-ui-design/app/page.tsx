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
  const [showModal, setShowModal] = useState(true)
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null)
  const [history, setHistory] = useState<StoryHistory[]>([])
  const [viewMode, setViewMode] = useState<"flow" | "cards">("flow") // Toggle between views

  const [currentBeatIndex, setCurrentBeatIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleGenerate = (beats: StoryBeat[], archIdx: number) => {
    setStoryBeats(beats)
    setShowModal(false)
    setCurrentBeatIndex(0)
    setHistory([{ beats, timestamp: Date.now(), action: "Initial generation" }])
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

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <AnimatePresence>
        {showModal && <SetupPanel onClose={() => setShowModal(false)} onGenerate={handleGenerate} />}
      </AnimatePresence>

      <Header onNewStory={() => setShowModal(true)} viewMode={viewMode} onToggleView={() => setViewMode(v => v === "flow" ? "cards" : "flow")} />

      {viewMode === "flow" ? (
        <FlowCanvas
          beats={storyBeats}
          selectedBeatId={selectedBeatId}
          onSelectBeat={handleSelectBeat}
          onUpdateBeat={handleUpdateBeat}
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
