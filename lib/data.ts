import type { Archetype, ArchetypeCategory, Outcome, BeatStructure } from "./types"

export const archetypeCategories: ArchetypeCategory[] = [
  { id: "film-tv", label: "Film & TV", description: "Classic screenplay and story engines" },
  { id: "music-video", label: "Music videos", description: "Song-driven visual and performance arcs" },
  { id: "commercial", label: "Commercials", description: "Short-form spots and brand stories" },
]

export const archetypes: Archetype[] = [
  {
    title: "HERO'S JOURNEY",
    subtitle: "EPIC ENGINE",
    example: "Star Wars, Marvel",
    desc: "Mythic progression & world-building",
    categoryId: "film-tv",
  },
  {
    title: "SAVE THE CAT",
    subtitle: "PACING ENGINE",
    example: "Pixar, Blockbusters",
    desc: "Structured beats for maximum engagement",
    categoryId: "film-tv",
  },
  {
    title: "STORY CIRCLE",
    subtitle: "CHARACTER ENGINE",
    example: "Rick & Morty, Community",
    desc: "Cyclical change and return",
    categoryId: "film-tv",
  },
  {
    title: "THREE-ACT",
    subtitle: "BASE ENGINE",
    example: "Standard Cinema",
    desc: "Setup, confrontation, resolution",
    categoryId: "film-tv",
  },
  {
    title: "SEVEN-POINT",
    subtitle: "MILESTONE ENGINE",
    example: "Discovery Writers",
    desc: "Key turning points without rigid outline",
    categoryId: "film-tv",
  },
  {
    title: "LESTER DENT",
    subtitle: "PULP FICTION ENGINE",
    example: "Pulp Fiction, Thrillers",
    desc: "Systematic escalation of trouble",
    categoryId: "film-tv",
  },
  {
    title: "SONG ARC",
    subtitle: "NARRATIVE MV",
    example: "Story-led promos, cinematic lyrics",
    desc: "Verse-chorus arc mapped to visual story beats",
    categoryId: "music-video",
  },
  {
    title: "PERFORMANCE MV",
    subtitle: "STAGE ENGINE",
    example: "Live energy, tour films",
    desc: "Artist, band, and crowd as the through-line",
    categoryId: "music-video",
  },
  {
    title: "VISUAL CONCEPT",
    subtitle: "ART FILM MV",
    example: "Surreal, symbolic, high-concept",
    desc: "Motif-driven visuals with an emotional peak",
    categoryId: "music-video",
  },
  {
    title: "PROBLEM → SOLUTION",
    subtitle: "CLASSIC SPOT",
    example: "DTC, SaaS, household brands",
    desc: "Agitate the pain, reveal the fix, drive action",
    categoryId: "commercial",
  },
  {
    title: "LIFESTYLE",
    subtitle: "ASPIRATION SPOT",
    example: "Fashion, auto, beverage",
    desc: "World-building, identity, product in context",
    categoryId: "commercial",
  },
  {
    title: "MINI-STORY",
    subtitle: "CHARACTER SPOT",
    example: "Insurance, telecom, holiday",
    desc: "Relatable setup, twist, brand-as-hero, lockup",
    categoryId: "commercial",
  },
]

export const outcomes: Outcome[] = [
  { title: "HAPPY ENDING", desc: "Hero succeeds, positive resolution" },
  { title: "TRAGEDY", desc: "Hero fails or dies, dramatic conclusion" },
  { title: "REDEMPTION", desc: "Hero overcomes flaws, finds peace" },
  { title: "AMBIGUOUS", desc: "Open-ended, leaves interpretation" },
]

