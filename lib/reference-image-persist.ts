/**
 * Session `reference_image_url` must not store multi‑MB `data:` blobs (NocoDB SingleLineText / LongText limits).
 * Real HTTPS URLs are kept; everything else that is huge or inline binary is dropped for DB only.
 */
const DEFAULT_MAX_LEN = 50_000

export function referenceImageUrlForPersistence(value: unknown): string | null {
  if (value == null || typeof value !== 'string') return null
  const s = value.trim()
  if (!s) return null
  if (s.startsWith('data:')) return null
  const max = Number(process.env.STORYCEPTION_MAX_REFERENCE_URL_LENGTH) || DEFAULT_MAX_LEN
  if (s.length > max) return null
  return s
}
