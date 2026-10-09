/** Reads a fetch response as JSON, surfacing non-JSON bodies (e.g. proxy/body-limit pages) as readable errors. */
export async function readApiJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160)
    throw new Error(`${label} returned HTTP ${response.status} with a non-JSON body: ${snippet || '(empty)'}`)
  }
}