export const HERO_JOURNEY_BEATS: BeatStructure[] = [
  {
    id: "ordinaryWorld",
    label: "1. THE ORDINARY WORLD",
    desc: "The hero's normal life is established before the adventure begins.",
  },
  {
    id: "callToAdventure",
    label: "2. THE CALL TO ADVENTURE",
    desc: "An inciting incident disrupts the hero's comfort zone.",
  },
  { id: "refusal", label: "3. REFUSAL OF THE CALL", desc: "The hero hesitates or resists the journey ahead." },
  {
    id: "meetingMentor",
    label: "4. MEETING THE MENTOR",
    desc: "A guide appears to offer wisdom, tools, or inspiration.",
  },
  {
    id: "crossingThreshold",
    label: "5. CROSSING THE FIRST THRESHOLD",
    desc: "The hero fully commits and steps into the unknown.",
  },
  {
    id: "testsAllies",
    label: "6. TESTS, ALLIES, ENEMIES",
    desc: "The hero faces challenges, gains allies, and identifies adversaries.",
  },
  {
    id: "approach",
    label: "7. APPROACH TO THE INNERMOST CAVE",
    desc: "The hero nears their goal, but danger and uncertainty increase.",
  },
  {
    id: "ordeal",
    label: "8. THE ORDEAL",
    desc: "A critical confrontation forces the hero to face their deepest fears.",
  },
  {
    id: "reward",
    label: "9. REWARD (SEIZING THE SWORD)",
    desc: "The hero earns a tangible or intangible boon after overcoming the ordeal.",
  },
  {
    id: "roadBack",
    label: "10. THE ROAD BACK",
    desc: "The hero begins the journey home, but the story is not yet over.",
  },
  { id: "resurrection", label: "11. RESURRECTION", desc: "The hero faces a final, defining climactic challenge." },
  {
    id: "returnElixir",
    label: "12. RETURN WITH THE ELIXIR",
    desc: "The hero returns to the ordinary world, transformed and bringing new knowledge or strength.",
  },
]

export const SAVE_THE_CAT_BEATS: BeatStructure[] = [
  {
    id: "openingImage",
    label: "1. OPENING IMAGE",
    desc: "A snapshot that sets the tone and introduces the protagonist.",
  },
  { id: "setup", label: "2. SETUP", desc: "The world is introduced, establishing relationships and stakes." },
  { id: "themeStated", label: "3. THEME STATED", desc: "The story's deeper message or lesson is hinted at." },
  { id: "catalyst", label: "4. CATALYST", desc: "The inciting incident that kicks the story into motion." },
  { id: "debate", label: "5. DEBATE", desc: "The protagonist hesitates or questions the path ahead." },
  {
    id: "breakIntoTwo",
    label: "6. BREAK INTO TWO",
    desc: "The hero commits fully to the central goal, entering Act II.",
  },
  {
    id: "bStory",
    label: "7. B STORY",
    desc: "A subplot emerges, often focusing on an emotional thread like romance or friendship.",
  },
  {
    id: "funAndGames",
    label: "8. FUN AND GAMES",
    desc: 'The "promise of the premise" is explored as the hero navigates their new world.',
  },
  { id: "midpoint", label: "9. MIDPOINT", desc: "A major twist or revelation changes the story's trajectory." },
  {
    id: "badGuysCloseIn",
    label: "10. BAD GUYS CLOSE IN",
    desc: "Tension ramps up as obstacles and enemies surround the protagonist.",
  },
  {
    id: "allIsLost",
    label: "11. ALL IS LOST",
    desc: "A crushing setback makes the protagonist confront their deepest fears.",
  },
  { id: "darkNight", label: "12. DARK NIGHT OF THE SOUL", desc: "The hero hits rock bottom and questions everything." },
  { id: "breakIntoThree", label: "13. BREAK INTO THREE", desc: "A new insight sparks a path forward into Act III." },
  {
    id: "finale",
    label: "14. FINALE",
    desc: "The climax, where the hero uses everything they've learned to face the final challenge.",
  },
  {
    id: "finalImage",
    label: "15. FINAL IMAGE",
    desc: "A closing snapshot that mirrors the opening image, showing how much the hero has transformed.",
  },
]

