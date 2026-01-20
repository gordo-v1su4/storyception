"use client"

import { motion } from "framer-motion"
import { Film, Plus, Sparkles, LayoutGrid, GitBranch } from "lucide-react"

interface HeaderProps {
  onNewStory: () => void
  viewMode?: "flow" | "cards"
  onToggleView?: () => void
}

export function Header({ onNewStory, viewMode = "flow", onToggleView }: HeaderProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="h-14 w-full border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 z-10"
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3 }}
          className="text-primary"
        >
          <Film size={18} />
        </motion.div>
        <h1 className="text-sm font-bold text-gradient tracking-[0.2em]">STORYCEPTION</h1>
        <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          <Sparkles size={10} className="text-primary" />
          AI POWERED
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* View Toggle */}
        {onToggleView && (
          <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={onToggleView}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors ${
                viewMode === "flow" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch size={12} />
              Flow
            </button>
            <button
              onClick={onToggleView}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors ${
                viewMode === "cards" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={12} />
              Cards
            </button>
          </div>
        )}

        <div className="hidden lg:block text-[11px] text-muted-foreground font-mono tracking-wide">
          CINEMATIC_STORY_ENGINE_V1
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewStory}
          className="text-[11px] px-4 py-2 border border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 rounded uppercase tracking-wider font-bold flex items-center gap-2 group"
        >
          <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
          New Story
        </motion.button>
      </div>
    </motion.header>
  )
}
