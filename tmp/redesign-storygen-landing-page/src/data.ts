export type Archetype = {
  id: string;
  name: string;
  engine: string;
  description: string;
  examples: string;
  beats: number;
  category: "Film" | "Structure" | "Music Video" | "Commercial";
  beatList: string[];
  accent: string; // tailwind color stem
};

export const ARCHETYPES: Archetype[] = [
  {
    id: "hero",
    name: "Hero's Journey",
    engine: "Epic Engine",
    description: "Mythic progression & world-building",
    examples: "Star Wars, Marvel",
    beats: 12,
    category: "Film",
    accent: "cyan",
    beatList: [
      "Ordinary World", "Call to Adventure", "Refusal", "Meeting the Mentor",
      "Crossing the Threshold", "Tests & Allies", "Approach the Cave",
      "The Ordeal", "Reward", "The Road Back", "Resurrection", "Return with Elixir"
    ],
  },
  {
    id: "save-cat",
    name: "Save the Cat",
    engine: "Pacing Engine",
    description: "Structured beats for maximum engagement",
    examples: "Pixar, Blockbusters",
    beats: 15,
    category: "Film",
    accent: "cyan",
    beatList: [
      "Opening Image", "Theme Stated", "Set-Up", "Catalyst", "Debate",
      "Break Into Two", "B Story", "Fun and Games", "Midpoint", "Bad Guys Close In",
      "All Is Lost", "Dark Night of the Soul", "Break Into Three", "Finale", "Final Image"
    ],
  },
  {
    id: "circle",
    name: "Story Circle",
    engine: "Character Engine",
    description: "Cyclical change and return",
    examples: "Rick & Morty, Community",
    beats: 8,
    category: "Film",
    accent: "cyan",
    beatList: [
      "You (comfort)", "Need", "Go (unfamiliar)", "Search",
      "Find", "Take", "Return", "Change"
    ],
  },
  {
    id: "three-act",
    name: "Three-Act",
    engine: "Base Engine",
    description: "Setup, confrontation, resolution",
    examples: "Standard Cinema",
    beats: 9,
    category: "Structure",
    accent: "cyan",
    beatList: [
      "Exposition", "Inciting Incident", "Plot Point 1",
      "Rising Action", "Midpoint", "Plot Point 2",
      "Climax", "Falling Action", "Resolution"
    ],
  },
  {
    id: "seven-point",
    name: "Seven-Point",
    engine: "Milestone Engine",
    description: "Key turning points without rigid outline",
    examples: "Discovery Writers",
    beats: 7,
    category: "Structure",
    accent: "cyan",
    beatList: [
      "Hook", "Plot Turn 1", "Pinch 1", "Midpoint",
      "Pinch 2", "Plot Turn 2", "Resolution"
    ],
  },
  {
    id: "lester",
    name: "Lester Dent",
    engine: "Pulp Fiction Engine",
    description: "Systematic escalation of trouble",
    examples: "Pulp Fiction, Thrillers",
    beats: 19,
    category: "Structure",
    accent: "cyan",
    beatList: [
      "Trouble Hits", "Hero In Action", "Mystery Element", "Surprise Twist",
      "Q1 Cliffhanger", "Complications", "Hero Struggles", "New Threat",
      "Q2 Cliffhanger", "Mystery Deepens", "Hero Outwitted", "Worse Trouble",
      "Q3 Cliffhanger", "Final Mystery", "All Hope Lost", "Hero's Brain Wave",
      "Final Showdown", "Mystery Solved", "Final Twist"
    ],
  },
  {
    id: "song-arc",
    name: "Song Arc",
    engine: "Narrative MV",
    description: "Verse-chorus arc mapped to visual story beats",
    examples: "Story-led promos, cinematic lyrics",
    beats: 8,
    category: "Music Video",
    accent: "fuchsia",
    beatList: [
      "Intro Atmosphere", "Verse 1 — Setup", "Pre-Chorus Tension",
      "Chorus 1 — Statement", "Verse 2 — Complication", "Bridge — Turn",
      "Chorus 2 — Resolve", "Outro Echo"
    ],
  },
  {
    id: "performance",
    name: "Performance MV",
    engine: "Stage Engine",
    description: "Artist, band, and crowd as the through-line",
    examples: "Live energy, tour films",
    beats: 6,
    category: "Music Video",
    accent: "fuchsia",
    beatList: [
      "Doors Open", "Sound Check Energy", "First Drop",
      "Crowd Surrender", "Encore Build", "Final Bow"
    ],
  },
  {
    id: "visual",
    name: "Visual Concept",
    engine: "Art Film MV",
    description: "Motif-driven visuals with an emotional peak",
    examples: "Surreal, symbolic, high-concept",
    beats: 7,
    category: "Music Video",
    accent: "fuchsia",
    beatList: [
      "Motif Introduced", "Distortion", "Pattern Repeats",
      "Symbolic Pivot", "Emotional Peak", "Motif Inverted", "Quiet Aftermath"
    ],
  },
  {
    id: "problem",
    name: "Problem → Solution",
    engine: "Classic Spot",
    description: "Agitate the pain, reveal the fix, drive action",
    examples: "DTC, SaaS, household brands",
    beats: 6,
    category: "Commercial",
    accent: "amber",
    beatList: [
      "Relatable Pain", "Agitation", "Enter Product",
      "Demonstration", "Transformation", "Call to Action"
    ],
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    engine: "Aspiration Spot",
    description: "World-building, identity, product in context",
    examples: "Fashion, auto, beverage",
    beats: 6,
    category: "Commercial",
    accent: "amber",
    beatList: [
      "Mood Establishing", "Cast of Characters", "Aspirational Moment",
      "Product as Ritual", "Peak Identity", "Logo & Tagline"
    ],
  },
  {
    id: "mini",
    name: "Mini-Story",
    engine: "Character Spot",
    description: "Relatable setup, twist, brand-as-hero, lockup",
    examples: "Insurance, telecom, holiday",
    beats: 7,
    category: "Commercial",
    accent: "amber",
    beatList: [
      "Meet the Character", "Everyday Setup", "Unexpected Twist",
      "Brand Steps In", "Resolution", "Heart Beat", "Brand Lockup"
    ],
  },
];

export type Outcome = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  gradient: string;
};

export const OUTCOMES: Outcome[] = [
  { id: "happy", name: "Happy Ending", description: "Hero succeeds, positive resolution", emoji: "✨", gradient: "from-emerald-400/20 to-cyan-400/10" },
  { id: "tragedy", name: "Tragedy", description: "Hero fails or dies, dramatic conclusion", emoji: "🩸", gradient: "from-rose-500/20 to-red-500/10" },
  { id: "redemption", name: "Redemption", description: "Hero overcomes flaws, finds peace", emoji: "🕊️", gradient: "from-amber-400/20 to-orange-400/10" },
  { id: "ambiguous", name: "Ambiguous", description: "Open-ended, leaves interpretation", emoji: "🌫️", gradient: "from-slate-400/20 to-violet-400/10" },
];

export const CATEGORIES = ["All", "Film", "Structure", "Music Video", "Commercial"] as const;
