/**
 * Unified Color System for Storyception
 * 
 * All colors should come from this file to ensure consistency
 * across nodes, timeline, branches, and UI elements.
 * 
 * Maps to CSS variables defined in globals.css
 */

// Beat progression colors (based on position in story)
export const BEAT_COLORS = {
  // First quarter (0-25%) - Primary Cyan
  q1: {
    bg: 'bg-primary',
    border: 'border-primary',
    text: 'text-primary',
    hex: '#22d3ee', // cyan-400 equivalent
    glow: 'rgba(34, 211, 238, 0.3)',
  },
  // Second quarter (25-50%) - Accent Teal  
  q2: {
    bg: 'bg-accent',
    border: 'border-accent',
    text: 'text-accent',
    hex: '#2dd4bf', // teal-400 equivalent
    glow: 'rgba(45, 212, 191, 0.3)',
  },
  // Third quarter (50-75%) - Chart-3 Yellow
  q3: {
    bg: 'bg-chart-3',
    border: 'border-chart-3',
    text: 'text-chart-3',
    hex: '#facc15', // yellow-400 equivalent
    glow: 'rgba(250, 204, 21, 0.3)',
  },
  // Fourth quarter (75-100%) - Chart-4 Pink
  q4: {
    bg: 'bg-chart-4',
    border: 'border-chart-4',
    text: 'text-chart-4',
    hex: '#f472b6', // pink-400 equivalent
    glow: 'rgba(244, 114, 182, 0.3)',
  },
} as const

// Branch option colors (for the 3 choices)
export const BRANCH_COLORS = {
  a: {
    bg: 'bg-primary/20',
    border: 'border-primary/50',
    text: 'text-primary',
    hex: '#22d3ee',
    label: 'Path A',
  },
  b: {
    bg: 'bg-accent/20',
    border: 'border-accent/50', 
    text: 'text-accent',
    hex: '#2dd4bf',
    label: 'Path B',
  },
  c: {
    bg: 'bg-chart-3/20',
    border: 'border-chart-3/50',
    text: 'text-chart-3',
    hex: '#facc15',
    label: 'Path C',
  },
} as const

/**
 * Get color set for a beat based on its position in the story
 */
export function getBeatColorSet(beatIndex: number, totalBeats: number) {
  const position = beatIndex / Math.max(totalBeats - 1, 1)
  
  if (position < 0.25) return BEAT_COLORS.q1
  if (position < 0.5) return BEAT_COLORS.q2
  if (position < 0.75) return BEAT_COLORS.q3
  return BEAT_COLORS.q4
}

/**
 * Get color set for a branch option (A, B, or C)
 */
export function getBranchColorSet(branchIndex: number) {
  const keys = Object.keys(BRANCH_COLORS) as Array<keyof typeof BRANCH_COLORS>
  const key = keys[branchIndex % keys.length]
  return BRANCH_COLORS[key]
}

/**
 * Get hex color for minimap/edges based on beat position
 */
export function getBeatHexColor(beatIndex: number, totalBeats: number): string {
  const colorSet = getBeatColorSet(beatIndex, totalBeats)
  return colorSet.hex
}

/**
 * CSS variable references for inline styles
 */
export const CSS_VARS = {
  primary: 'hsl(var(--primary))',
  accent: 'hsl(var(--accent))',
  chart3: 'hsl(var(--chart-3))',
  chart4: 'hsl(var(--chart-4))',
  background: 'hsl(var(--background))',
  border: 'hsl(var(--border))',
  muted: 'hsl(var(--muted))',
} as const