export const STORY_CIRCLE_BEATS: BeatStructure[] = [
  {
    id: "you",
    label: "1. YOU (ZONE OF COMFORT)",
    desc: "The character is grounded in their mundane and unchallenging everyday life.",
  },
  { id: "need", label: "2. NEED (WANT SOMETHING)", desc: "A core desire compels the protagonist to take action." },
  {
    id: "go",
    label: "3. GO (ENTER AN UNFAMILIAR SITUATION)",
    desc: "The character crosses a threshold to pursue what they want.",
  },
  {
    id: "search",
    label: "4. SEARCH (ADAPT TO IT)",
    desc: "They must acquire new skills and learn how to survive in this new world.",
  },
  {
    id: "find",
    label: "5. FIND (GET WHAT THEY WANTED)",
    desc: "The character achieves their goal, but it comes at a significant cost.",
  },
  {
    id: "take",
    label: "6. TAKE (PAY A HEAVY PRICE)",
    desc: "Victory is followed by new and unexpected losses or sacrifices.",
  },
  {
    id: "return",
    label: "7. RETURN (RETURN TO FAMILIAR SITUATION)",
    desc: "The character goes back to where they started.",
  },
  {
    id: "change",
    label: "8. CHANGE (HAVING CHANGED)",
    desc: "The character has grown, and the lessons learned remain with them.",
  },
]

export const THREE_ACT_BEATS: BeatStructure[] = [
  { id: "exposition", label: "1. EXPOSITION", desc: "Establish the protagonist's ordinary world." },
  {
    id: "incitingIncident",
    label: "2. INCITING INCIDENT",
    desc: "An event disrupts the ordinary world and kicks off the main story.",
  },
  {
    id: "plotPoint1",
    label: "3. PLOT POINT 1",
    desc: "The protagonist commits to facing the conflict, crossing a threshold into Act II.",
  },
  {
    id: "risingAction",
    label: "4. RISING ACTION",
    desc: "The protagonist faces escalating challenges, and the stakes are raised.",
  },
  {
    id: "midpoint",
    label: "5. MIDPOINT",
    desc: "A major turning point flips the story upside down, often making success feel impossible.",
  },
  {
    id: "plotPoint2",
    label: "6. PLOT POINT 2",
    desc: "The protagonist suffers a major setback, forcing them to question their ability to succeed.",
  },
  {
    id: "preClimax",
    label: "7. PRE-CLIMAX",
    desc: "The protagonist regroups and prepares for the final confrontation.",
  },
  { id: "climax", label: "8. CLIMAX", desc: "The ultimate showdown where the central conflict is finally resolved." },
  { id: "denouement", label: "9. D├ëNOUEMENT", desc: "Loose ends are tied up, and the new status quo is revealed." },
]

export const SEVEN_POINT_BEATS: BeatStructure[] = [
  {
    id: "hook",
    label: "1. HOOK",
    desc: "Grounds readers in the protagonist's world while introducing a spark of intrigue.",
  },
  {
    id: "plotPointOne",
    label: "2. PLOT POINT ONE",
    desc: "The inciting incident that disrupts normal life and pushes the protagonist into the main conflict.",
  },
  {
    id: "pinchPointOne",
    label: "3. PINCH POINT ONE",
    desc: "The first real clash with the antagonist, forcing the protagonist to confront the stakes.",
  },
  {
    id: "midpoint",
    label: "4. MIDPOINT",
    desc: "A major shift in perspective where the protagonist takes full responsibility and begins driving the story.",
  },
  {
    id: "pinchPointTwo",
    label: "5. PINCH POINT TWO",
    desc: "Conflict deepens and hope fades as the protagonist hits their lowest moment.",
  },
  {
    id: "plotPointTwo",
    label: "6. PLOT POINT TWO",
    desc: "A breakthrough where the hero gains new information, tools, or allies that change everything.",
  },
  {
    id: "resolution",
    label: "7. RESOLUTION",
    desc: "The climax and conclusion, where the protagonist's journey reaches its peak.",
  },
]

