import type { StoryBeat, BranchOption } from "./types"

export const BEAT_PERCENTAGES: Record<string, number> = {
  // Save the Cat - based on page counts in 110-page screenplay
  openingImage: 1, // Page 1 (1%)
  setup: 9, // Pages 1-10 (9%)
  themeStated: 1, // Page 5 (1%)
  catalyst: 3, // Page 12 (3%)
  debate: 10, // Pages 12-25 (10%)
  breakIntoTwo: 2, // Page 25 (2%)
  bStory: 3, // Page 30 (3%)
  funAndGames: 20, // Pages 30-55 (20%)
  midpoint: 5, // Page 55 (5%)
  badGuysCloseIn: 15, // Pages 55-75 (15%)
  allIsLost: 5, // Page 75 (5%)
  darkNight: 5, // Pages 75-85 (5%)
  breakIntoThree: 2, // Page 85 (2%)
  finale: 17, // Pages 85-110 (17%)
  finalImage: 2, // Page 110 (2%)
  // Hero's Journey
  ordinaryWorld: 8,
  callToAdventure: 4,
  refusal: 5,
  meetingMentor: 5,
  crossingThreshold: 8,
  testsAllies: 15,
  approach: 8,
  ordeal: 12,
  reward: 8,
  roadBack: 8,
  resurrection: 12,
  returnElixir: 7,
  // Story Circle
  you: 12,
  need: 8,
  go: 15,
  search: 15,
  find: 15,
  take: 12,
  return: 12,
  change: 11,
  // Default
  default: 10,
}

// Story generation prompts based on beat type
const beatIdeas: Record<string, string[]> = {
  openingImage: [
    "A lone figure stands at the edge of a rain-soaked rooftop, city lights blurring below",
    "Morning light filters through dusty blinds onto scattered photographs",
    "An empty chair at a crowded dinner table, a glass of wine untouched",
    "Footsteps echo in an abandoned warehouse as shadows shift",
  ],
  setup: [
    "The protagonist navigates their mundane routine, hiding deeper ambitions",
    "Family tensions simmer beneath polite conversation at breakfast",
    "A chance encounter plants the seed of what's to come",
    "The hero's flaw is revealed through a small but telling moment",
  ],
  themeStated: [
    "'Sometimes the only way forward is to let go of everything you thought you knew'",
    "'The truth doesn't care if you're ready to hear it'",
    "'We become what we choose to fight for'",
    "'Every ending is just another beginning in disguise'",
  ],
  catalyst: [
    "A mysterious message arrives that changes everything",
    "An unexpected death forces the hero into action",
    "A discovery reveals the world is not what it seemed",
    "The hero witnesses something they cannot ignore",
  ],
  debate: [
    "The hero weighs the cost of action against safety of inaction",
    "A mentor figure offers conflicting advice",
    "Internal doubts surface through vivid flashbacks",
    "The hero attempts a half-measure that fails",
  ],
  breakIntoTwo: [
    "The hero crosses a literal threshold—a door, a border, a line",
    "A dramatic decision burns bridges to the old world",
    "The hero speaks their commitment aloud for the first time",
    "An ally joins, solidifying the new path forward",
  ],
  bStory: [
    "The protagonist embarks on a parallel journey, learning valuable lessons",
    "A subplot unfolds, revealing new aspects of the main character",
    "The hero grapples with personal demons while facing external challenges",
    "Secondary conflicts escalate, adding depth to the story",
  ],
  funAndGames: [
    "The hero enjoys a period of relative calm and growth",
    "A series of events leads to a lighthearted moment of clarity",
    "The hero and allies engage in playful banter, building trust",
    "The story takes a comedic turn, providing much-needed relief",
  ],
  midpoint: [
    "The hero faces a significant setback, questioning their journey",
    "A major revelation shifts the hero's perspective",
    "The hero realizes the true cost of their actions",
    "The story reaches its midpoint, setting up the final push",
  ],
  badGuysCloseIn: [
    "The antagonist's plan comes to fruition, putting the hero in danger",
    "The hero learns the full extent of the enemy's threat",
    "The stakes are raised as the hero confronts new challenges",
    "The hero narrowly escapes, but the danger is far from over",
  ],
  allIsLost: [
    "The hero experiences a devastating loss, feeling defeated",
    "The story takes a dark turn as hope seems extinguished",
    "The hero faces the lowest point of their journey",
    "The antagonist gains the upper hand, forcing the hero to adapt",
  ],
  darkNight: [
    "The hero undergoes a transformative experience in isolation",
    "A pivotal decision is made during a night of introspection",
    "The hero confronts their deepest fears and doubts",
    "The story builds to a climax of tension and revelation",
  ],
  breakIntoThree: [
    "The hero embarks on a new phase of their journey",
    "A final push towards the goal begins",
    "The hero prepares for the ultimate challenge",
    "The story takes a final turn, setting the stage for the finale",
  ],
  finale: [
    "The hero faces the final confrontation, everything on the line",
    "The climax of the story unfolds, determining the fate of the protagonist",
    "The hero makes a final decision that changes the course of the narrative",
    "The story reaches its resolution, leaving the audience satisfied",
  ],
  finalImage: [
    "The hero stands victorious, looking towards the future",
    "The protagonist reflects on their journey, finding peace",
    "The story ends with a lingering question, leaving room for interpretation",
    "The final scene captures the essence of the hero's transformation",
  ],
}

