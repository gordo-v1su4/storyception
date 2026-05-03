export interface Archetype {
  id: string;
  name: string;
  engine: string;
  description: string;
  tags: string;
  beats: number;
  category: 'narrative' | 'music' | 'commercial';
}

export const archetypes: Archetype[] = [
  {
    id: 'heros-journey',
    name: "Hero's Journey",
    engine: 'Epic Engine',
    description: 'Mythic progression & world-building',
    tags: 'Star Wars, Marvel',
    beats: 12,
    category: 'narrative',
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat',
    engine: 'Pacing Engine',
    description: 'Structured beats for maximum engagement',
    tags: 'Pixar, Blockbusters',
    beats: 15,
    category: 'narrative',
  },
  {
    id: 'story-circle',
    name: 'Story Circle',
    engine: 'Character Engine',
    description: 'Cyclical change and return',
    tags: 'Rick & Morty, Community',
    beats: 8,
    category: 'narrative',
  },
  {
    id: 'three-act',
    name: 'Three-Act',
    engine: 'Base Engine',
    description: 'Setup, confrontation, resolution',
    tags: 'Standard Cinema',
    beats: 9,
    category: 'narrative',
  },
  {
    id: 'seven-point',
    name: 'Seven-Point',
    engine: 'Milestone Engine',
    description: 'Key turning points without rigid outline',
    tags: 'Discovery Writers',
    beats: 7,
    category: 'narrative',
  },
  {
    id: 'lester-dent',
    name: 'Lester Dent',
    engine: 'Pulp Fiction Engine',
    description: 'Systematic escalation of trouble',
    tags: 'Pulp Fiction, Thrillers',
    beats: 19,
    category: 'narrative',
  },
  {
    id: 'song-arc',
    name: 'Song Arc',
    engine: 'Narrative MV',
    description: 'Verse-chorus arc mapped to visual story beats',
    tags: 'Story-led promos, cinematic lyrics',
    beats: 8,
    category: 'music',
  },
  {
    id: 'performance-mv',
    name: 'Performance MV',
    engine: 'Stage Engine',
    description: 'Artist, band, and crowd as the through-line',
    tags: 'Live energy, tour films',
    beats: 6,
    category: 'music',
  },
  {
    id: 'visual-concept',
    name: 'Visual Concept',
    engine: 'Art Film MV',
    description: 'Motif-driven visuals with an emotional peak',
    tags: 'Surreal, symbolic, high-concept',
    beats: 7,
    category: 'music',
  },
  {
    id: 'problem-solution',
    name: 'Problem → Solution',
    engine: 'Classic Spot',
    description: 'Agitate the pain, reveal the fix, drive action',
    tags: 'DTC, SaaS, household brands',
    beats: 6,
    category: 'commercial',
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    engine: 'Aspiration Spot',
    description: 'World-building, identity, product in context',
    tags: 'Fashion, auto, beverage',
    beats: 6,
    category: 'commercial',
  },
  {
    id: 'mini-story',
    name: 'Mini-Story',
    engine: 'Character Spot',
    description: 'Relatable setup, twist, brand-as-hero, lockup',
    tags: 'Insurance, telecom, holiday',
    beats: 7,
    category: 'commercial',
  },
];

export interface Outcome {
  id: string;
  name: string;
  description: string;
}

export const outcomes: Outcome[] = [
  {
    id: 'happy-ending',
    name: 'Happy Ending',
    description: 'Hero succeeds, positive resolution',
  },
  {
    id: 'tragedy',
    name: 'Tragedy',
    description: 'Hero fails or dies, dramatic conclusion',
  },
  {
    id: 'redemption',
    name: 'Redemption',
    description: 'Hero overcomes flaws, finds peace',
  },
  {
    id: 'ambiguous',
    name: 'Ambiguous',
    description: 'Open-ended, leaves interpretation',
  },
];
