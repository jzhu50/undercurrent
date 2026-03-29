/**
 * Module-level store for passing recording pipeline state between
 * the /record page (where the pipeline runs) and the /results page.
 * Persists for the lifetime of the browser session (in-memory).
 */

export interface RecordingResult {
  status: 'processing' | 'done' | 'error'
  gradientColors?: string[]
  emotionBeneath?: string
  contradictionDetected?: boolean
  contradictionMessage?: string
  entryId?: string   // set once the entry is persisted to DB
  error?: string
}

let _state: RecordingResult = { status: 'processing' }
const _listeners = new Set<() => void>()

export function getRecordingResult(): RecordingResult {
  return _state
}

export function setRecordingResult(next: RecordingResult): void {
  _state = next
  _listeners.forEach((fn) => fn())
}

export function subscribeRecordingResult(fn: () => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