export const LESTER_DENT_BEATS: BeatStructure[] = [
  {
    id: "hitWithTrouble",
    label: "1. HIT THE HERO WITH TROUBLE",
    desc: "First line: Hit the hero with their trouble. Expand on the situation and hint at the core problem.",
  },
  {
    id: "jumpIntoAction",
    label: "2. JUMP INTO ACTION",
    desc: "The hero must grapple with the problem head-on from the start.",
  },
  {
    id: "introduceAllies",
    label: "3. INTRODUCE ALLIES AND COUNTERPARTS",
    desc: "Bring in other key characters to engage with the problem.",
  },
  { id: "altercation1", label: "4. ALTERCATION 1", desc: "Trigger a physical conflict to escalate events." },
  {
    id: "achieveMinor",
    label: "5. ACHIEVE SOMETHING MINOR",
    desc: "Allow the hero a small victory, like uncovering a clue or releasing a captive.",
  },
  {
    id: "plotTwist1",
    label: "6. PLOT TWIST 1",
    desc: "End the section with a surprise that reveals something is not what it seems.",
  },
  {
    id: "doubleTrouble",
    label: "7. DOUBLE THE TROUBLE",
    desc: "Dramatically escalate the stakes and tension from Part 1.",
  },
  {
    id: "showStruggle",
    label: "8. SHOW THE STRUGGLE",
    desc: "Depict the hero unsuccessfully grappling with the heightened pressure.",
  },
  {
    id: "altercation2",
    label: "9. ALTERCATION 2",
    desc: "Initiate a second physical conflict, keeping it fresh and distinct from the first.",
  },
  {
    id: "plotTwist2",
    label: "10. PLOT TWIST 2",
    desc: "End with another twist, proving yet another element is not as it seems.",
  },
  { id: "ratchetTension", label: "11. RATCHET THE TENSION", desc: "Push the pressure to its absolute highest point." },
  { id: "falseHope", label: "12. PROVIDE FALSE HOPE", desc: "Offer a temporary glimmer of hope or progress." },
  {
    id: "altercation3",
    label: "13. ALTERCATION 3",
    desc: "Ensure this glimmer of hope leads directly into a third physical conflict.",
  },
  {
    id: "devastatingTwist",
    label: "14. DEVASTATING TWIST",
    desc: "End with a crushing reversal that leaves the hero in an impossible, all-is-lost situation.",
  },
  { id: "lastStraw", label: '15. ADD A "LAST STRAW"', desc: "Push the hero to their absolute lowest point." },
  {
    id: "escapeDefeat",
    label: "16. ESCAPE AND DEFEAT",
    desc: "The hero uses specialist skills to escape and overcome the villain.",
  },
  { id: "tieUpLooseEnds", label: "17. TIE UP LOOSE ENDS", desc: "Resolve all remaining mysteries." },
  { id: "finalPlotTwist", label: "18. FINAL PLOT TWIST", desc: "Deliver one last surprise at the very end." },
  { id: "deliverPunchline", label: "19. DELIVER THE PUNCHLINE", desc: "Conclude with a clever, snappy final line." },
]

export const SONG_ARC_BEATS: BeatStructure[] = [
  { id: "mvHook", label: "1. VISUAL HOOK", desc: "Striking opening motif or tableau that sets tone." },
  { id: "verseOne", label: "2. VERSE ΓÇö WORLD", desc: "Establish character, space, and emotional baseline." },
  { id: "preChorus", label: "3. PRE-CHORUS ΓÇö TENSION", desc: "Build anticipation toward the release." },
  { id: "chorusOne", label: "4. CHORUS ΓÇö RELEASE", desc: "Emotional and visual peak; core theme lands." },
  { id: "verseTwo", label: "5. VERSE ΓÇö DEEPEN", desc: "Contrast, complication, or new story information." },
  { id: "bridge", label: "6. BRIDGE ΓÇö SHIFT", desc: "Breakdown, tonal shift, or surreal turn." },
  { id: "chorusFinale", label: "7. FINAL CHORUS", desc: "Climactic restatement at maximum intensity." },
  { id: "outro", label: "8. OUTRO / TAG", desc: "Resolve image, linger, or return to motif." },
]

export const PERFORMANCE_MV_BEATS: BeatStructure[] = [
  { id: "coldOpen", label: "1. COLD OPEN", desc: "Tease energy, rhythm, or crowd before the reveal." },
  { id: "stageEstablish", label: "2. STAGE ESTABLISH", desc: "Introduce artist, band, and performance space." },
  { id: "versePerformance", label: "3. INTIMATE PERFORMANCE", desc: "Closer shots, choreography, connection with camera." },
  { id: "chorusPerformance", label: "4. FULL CHORUS / PEAK", desc: "Lights, crowd, full arrangement hits." },
  { id: "soloPeak", label: "5. SOLO / VISUAL CLIMAX", desc: "Instrumental break, hero moment, or stunt." },
  { id: "finaleLockup", label: "6. FINALE & LOCKUP", desc: "Final hit, hold, and brand or title card." },
]

