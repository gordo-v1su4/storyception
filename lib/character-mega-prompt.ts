/**
 * Storyception character-sheet mega-prompt.
 *
 * Verbatim from the user's brief (see 2026-05-14 conversation). Produces a
 * single 4K layout image: turnaround + head studies + cinematic portrait +
 * wardrobe breakdown + production notes — the Kaito-Tanaka-style sheet.
 *
 * `buildCharacterSheetPrompt({...})` substitutes the bracketed placeholders.
 * Anything the caller doesn't pass falls back to "infer from reference image",
 * which tells the model to derive it from the attached source image.
 */
import type { ArchetypeCategoryId } from './types'

export interface CharacterSheetInput {
  /** Required: display name for the character (e.g. "Kaito Tanaka"). */
  name: string
  /** Optional alias/codename (e.g. "Saxophone Virtuoso"). */
  alias?: string
  /** Stylized age string, e.g. "27" or "early 30s". */
  age?: string
  /** "180cm / 5'11"" or similar. */
  height?: string
  /** Body type & posture notes. */
  build?: string
  /** "Japanese", "Afro-Latino with anime influence", etc. */
  ethnicity?: string
  /** "Saxophone Virtuoso", "Reluctant Hero", etc. */
  role?: string
  /** 3-5 dominant traits, comma-separated. */
  coreTraits?: string
  /** Short emotional baseline. */
  emotionalBaseline?: string
  /** Wardrobe summary if known. */
  wardrobe?: string
  /** Frequently-carried object. */
  prop?: string
  /** Narrative archetype category — toggles the STYLE block. */
  archetypeCategory?: ArchetypeCategoryId
  /** Override the style block entirely. */
  styleOverride?: string
  /** Optional one-line character quote. */
  quote?: string
}

const STYLE_BY_CATEGORY: Record<ArchetypeCategoryId, string> = {
  'music-video':
    'Hyper-expressive cinematic realism with stylized lighting and a color palette aligned to the track mood. Performance-forward, art-directed, slightly painterly.',
  'film-tv':
    'Semi-realistic cinematic character design. High emotional readability with restrained stylization. Production-board fidelity.',
  commercial:
    'Pixar-style stylized realism. Appealing exaggeration, soft geometry, high emotional readability, vibrant cinematic lighting.',
}

function val(v: string | undefined, fallback: string): string {
  const t = v?.trim()
  return t && t.length > 0 ? t : fallback
}

/**
 * Returns the long-form text prompt to pass to gemini-3-pro-image-preview.
 * Provide the source image as an inlineData part alongside this prompt.
 */
