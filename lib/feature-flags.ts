/**
 * Image generation (character detection/sheets, 2x2 options, 3x3 storyboards) is opt-in
 * while the text flow is being built. Set `NEXT_PUBLIC_STORYCEPTION_IMAGES=1` to enable.
 * When off, uploads are resized in the browser and shown on the canvas as references only.
 */
export const IMAGE_GENERATION_ENABLED = process.env.NEXT_PUBLIC_STORYCEPTION_IMAGES === '1'
