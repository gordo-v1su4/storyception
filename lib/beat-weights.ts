/**
 * Beat Weight System
 * 
 * Determines branching likelihood for each beat in each narrative archetype.
 * Weight values: 0.0 (never branches) to 1.0 (always branches)
 * 
 * Categories:
 * - Very High (0.8-1.0): Almost always offers branches
 * - High (0.6-0.8): Often offers branches
 * - Medium (0.4-0.6): Sometimes offers branches
 * - Low (0.2-0.4): Rarely offers branches
 * - None (0.0): Never branches (opening/closing beats)
 */

export interface BeatWeight {
  beatId: string
  weight: number
  isLoopable: boolean
  notes?: string
}

// Hero's Journey (12 beats)
export const HERO_JOURNEY_WEIGHTS: Record<string, BeatWeight> = {
  ordinaryWorld: { beatId: "ordinaryWorld", weight: 0.0, isLoopable: false, notes: "Establishes baseline - no branching" },
  callToAdventure: { beatId: "callToAdventure", weight: 0.5, isLoopable: false, notes: "Can accept or reject differently" },
  refusal: { beatId: "refusal", weight: 0.7, isLoopable: false, notes: "Multiple ways to resist" },
  meetingMentor: { beatId: "meetingMentor", weight: 0.4, isLoopable: false, notes: "Different mentor interactions" },
  crossingThreshold: { beatId: "crossingThreshold", weight: 0.6, isLoopable: false, notes: "Different entry points" },
  testsAllies: { beatId: "testsAllies", weight: 0.9, isLoopable: true, notes: "LOOPABLE - Multiple tests to explore" },
  approach: { beatId: "approach", weight: 0.5, isLoopable: false, notes: "Different approaches to danger" },
  ordeal: { beatId: "ordeal", weight: 0.8, isLoopable: false, notes: "Critical turning point" },
  reward: { beatId: "reward", weight: 0.4, isLoopable: false, notes: "What reward to claim" },
  roadBack: { beatId: "roadBack", weight: 0.6, isLoopable: false, notes: "Different return paths" },
  resurrection: { beatId: "resurrection", weight: 0.7, isLoopable: false, notes: "Final test variations" },
  returnElixir: { beatId: "returnElixir", weight: 0.0, isLoopable: false, notes: "Resolution - no branching" },
}

// Save the Cat (15 beats)
export const SAVE_THE_CAT_WEIGHTS: Record<string, BeatWeight> = {
  openingImage: { beatId: "openingImage", weight: 0.0, isLoopable: false, notes: "Static snapshot" },
  setup: { beatId: "setup", weight: 0.3, isLoopable: false, notes: "Establishes world" },
  themeStated: { beatId: "themeStated", weight: 0.2, isLoopable: false, notes: "Theme hints" },
  catalyst: { beatId: "catalyst", weight: 0.6, isLoopable: false, notes: "Different triggers" },
  debate: { beatId: "debate", weight: 0.7, isLoopable: false, notes: "Internal conflict options" },
  breakIntoTwo: { beatId: "breakIntoTwo", weight: 0.5, isLoopable: false, notes: "Different commitments" },
  bStory: { beatId: "bStory", weight: 0.6, isLoopable: false, notes: "Subplot variations" },
  funAndGames: { beatId: "funAndGames", weight: 1.0, isLoopable: true, notes: "LOOPABLE - Promise of premise exploration" },
  midpoint: { beatId: "midpoint", weight: 0.8, isLoopable: false, notes: "Major turning point" },
  badGuysCloseIn: { beatId: "badGuysCloseIn", weight: 0.7, isLoopable: false, notes: "Escalation paths" },
  allIsLost: { beatId: "allIsLost", weight: 0.5, isLoopable: false, notes: "How to hit bottom" },
  darkNight: { beatId: "darkNight", weight: 0.4, isLoopable: false, notes: "Soul searching" },
  breakIntoThree: { beatId: "breakIntoThree", weight: 0.6, isLoopable: false, notes: "New insights" },
  finale: { beatId: "finale", weight: 0.7, isLoopable: false, notes: "Final battle variations" },
  finalImage: { beatId: "finalImage", weight: 0.0, isLoopable: false, notes: "Static resolution" },
}

// Story Circle (8 beats)
export const STORY_CIRCLE_WEIGHTS: Record<string, BeatWeight> = {
  you: { beatId: "you", weight: 0.0, isLoopable: false, notes: "Comfort zone baseline" },
  need: { beatId: "need", weight: 0.5, isLoopable: false, notes: "Different desires" },
  go: { beatId: "go", weight: 0.6, isLoopable: false, notes: "How to cross threshold" },
  search: { beatId: "search", weight: 0.9, isLoopable: true, notes: "LOOPABLE - Multiple adaptations" },
  find: { beatId: "find", weight: 0.7, isLoopable: false, notes: "What to find" },
  take: { beatId: "take", weight: 0.6, isLoopable: false, notes: "What price to pay" },
  return: { beatId: "return", weight: 0.4, isLoopable: false, notes: "How to return" },
  change: { beatId: "change", weight: 0.0, isLoopable: false, notes: "Resolution" },
}

