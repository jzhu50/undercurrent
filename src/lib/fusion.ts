import type { FusedEmotions } from '@/lib/models/Entry'

// ── Signal shape ─────────────────────────────────────────────────────────────

export interface GeminiEmotions {
  joy: number
  anger: number
  fear: number
  sadness: number
  disgust: number
  surprise: number
}

export interface HumeVoiceEmotions {
  joy: number
  anger: number
  fear: number
  sadness: number
  disgust: number
  surprise: number
}

export interface HumeFaceEmotions {
  joy: number
  anger: number
  fear: number
  sadness: number
  disgust: number
  surprise: number
}

export interface PresageEmotions {
  joy: number
  anger: number
  fear: number
  sadness: number
  disgust: number
  surprise: number
}

// ── Contradiction result ──────────────────────────────────────────────────────

export interface ContradictionResult {
  detected: boolean
  message: string
}

// ── Internal types ────────────────────────────────────────────────────────────

type EmotionKey = keyof FusedEmotions
const EMOTION_KEYS: EmotionKey[] = ['joy', 'anger', 'fear', 'sadness', 'disgust', 'surprise']

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalizes an emotion object so all 6 values sum to exactly 100.
 * If every value is 0 (or the object is otherwise empty), returns equal
 * distribution (~16.7 each, summing to 100 via rounding adjustment).
 */
export function normalizeToHundred(raw: GeminiEmotions): FusedEmotions {
  const total = EMOTION_KEYS.reduce((sum, k) => sum + raw[k], 0)

  if (total === 0) {
    // Equal distribution: five get 16.7, one gets the rounding remainder
    const base = 16.7
    return {
      joy:      base,
      anger:    base,
      fear:     base,
      sadness:  base,
      disgust:  base,
      surprise: Math.round((100 - base * 5) * 10) / 10,
    }
  }

  const scaled = EMOTION_KEYS.map((k) =>
    Math.round((raw[k] / total) * 1000) / 10  // 1 decimal place
  )

  // Fix rounding drift so sum is exactly 100
  const drift = Math.round((100 - scaled.reduce((a, b) => a + b, 0)) * 10) / 10
  scaled[0] = Math.round((scaled[0] + drift) * 10) / 10

  return {
    joy:      scaled[0],
    anger:    scaled[1],
    fear:     scaled[2],
    sadness:  scaled[3],
    disgust:  scaled[4],
    surprise: scaled[5],
  }
}

function dominantEmotion(e: GeminiEmotions): EmotionKey {
  return EMOTION_KEYS.reduce((best, k) => (e[k] > e[best] ? k : best), EMOTION_KEYS[0])
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Blends 4 signals into a single FusedEmotions object.
 *
 * Weights with presage:    Gemini 55%, HumeVoice 25%, HumeFace 10%, Presage 10%
 * Weights without presage: Gemini 61%, HumeVoice 28%, HumeFace 11%
 *
 * Returns values rounded to 1 decimal that sum to 100.
 */
export function fuseEmotions(
  gemini: GeminiEmotions,
  humeVoice: HumeVoiceEmotions,
  humeFace: HumeFaceEmotions,
  presage: PresageEmotions | null,
): FusedEmotions {
  const weights =
    presage !== null
      ? { gemini: 0.55, humeVoice: 0.25, humeFace: 0.10, presage: 0.10 }
      : { gemini: 0.61, humeVoice: 0.28, humeFace: 0.11, presage: 0.00 }

  const blended = {} as Record<EmotionKey, number>

  for (const k of EMOTION_KEYS) {
    const value =
      gemini[k]     * weights.gemini    +
      humeVoice[k]  * weights.humeVoice +
      humeFace[k]   * weights.humeFace  +
      (presage ? presage[k] * weights.presage : 0)

    blended[k] = value
  }

  return normalizeToHundred(blended as GeminiEmotions)
}

/**
 * Detects contradictions across signals by comparing each signal's dominant
 * emotion. If 2 or more signals have different dominant emotions, contradiction
 * is flagged.
 *
 * Returns a message in the format:
 *   'Your words said [gemini top]. Your voice said [humeVoice top]. Your face said [humeFace top].'
 *
 * If no contradiction, message is an empty string.
 */
export function detectContradiction(
  gemini: GeminiEmotions,
  humeVoice: HumeVoiceEmotions,
  humeFace: HumeFaceEmotions,
  presage: PresageEmotions | null,
): ContradictionResult {
  const geminiTop    = dominantEmotion(gemini)
  const humeVoiceTop = dominantEmotion(humeVoice)
  const humeFaceTop  = dominantEmotion(humeFace)

  const tops = presage !== null
    ? [geminiTop, humeVoiceTop, humeFaceTop, dominantEmotion(presage)]
    : [geminiTop, humeVoiceTop, humeFaceTop]

  const uniqueTops = new Set(tops)
  const detected = uniqueTops.size >= 2

  const message = detected
    ? `Your words said ${geminiTop}. Your voice said ${humeVoiceTop}. Your face said ${humeFaceTop}.`
    : ''

  return { detected, message }
}
