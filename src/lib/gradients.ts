import type { FusedEmotions } from '@/lib/models/Entry'

/**
 * Each of the 6 emotions maps to a base hue (HSL).
 * Colors are blended proportionally by emotion weight,
 * then converted to hex.
 */
const EMOTION_HUES: Record<keyof FusedEmotions, number> = {
  joy:      48,   // warm yellow
  anger:    0,    // red
  fear:     270,  // violet
  sadness:  220,  // blue
  disgust:  140,  // green
  surprise: 30,   // orange
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

/**
 * Takes a FusedEmotions object and returns an array of 3 hex color strings
 * suitable for a CSS gradient. Colors are derived from the top 3 emotions
 * by weight, blended toward pastel for readability.
 */
export function computeGradientColors(emotions: FusedEmotions): string[] {
  const sorted = (Object.keys(emotions) as Array<keyof FusedEmotions>)
    .map((key) => ({ key, score: emotions[key] }))
    .sort((a, b) => b.score - a.score)

  // Take top 3 (or fewer if scores are degenerate)
  const top = sorted.slice(0, 3)

  return top.map(({ key, score }) => {
    const hue = EMOTION_HUES[key]
    // Map score 0–100 → saturation 50–75%, lightness 72–80%
    const saturation = 50 + (score / 100) * 25
    const lightness  = 80 - (score / 100) * 8
    return hslToHex(hue, saturation, lightness)
  })
}