export function buildCharacterSheetPrompt(input: CharacterSheetInput): string {
  const INFER = 'infer from reference image'
  const style =
    input.styleOverride?.trim() ||
    (input.archetypeCategory ? STYLE_BY_CATEGORY[input.archetypeCategory] : null) ||
    STYLE_BY_CATEGORY['film-tv']

  return `Create a cinematic, film-production-grade character design sheet intended for a director, casting team, and costume department. This must feel like a high-budget film, commercial, TV series or music video pitch board, not a generic model sheet.

CORE DIRECTIVE (NON-NEGOTIABLE)
- No generic layouts
- No evenly spaced grids
- No symmetry for the sake of neatness
- Composition must feel art-directed, intentional, slightly asymmetrical
- Every section should feel placed, not auto-generated

CHARACTER IDENTITY
- Name: ${val(input.name, INFER)}
- Alias / ID: ${val(input.alias, INFER)}
- Age: ${val(input.age, INFER)}
- Height: ${val(input.height, INFER)}
- Build: ${val(input.build, INFER)}
- Ethnicity / Design Language: ${val(input.ethnicity, INFER)}
- Role / Archetype: ${val(input.role, INFER)}

FACE DESIGN
- Structure: ${INFER}
- Skin / Surface: detailed texture, soft subsurface light interaction, micro-imperfections, natural pores
- Eyes: ${INFER}
- Hair: ${INFER} — natural physics, slight imperfection, motion logic
- Distinct Features: ${INFER}

PSYCHOLOGICAL PROFILE (DRIVES PERFORMANCE)
- Core Traits: ${val(input.coreTraits, INFER)}
- Internal Conflict: ${INFER}
- Behavior Patterns: ${INFER}
- Emotional Baseline: ${val(input.emotionalBaseline, INFER)}

PERFORMANCE DIRECTION (CRITICAL)
Character must feel like a real actor caught mid-moment, not posing.
- Micro-expressions required (lip tension, eye movement, eyebrow shifts)
- Avoid staged symmetry
- Capture transitional emotion (before/after reaction)

Body Language:
- ${INFER} posture tendencies
- Movement rhythm: ${INFER}
- Idle behavior: ${INFER}

WARDROBE (PRODUCTION-REALISTIC WITH STYLIZATION)
- Primary Outfit: ${val(input.wardrobe, INFER)}
  - fabric type, wear, imperfections, layering logic
- Footwear: ${INFER}
- Accessories: ${INFER}
- Props: ${val(input.prop, INFER)}

MATERIAL & TEXTURE ACCURACY
- Fabrics must show stretch, stitching, wrinkles, wear
- Surfaces must avoid plastic look unless intentionally stylized
- Skin should have soft light interaction, slight bounce
- Include imperfections: dirt, smudges, aging, usage marks

TURNAROUND REQUIREMENTS (STRICT CONSISTENCY)
Generate a full-body turnaround with identical proportions and design fidelity, on a neutral gray seamless backdrop:
- Front View
- 3/4 View
- Side View (Profile)
- Back View
- 3/4 Back View
No drift in proportions, face, or costume across views.

HEAD STUDY (ACTOR REFERENCE QUALITY)
Include expressive head variations, captured mid-thought, never posed:
1. Front — controlled / neutral expression
2. 3/4 — primary personality expression
3. Profile — structure clarity
4. Looking Down — quiet / introspective emotion
5. Looking Up — vulnerable / hopeful emotion
6. Dynamic Angle — intense emotional state

CINEMATIC PORTRAIT (FILM STILL)
- Environment: location tied to character behavior (${INFER} based on role)
- Lighting: motivated practical sources, ambient glow, strong contrast
- Color Tone: ${INFER}
- Expression: a specific narrative moment, not a posed beauty shot
- Camera: 85mm lens, shallow depth of field, cinematic realism, eyes razor sharp

CAMERA + LIGHTING SPECIFICATIONS
- Full Body: 35mm lens, soft key + bounce, natural exposure, no HDR
- Portrait: 85mm lens, shallow DOF, focus on eyes and expression

COMPOSITION & LAYOUT (PREMIUM STUDIO BOARD)
- Clean but art-directed sheet layout, slightly asymmetrical
- Neutral gray / soft-tone background for the turnaround
- Structured but visually dynamic section placement
- Include:
  - Height scale reference next to the turnaround
  - Annotation callouts (fabric stretch, personality cues, prop usage)
  - Wardrobe breakdown section with swatches / detail crops
  - Color palette strip
  - Production notes / camera + lighting guide block
${input.quote ? `  - Director quote callout: "${input.quote}"` : ''}

STYLE
${style}

Must include:
- Appealing exaggeration
- Soft geometry
- Cinematic lighting
- High emotional readability

CONSISTENCY RULE (STRICT)
Face, proportions, costume, and details must remain identical across all views and sections. No reinterpretation between angles. The face in the reference image is the canonical face — do not stylize it away.

OUTPUT QUALITY
- Extremely high detail
- Sharp focus
- Production-ready fidelity
- Suitable for film development, merchandising, and pitch decks
- Single composite layout image (one canvas, all sections placed within it)
- Wide cinematic aspect (16:9)`
}