export function generateBeatIdea(beatId: string): string {
  const ideas = beatIdeas[beatId] || [
    "A pivotal moment unfolds that advances the narrative",
    "The protagonist faces a crucial decision point",
    "New information reshapes the hero's understanding",
    "Tension builds as stakes are raised",
  ]
  return ideas[Math.floor(Math.random() * ideas.length)]
}

export function autoGenerateBeatIdea(beatId: string, beatLabel: string): string {
  const ideas = beatIdeas[beatId] || [
    `A pivotal ${beatLabel.toLowerCase()} moment unfolds`,
    `The protagonist faces a crucial turning point`,
    `New stakes emerge that change everything`,
    `Tension builds as the story advances`,
  ]
  return ideas[Math.floor(Math.random() * ideas.length)]
}

export function generateBranchOptions(parentBeat: StoryBeat): BranchOption[] {
  const branchTypes = [
    {
      type: "confrontation",
      title: "DIRECT CONFRONTATION",
      templates: [
        "The hero charges headfirst into conflict, revealing hidden strength",
        "A tense face-off where words become weapons",
        "The moment of truth—fight or flight, and the hero chooses fight",
      ],
    },
    {
      type: "discovery",
      title: "HIDDEN DISCOVERY",
      templates: [
        "A secret passage leads to unexpected revelations",
        "The hero uncovers evidence that changes everything",
        "A hidden ally emerges from the shadows",
      ],
    },
    {
      type: "sacrifice",
      title: "COSTLY SACRIFICE",
      templates: [
        "The hero gives up something precious for the greater good",
        "A painful choice between two impossible options",
        "Loss becomes the catalyst for transformation",
      ],
    },
    {
      type: "deception",
      title: "STRATEGIC DECEPTION",
      templates: [
        "The hero plays a dangerous game of misdirection",
        "A false alliance masks true intentions",
        "The mask slips, revealing hidden motives",
      ],
    },
  ]

  return branchTypes.slice(0, 3).map((branch, idx) => ({
    id: Date.now() + idx,
    title: `PATH ${String.fromCharCode(65 + idx)}: ${branch.title}`,
    duration: `+${8 + idx * 2}s`,
    desc: branch.templates[Math.floor(Math.random() * branch.templates.length)],
    type: branch.type,
    selected: false,
    generatedIdea: branch.templates[Math.floor(Math.random() * branch.templates.length)],
    imagePrompt: `Cinematic scene: ${branch.templates[0].toLowerCase()}`,
  }))
}

export function getBeatAbbreviation(label: string): string {
  // Extract the number and create abbreviation
  const match = label.match(/^(\d+)\.\s*(.+)$/)
  if (!match) return label.slice(0, 6).toUpperCase()

  const num = match[1]
  const words = match[2].split(/\s+/)

  // Create abbreviation from first letters of significant words
  const abbrev = words
    .filter((w) => !["THE", "OF", "TO", "A", "AN", "AND", "OR"].includes(w.toUpperCase()))
    .map((w) => w[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 3)

  return `${num}_${abbrev}`
}

export function getBeatPercentage(beatId: string): number {
  return BEAT_PERCENTAGES[beatId] || BEAT_PERCENTAGES.default
}
