"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Play, Pause, SkipBack, SkipForward, Minus, Plus } from "lucide-react"
import type { StoryBeat } from "@/lib/types"
import { getBeatAbbreviation } from "@/lib/story-generator"

interface TimelineProps {
  beats: StoryBeat[]
  selectedBeatId: number | null
  currentBeatIndex: number
  isPlaying: boolean
  onSelectBeat: (id: number) => void
  onSetCurrentBeat: (index: number) => void
  onTogglePlay: () => void
}

export function Timeline({
  beats,
  selectedBeatId,
  currentBeatIndex,
  isPlaying,
  onSelectBeat,
  onSetCurrentBeat,
  onTogglePlay,
}: TimelineProps) {
  const [zoom, setZoom] = useState(60)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Calculate total and elapsed time
  const totalSeconds = beats.reduce((acc, beat) => {
    const secs = Number.parseFloat(beat.duration.replace("s", "")) || 4
    return acc + secs
  }, 0)

  const elapsedSeconds = beats.slice(0, currentBeatIndex + 1).reduce((acc, beat) => {
    const secs = Number.parseFloat(beat.duration.replace("s", "")) || 4
    return acc + secs
  }, 0)

  // Scroll to active beat
  useEffect(() => {
    if (scrollRef.current && beats[currentBeatIndex]) {
      const beatElement = scrollRef.current.children[currentBeatIndex] as HTMLElement
      if (beatElement) {
        beatElement.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      }
    }
  }, [currentBeatIndex, beats])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${ms.toString().padStart(2, "0")}`
  }

  const handlePrevBeat = () => {
    onSetCurrentBeat(Math.max(0, currentBeatIndex - 1))
  }

  const handleNextBeat = () => {
    onSetCurrentBeat(Math.min(beats.length - 1, currentBeatIndex + 1))
  }

  const getBeatColor = (index: number, total: number) => {
    const position = index / Math.max(total - 1, 1)
    if (position < 0.25) return "bg-primary"
    if (position < 0.5) return "bg-accent"
    if (position < 0.75) return "bg-chart-3"
    return "bg-chart-4"
  }

  const getBeatTextColor = (index: number, total: number) => {
    const position = index / Math.max(total - 1, 1)
    if (position < 0.25) return "text-primary-foreground"
    if (position < 0.5) return "text-accent-foreground"
    if (position < 0.75) return "text-background"
    return "text-background"
  }

  if (beats.length === 0) {
    return (
      <div className="h-[120px] bg-card border-t border-border flex items-center justify-center">
        <p className="text-muted-foreground text-sm font-mono">No story beats yet</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="h-[130px] bg-card border-t border-border flex flex-col z-10 shrink-0"
    >
      {/* Controls */}
      <div className="h-11 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePrevBeat}
            disabled={currentBeatIndex === 0}
            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <SkipBack size={12} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onTogglePlay}
            className="w-9 h-9 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            {isPlaying ? (
              <Pause size={14} className="text-primary-foreground" />
            ) : (
              <Play size={14} className="text-primary-foreground ml-0.5" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNextBeat}
            disabled={currentBeatIndex === beats.length - 1}
            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <SkipForward size={12} />
          </motion.button>

          <div className="flex flex-col ml-2">
            <span className="text-[11px] font-mono text-foreground">
              {formatTime(elapsedSeconds)}
              <span className="text-muted-foreground"> / {formatTime(totalSeconds)}</span>
            </span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-wide">
              Beat {currentBeatIndex + 1} of {beats.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setZoom((z) => Math.max(30, z - 10))}
            className="hover:text-foreground transition-colors"
          >
            <Minus size={12} />
          </motion.button>
          <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
            <div style={{ width: `${zoom}%` }} className="h-full bg-primary rounded-full transition-all" />
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setZoom((z) => Math.min(100, z + 10))}
            className="hover:text-foreground transition-colors"
          >
            <Plus size={12} />
          </motion.button>
        </div>
      </div>

      <div className="flex-1 bg-muted/20 overflow-x-auto hide-scrollbar px-3 py-2">
        <div ref={scrollRef} className="flex gap-1 items-stretch h-full min-w-max">
          {beats.map((beat, idx) => {
            const isActive = idx === currentBeatIndex
            const isSelected = beat.id === selectedBeatId
            const abbrev = getBeatAbbreviation(beat.label)
            const widthPercent = beat.percentOfTotal || 10
            
            // Scale width proportionally to beat duration
            // Min width 28px for 1% beats, scales up to ~180px for 20% beats at default zoom
            const minWidth = 28
            const maxMultiplier = 8  // 20% * 8 = 160px base
            const zoomFactor = zoom / 60
            const scaledWidth = Math.max(minWidth, widthPercent * maxMultiplier * zoomFactor)

            return (
              <motion.button
                key={beat.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: idx * 0.015 }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onSetCurrentBeat(idx)
                  onSelectBeat(beat.id)
                }}
                style={{ width: `${scaledWidth}px` }}
                className={`
                  relative h-full rounded-md overflow-hidden flex-shrink-0 transition-all duration-100
                  ${getBeatColor(idx, beats.length)}
                  ${isActive ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : ""}
                  ${isSelected && !isActive ? "ring-1 ring-foreground/50" : ""}
                `}
              >
                <div
                  className={`flex flex-col items-start justify-between h-full p-1.5 text-left ${getBeatTextColor(idx, beats.length)}`}
                >
                  <span className="text-[9px] font-mono font-bold drop-shadow-sm leading-tight">{abbrev}</span>
                  <span className="text-[7px] font-mono opacity-80">{beat.duration}</span>
                </div>

                {isActive && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-foreground rounded-full" />}
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
