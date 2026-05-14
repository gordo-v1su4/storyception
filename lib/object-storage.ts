export type StoredObject = {
  bucket: string
  objectKey: string
  publicUrl: string
  mediaUrl?: string
}

const MEDIA_API_BASE_URL = (process.env.MEDIA_API_BASE_URL || 'https://media.v1su4.dev').replace(/\/+$/, '')
const MEDIA_API_TOKEN = process.env.MEDIA_API_TOKEN || ''
const STORYCEPTION_MEDIA_BUCKET = process.env.STORYCEPTION_MEDIA_BUCKET || 'storyception'
const STORYCEPTION_MEDIA_USER_ID = process.env.STORYCEPTION_MEDIA_USER_ID || 'storyception'

function authHeaders(): HeadersInit {
  if (!MEDIA_API_TOKEN) {
    throw new Error('MEDIA_API_TOKEN not configured')
  }
  return {
    Authorization: `Bearer ${MEDIA_API_TOKEN}`,
  }
}

/**
 * RustFS rule: object keys must not duplicate the bucket name (per `rustfs-object-layout.md`).
 * If a caller passes `bucket=storyception, folder=storyception/foo/bar`, the resulting URL would
 * be `s3.v1su4.dev/storyception/storyception/foo/bar` — the bad legacy shape. Strip leading
 * bucket-name segments so the canonical URL `s3.v1su4.dev/<bucket>/foo/bar` is always produced.
 */
function normalizeFolder(path: string, bucket: string): string {
  const parts = path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  while (parts.length > 0 && parts[0] === bucket) {
    parts.shift()
  }
  return parts.join('/')
}

export async function uploadBufferViaMediaApi(args: {
  buffer: Buffer
  fileName: string
  contentType: string
  folder: string
  bucket?: string
  userId?: string
}): Promise<StoredObject> {
  const bucket = args.bucket || STORYCEPTION_MEDIA_BUCKET
  const formData = new FormData()
  formData.append('userId', args.userId || STORYCEPTION_MEDIA_USER_ID)
  formData.append('folder', normalizeFolder(args.folder, bucket))
  formData.append('bucket', bucket)
  formData.append(
    'file',
    new Blob([Uint8Array.from(args.buffer)], {
      type: args.contentType || 'application/octet-stream',
    }),
    args.fileName
  )

  const response = await fetch(`${MEDIA_API_BASE_URL}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Media API upload failed (${response.status}): ${body.slice(0, 300)}`)
  }

  const parsed = JSON.parse(body) as {
    bucket?: string
    objectKey?: string
    path?: string
    publicUrl?: string
    mediaUrl?: string
  }

  if (!parsed.publicUrl || !(parsed.objectKey || parsed.path) || !parsed.bucket) {
    throw new Error(`Media API upload response missing fields: ${body.slice(0, 300)}`)
  }

  return {
    bucket: parsed.bucket,
    objectKey: parsed.objectKey || parsed.path || '',
    publicUrl: parsed.publicUrl,
    mediaUrl: parsed.mediaUrl,
  }
}