/**
 * Prompt for a clean **look sheet** — Min/Fang style. NO writing, NO annotations,
 * NO color palette. Just a tightly arranged photo grid of the character in ONE
 * wardrobe/look ("Default" by default). This is the primary visual reference
 * passed into per-beat keyframe generation; the model uses it to lock face,
 * proportions, wardrobe, and key expressions without any text confusing it.
 *
 * Layout target (single composite image, 16:9, panels with thin black gutters):
 *   Row 1 (left → right): Front turnaround · 3/4 turnaround · Side · Back · then
 *                         3 head studies stacked on the right side.
 *   Row 2: A few medium expression studies of the head/shoulders.
 *   Row 3: 3-4 detail close-ups (skin texture, hands, footwear, accessories) +
 *          a single cinematic close-up portrait at far right.
 *   Tiny numeric labels in the corners (e.g. [1] [2] [3]) only — no other text.
 */
export function buildCharacterLookSheetPrompt(input: {
  name: string
  descriptor?: string
  wardrobeLabel?: string
  archetypeCategory?: ArchetypeCategoryId
}): string {
  const desc = input.descriptor?.trim()
  const look = (input.wardrobeLabel || 'Default').trim()
  const style =
    input.archetypeCategory === 'music-video'
      ? 'cinematic realism with stylized lighting, performance-forward energy'
      : input.archetypeCategory === 'commercial'
        ? 'clean editorial realism, bright and readable, lifestyle-appropriate lighting'
        : 'semi-realistic cinematic character design, motivated practical lighting'
  return `Create a clean character reference photo-grid sheet for ${input.name}${look !== 'Default' ? ` in the "${look}" look` : ''}. ABSOLUTELY NO TEXT, NO TYPOGRAPHY, NO COLOR PALETTE BLOCKS, NO ANNOTATIONS, NO CALLOUTS — only photographic panels separated by thin neutral gutters. Tiny corner numerals like [1] [2] [3] are acceptable; nothing else written.

The face in the attached reference image is the canonical face. Preserve identity exactly across every panel — no drift in proportions, no reinterpretation, no stylization that loses the likeness.

LAYOUT (single composite 16:9 image, art-directed but cleanly readable):
- A horizontal TURNAROUND strip (full body) with 3-4 views on a neutral gray seamless backdrop:
    [1] Front view
    [2] 3/4 view
    [3] Side / profile
    [4] Back view
  Identical proportions, identical wardrobe, identical lighting across all turnaround panels.
- A HEAD STUDY block of 3-4 expressive head/shoulder portraits, each on the same neutral backdrop, each capturing a distinct emotional micro-moment (not posed): neutral focus, intense focus, looking up / vulnerable, dynamic emotional state.
- A DETAIL CLOSE-UP block of 3-4 macro-style crops on neutral backdrop: skin texture (pores, subsurface scatter, real micro-imperfections), hands, footwear, accessories/jewelry. These are not portraits — they are texture/material proof shots.
- ONE CINEMATIC CLOSE-UP panel at the far edge — same character, but in a location that feels true to who they are, with motivated practical lighting and shallow depth of field (85mm look). This is the only environmental shot on the entire sheet.

WARDROBE
${look === 'Default' ? '- Use the wardrobe visible in the reference image.' : `- Wardrobe state: "${look}". If the reference does not show this, infer it consistent with the character's role and the rest of the sheet.`}
- Wardrobe must be IDENTICAL across the turnaround and the head studies. The cinematic close-up may show wear/movement but must keep the same garments.

MATERIAL & TEXTURE
- Show pores, subsurface scatter, fine hairs, sweat highlights when appropriate.
- Fabrics show stretch, stitching, wrinkles, wear marks.
- Hair has natural physics, stray strands, real motion.
- No plastic look. No HDR. No oversharpening. Natural exposure.

STYLE
${style}. High emotional readability. Composition is intentional and slightly asymmetrical — never an evenly-spaced grid.

${desc ? `Character context (for tone, posture, demeanor):\n${desc}\n\n` : ''}OUTPUT
- Single composite PNG, 16:9, 4K, sharp focus, production-ready.
- Looks like a real photo-grid, not a graphic design.`
}

export type { ArchetypeCategoryId }