export const VISUAL_CONCEPT_MV_BEATS: BeatStructure[] = [
  { id: "motifOpen", label: "1. OPENING MOTIF", desc: "Symbolic or surreal image introduces the world." },
  { id: "symbolIntro", label: "2. SYMBOL INTRODUCTION", desc: "Core visual metaphor established and repeated." },
  { id: "variation", label: "3. ESCALATION / VARIATION", desc: "Motif evolves, fractures, or multiplies." },
  { id: "midReveal", label: "4. MIDPOINT REVEAL", desc: "Hidden meaning or relationship surfaces." },
  { id: "contrastSeq", label: "5. CONTRAST SEQUENCE", desc: "Juxtaposition, inversion, or opposing imagery." },
  { id: "emotionalPeak", label: "6. EMOTIONAL PEAK", desc: "Highest intensity beat before release." },
  { id: "resolvingImage", label: "7. RESOLVING IMAGE", desc: "Close on final symbol or quiet exhale." },
]

export const PROBLEM_SOLUTION_BEATS: BeatStructure[] = [
  { id: "hookProblem", label: "1. HOOK ΓÇö PROBLEM", desc: "Relatable pain or frustration in everyday context." },
  { id: "agitate", label: "2. AGITATE", desc: "Stakes rise; problem feels urgent and personal." },
  { id: "turn", label: "3. TURN ΓÇö DISCOVERY", desc: "Introduction of the product or solution." },
  { id: "demonstration", label: "4. DEMONSTRATION", desc: "Solution in action; clear before/after." },
  { id: "proof", label: "5. PROOF & BENEFITS", desc: "Credibility, results, or emotional payoff." },
  { id: "cta", label: "6. CTA & LOCKUP", desc: "Clear call to action and brand mnemonic." },
]

export const LIFESTYLE_SPOT_BEATS: BeatStructure[] = [
  { id: "aspirationalOpen", label: "1. ASPIRATIONAL OPEN", desc: "Beautiful, desirable world or mood." },
  { id: "tribeWorld", label: "2. WORLD & TRIBE", desc: "Community, aesthetics, and shared values." },
  { id: "ritual", label: "3. RITUAL / DAY", desc: "Authentic moments where product fits naturally." },
  { id: "productContext", label: "4. PRODUCT IN CONTEXT", desc: "Hero shot integrated into lifestyle fabric." },
  { id: "emotionalPayoff", label: "5. EMOTIONAL PAYOFF", desc: "Feeling of belonging, confidence, or freedom." },
  { id: "brandMoment", label: "6. BRAND MOMENT", desc: "Logo, signature color, or tagline lands." },
]

export const MINI_STORY_SPOT_BEATS: BeatStructure[] = [
  { id: "relatableSetup", label: "1. RELATABLE SETUP", desc: "Character and everyday situation we recognize." },
  { id: "incitingMoment", label: "2. INCITING MOMENT", desc: "Small crisis, desire, or awkward turn." },
  { id: "complication", label: "3. COMPLICATION", desc: "Obstacle escalates with humor or tension." },
  { id: "twist", label: "4. TWIST / REVEAL", desc: "Unexpected beat reframes the situation." },
  { id: "brandHero", label: "5. BRAND AS HERO", desc: "Product resolves tension with charm or clarity." },
  { id: "resolution", label: "6. RESOLUTION", desc: "Character wins relief, status, or connection." },
  { id: "tagline", label: "7. TAGLINE / LOCKUP", desc: "Memorable line and brand end card." },
]

export const beatStructures = [
  HERO_JOURNEY_BEATS,
  SAVE_THE_CAT_BEATS,
  STORY_CIRCLE_BEATS,
  THREE_ACT_BEATS,
  SEVEN_POINT_BEATS,
  LESTER_DENT_BEATS,
  SONG_ARC_BEATS,
  PERFORMANCE_MV_BEATS,
  VISUAL_CONCEPT_MV_BEATS,
  PROBLEM_SOLUTION_BEATS,
  LIFESTYLE_SPOT_BEATS,
  MINI_STORY_SPOT_BEATS,
]