// Three-Act (9 beats)
export const THREE_ACT_WEIGHTS: Record<string, BeatWeight> = {
  exposition: { beatId: "exposition", weight: 0.0, isLoopable: false, notes: "Setup baseline" },
  incitingIncident: { beatId: "incitingIncident", weight: 0.5, isLoopable: false, notes: "Different disruptions" },
  plotPoint1: { beatId: "plotPoint1", weight: 0.6, isLoopable: false, notes: "Commitment variations" },
  risingAction: { beatId: "risingAction", weight: 0.8, isLoopable: true, notes: "LOOPABLE - Multiple challenges" },
  midpoint: { beatId: "midpoint", weight: 0.7, isLoopable: false, notes: "Turning point options" },
  plotPoint2: { beatId: "plotPoint2", weight: 0.6, isLoopable: false, notes: "Setback variations" },
  preClimax: { beatId: "preClimax", weight: 0.4, isLoopable: false, notes: "Preparation" },
  climax: { beatId: "climax", weight: 0.7, isLoopable: false, notes: "Showdown variations" },
  denouement: { beatId: "denouement", weight: 0.0, isLoopable: false, notes: "Resolution" },
}

// Seven-Point (7 beats)
export const SEVEN_POINT_WEIGHTS: Record<string, BeatWeight> = {
  hook: { beatId: "hook", weight: 0.0, isLoopable: false, notes: "Opening baseline" },
  plotPointOne: { beatId: "plotPointOne", weight: 0.6, isLoopable: false, notes: "Inciting variations" },
  pinchPointOne: { beatId: "pinchPointOne", weight: 0.7, isLoopable: false, notes: "First clash options" },
  midpoint: { beatId: "midpoint", weight: 0.8, isLoopable: false, notes: "Major shift" },
  pinchPointTwo: { beatId: "pinchPointTwo", weight: 0.6, isLoopable: false, notes: "Deepening conflict" },
  plotPointTwo: { beatId: "plotPointTwo", weight: 0.5, isLoopable: false, notes: "Breakthrough" },
  resolution: { beatId: "resolution", weight: 0.0, isLoopable: false, notes: "Climax resolution" },
}

// Lester Dent (19 beats)
export const LESTER_DENT_WEIGHTS: Record<string, BeatWeight> = {
  hitWithTrouble: { beatId: "hitWithTrouble", weight: 0.0, isLoopable: false, notes: "Opening trouble" },
  jumpIntoAction: { beatId: "jumpIntoAction", weight: 0.6, isLoopable: false, notes: "Action entry" },
  introduceAllies: { beatId: "introduceAllies", weight: 0.5, isLoopable: false, notes: "Character intros" },
  altercation1: { beatId: "altercation1", weight: 0.8, isLoopable: false, notes: "Fight variations" },
  achieveMinor: { beatId: "achieveMinor", weight: 0.4, isLoopable: false, notes: "Small wins" },
  plotTwist1: { beatId: "plotTwist1", weight: 0.7, isLoopable: false, notes: "Twist options" },
  doubleTrouble: { beatId: "doubleTrouble", weight: 0.8, isLoopable: false, notes: "Escalation paths" },
  showStruggle: { beatId: "showStruggle", weight: 0.6, isLoopable: true, notes: "LOOPABLE - Struggle scenes" },
  altercation2: { beatId: "altercation2", weight: 0.8, isLoopable: false, notes: "Second fight" },
  plotTwist2: { beatId: "plotTwist2", weight: 0.7, isLoopable: false, notes: "Another twist" },
  ratchetTension: { beatId: "ratchetTension", weight: 0.6, isLoopable: false, notes: "Tension building" },
  falseHope: { beatId: "falseHope", weight: 0.5, isLoopable: false, notes: "Hope variations" },
  altercation3: { beatId: "altercation3", weight: 0.8, isLoopable: false, notes: "Third fight" },
  devastatingTwist: { beatId: "devastatingTwist", weight: 0.7, isLoopable: false, notes: "Crushing reversal" },
  lastStraw: { beatId: "lastStraw", weight: 0.4, isLoopable: false, notes: "Rock bottom" },
  escapeDefeat: { beatId: "escapeDefeat", weight: 0.6, isLoopable: false, notes: "Escape methods" },
  tieUpLooseEnds: { beatId: "tieUpLooseEnds", weight: 0.3, isLoopable: false, notes: "Resolution" },
  finalPlotTwist: { beatId: "finalPlotTwist", weight: 0.5, isLoopable: false, notes: "Final surprise" },
  deliverPunchline: { beatId: "deliverPunchline", weight: 0.0, isLoopable: false, notes: "Closing line" },
}

// Combined lookup by archetype index
export const BEAT_WEIGHTS_BY_ARCHETYPE = [
  HERO_JOURNEY_WEIGHTS,
  SAVE_THE_CAT_WEIGHTS,
  STORY_CIRCLE_WEIGHTS,
  THREE_ACT_WEIGHTS,
  SEVEN_POINT_WEIGHTS,
  LESTER_DENT_WEIGHTS,
]

/**
 * Get beat weight for a specific beat
 */
export function getBeatWeight(archetypeIndex: number, beatId: string): BeatWeight | null {
  const weights = BEAT_WEIGHTS_BY_ARCHETYPE[archetypeIndex]
  return weights?.[beatId] ?? null
}

/**
 * Check if a beat should offer branches
 */
export function shouldOfferBranches(archetypeIndex: number, beatId: string): boolean {
  const weight = getBeatWeight(archetypeIndex, beatId)
  if (!weight) return false
  
  // Use weight as probability threshold
  return Math.random() < weight.weight
}

/**
 * Get number of branches to offer based on weight
 */
export function getBranchCount(weight: number): number {
  if (weight >= 0.8) return 3
  if (weight >= 0.5) return 2
  if (weight > 0) return Math.random() < weight ? 2 : 0
  return 0
}

/**
 * Check if beat is loopable
 */
export function isBeatLoopable(archetypeIndex: number, beatId: string): boolean {
  const weight = getBeatWeight(archetypeIndex, beatId)
  return weight?.isLoopable ?? false
}
