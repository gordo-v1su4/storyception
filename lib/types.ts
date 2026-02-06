export interface StoryBeat {
  id: number
  label: string
  duration: string
  percentOfTotal: number
  img: string
  desc: string
  beatId: string
  generatedIdea?: string
  selectedBranchId?: number
  branches?: BranchOption[]
  connectedFromBranch?: string
  
  // New fields for enhanced functionality
  frames?: string[]              // 9 image URLs for grid display
  branchWeight?: number          // 0.0-1.0 branching likelihood
  isLoopable?: boolean           // Can explore multiple times (Fun & Games, etc.)
  visitedScenes?: string[]       // For loopable beats - track explored scenes
  isConvergence?: boolean        // Fixer point where branches converge
  branchDepth?: number           // 0-4, how deep in branching
  status?: 'hidden' | 'current' | 'completed' | 'pending' | 'generating' | 'ready' | 'locked' | 'skeleton'
  visualPrompt?: string          // Prompt used for Nano Banana generation
  scriptText?: string            // AI-generated narrative text
  
  // Story generation fields
  keyframePrompts?: string[]     // 9 prompts for keyframe generation
  gridImageUrl?: string | null   // URL of generated 3x3 grid image
  keyframeUrls?: string[]        // Individual keyframe URLs after splitting
}

export interface TimelineClip {
  id: number
  width: number
}

export interface Archetype {
  title: string
  subtitle: string
  example: string
  desc: string
}

export interface Outcome {
  title: string
  desc: string
}

export interface BranchOption {
  id: number
  title: string
  duration: string
  desc: string
  type: string
  selected: boolean
  generatedIdea?: string
  imagePrompt?: string
  
  // New fields for enhanced functionality
  locked?: boolean               // After selection, all branches get locked
  frames?: string[]              // 9 thumbnail frames for preview
  thumbnailUrl?: string          // Single thumbnail for branch preview
}

export interface BeatStructure {
  id: string
  label: string
  desc: string
}

export interface StoryHistory {
  beats: StoryBeat[]
  timestamp: number
  action: string
}

// New types for story state management
export interface StoryState {
  storyId: string
  currentBeatId: number
  completedBeatIds: number[]
  selectedBranches: Record<number, number>  // beatId -> branchId
  branchDepth: number
  totalBeats: number
}

export interface GenerateStoryRequest {
  archetype: string
  outcome: string
  images: Array<{ data: string; mimeType: string }>
}

export interface GenerateStoryResponse {
  storyId: string
  firstBeat: StoryBeat
  totalBeats: number
}

export interface SelectBranchRequest {
  storyId: string
  currentBeatId: number
  selectedBranchId: number
  nextBeatId: number
}

export interface SelectBranchResponse {
  success: boolean
  nextBeat: StoryBeat
  fromCache: boolean
}

export type LayoutDirection = "horizontal" | "vertical" | "free"
