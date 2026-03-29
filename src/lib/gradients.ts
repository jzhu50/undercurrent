import type { FusedEmotions } from '@/lib/models/Entry'

// ── Default palette (matches colors/page.tsx MOODS defaults) ─────────────────

export const EMOTION_DEFAULTS: Record<string, string> = {
  joy:      '#fde2e4',
  sadness:  '#e2ece9',
  anger:    '#dbcfbd',
  surprise: '#fefae0',
  disgust:  '#efcfe3',
  fear:     '#add8e6',
}

// ── HSL fallback (used only server-side / when no user colors are set) ────────

const EMOTION_HUES: Record<keyof FusedEmotions, number> = {
  joy:      48,
  anger:    0,
  fear:     270,
  sadness:  220,
  disgust:  140,
  surprise: 30,
}

function hslToHex(h: number, s: number, l: number): string {
  const lNorm = l / 100
  const a = (s * Math.min(lNorm, 1 - lNorm)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// ── Shared localStorage helper (client-only) ──────────────────────────────────

export function loadEmotionColors(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem('undercurrent_emotion_colors') ?? '{}')
  } catch {
    return {}
  }
}

// ── Gradient stop positions ───────────────────────────────────────────────────

/**
 * Returns the CSS gradient stop positions (0–100) for the top 3 emotions,
 * proportional to their scores. e.g. [0, 60, 85] for scores [60, 25, 15].
 */
export function computeGradientStops(emotions: FusedEmotions): number[] {
  const sorted = (Object.keys(emotions) as Array<keyof FusedEmotions>)
    .map((key) => ({ key, score: emotions[key] }))
    .sort((a, b) => b.score - a.score)

  const top   = sorted.slice(0, 3)
  const total = top.reduce((s, t) => s + t.score, 0) || 1

  let cumulative = 0
  return top.map(({ score }) => {
    const stop = Math.round((cumulative / total) * 100)
    cumulative += score
    return stop
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns an array of 3 hex color strings for a CSS gradient.
 *
 * When `userColors` is provided (from localStorage), the user's chosen color
 * for each emotion is used directly. Otherwise falls back to HSL-derived pastels.
 *
 * Pass `userColors` on the client; omit on the server.
 */
export function computeGradientColors(
  emotions: FusedEmotions,
  userColors?: Record<string, string>,
): string[] {
  const sorted = (Object.keys(emotions) as Array<keyof FusedEmotions>)
    .map((key) => ({ key, score: emotions[key] }))
    .sort((a, b) => b.score - a.score)

  const top = sorted.slice(0, 3)

  return top.map(({ key, score }) => {
    // Prefer user color, then EMOTION_DEFAULTS, then computed HSL
    const custom = userColors?.[key] ?? (userColors ? EMOTION_DEFAULTS[key] : undefined)
    if (custom) return custom

    const hue        = EMOTION_HUES[key]
    const saturation = 50 + (score / 100) * 25
    const lightness  = 80 - (score / 100) * 8
    return hslToHex(hue, saturation, lightness)
  })
}
