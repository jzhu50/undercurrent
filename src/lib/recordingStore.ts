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
let _sessionId = 0
const _listeners = new Set<() => void>()

export function getRecordingResult(): RecordingResult {
  return _state
}

/**
 * Increments the session counter and resets the store to 'processing'.
 * Returns the new session ID — the caller must pass it to setRecordingResult
 * so stale pipeline writes from a previous session are silently dropped.
 */
export function startRecordingSession(): number {
  _sessionId += 1
  _state = { status: 'processing' }
  _listeners.forEach((fn) => fn())
  return _sessionId
}

/**
 * Only writes to the store if `sessionId` matches the current session.
 * Pass the value returned by `startRecordingSession()`.
 */
export function setRecordingResult(next: RecordingResult, sessionId: number): void {
  if (sessionId !== _sessionId) return   // stale pipeline — discard
  _state = next
  _listeners.forEach((fn) => fn())
}

export function subscribeRecordingResult(fn: () => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
