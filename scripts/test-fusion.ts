/**
 * Manual smoke test for src/lib/fusion.ts
 * Run with: pnpm tsx scripts/test-fusion.ts
 */

// Alias the @/ path for outside the Next.js compiler
import { fuseEmotions, detectContradiction, normalizeToHundred } from '../src/lib/fusion'

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function sum(e: { joy: number; anger: number; fear: number; sadness: number; disgust: number; surprise: number }) {
  return Math.round((e.joy + e.anger + e.fear + e.sadness + e.disgust + e.surprise) * 10) / 10
}

// ── normalizeToHundred ────────────────────────────────────────────────────────

console.log('\nnormalizeToHundred()')

const raw1 = { joy: 50, anger: 10, fear: 10, sadness: 10, disgust: 10, surprise: 10 }
const n1 = normalizeToHundred(raw1)
assert('already-valid input sums to 100', sum(n1) === 100, `got ${sum(n1)}`)
assert('joy is dominant', n1.joy > n1.anger)

const raw2 = { joy: 200, anger: 100, fear: 50, sadness: 50, disgust: 50, surprise: 50 }
const n2 = normalizeToHundred(raw2)
assert('large values normalize to 100', sum(n2) === 100, `got ${sum(n2)}`)

const rawZero = { joy: 0, anger: 0, fear: 0, sadness: 0, disgust: 0, surprise: 0 }
const nZero = normalizeToHundred(rawZero)
assert('all-zero returns 100 total', sum(nZero) === 100, `got ${sum(nZero)}`)
assert('all-zero gives roughly equal shares', nZero.joy >= 16 && nZero.joy <= 17)

// ── fuseEmotions with presage ─────────────────────────────────────────────────

console.log('\nfuseEmotions() — with presage')

const joySignal    = { joy: 80, anger: 5,  fear: 5,  sadness: 5,  disgust: 3,  surprise: 2  }
const neutralVoice = { joy: 20, anger: 20, fear: 20, sadness: 20, disgust: 10, surprise: 10 }
const neutralFace  = { joy: 20, anger: 20, fear: 20, sadness: 20, disgust: 10, surprise: 10 }
const neutralPres  = { joy: 20, anger: 20, fear: 20, sadness: 20, disgust: 10, surprise: 10 }

const fused1 = fuseEmotions(joySignal, neutralVoice, neutralFace, neutralPres)
assert('sums to 100', sum(fused1) === 100, `got ${sum(fused1)}`)
assert('joy is dominant (Gemini 55% weight)', fused1.joy > fused1.anger)
assert('all values are numbers', Object.values(fused1).every(v => typeof v === 'number'))
assert('no negatives', Object.values(fused1).every(v => v >= 0))

// ── fuseEmotions without presage ──────────────────────────────────────────────

console.log('\nfuseEmotions() — without presage (null)')

const fused2 = fuseEmotions(joySignal, neutralVoice, neutralFace, null)
assert('sums to 100 without presage', sum(fused2) === 100, `got ${sum(fused2)}`)
assert('joy still dominant', fused2.joy > fused2.anger)
// Joy should be higher when presage (neutral) is removed — Gemini weight goes from 55% → 61%
assert('joy higher without neutral presage signal', fused2.joy >= fused1.joy)

// ── detectContradiction — no contradiction ────────────────────────────────────

console.log('\ndetectContradiction() — no contradiction')

const joyDominant  = { joy: 70, anger: 5, fear: 5, sadness: 10, disgust: 5, surprise: 5 }
const noContradict = detectContradiction(joyDominant, joyDominant, joyDominant, null)
assert('detected is false when all signals agree', !noContradict.detected)
assert('message is empty string', noContradict.message === '')

// ── detectContradiction — contradiction ───────────────────────────────────────

console.log('\ndetectContradiction() — contradiction detected')

const sadSignal     = { joy: 5,  anger: 5,  fear: 5,  sadness: 70, disgust: 10, surprise: 5 }
const angrySignal   = { joy: 5,  anger: 70, fear: 5,  sadness: 5,  disgust: 10, surprise: 5 }
const contradict    = detectContradiction(joyDominant, sadSignal, angrySignal, null)
assert('detected is true when signals disagree', contradict.detected)
assert('message is non-empty', contradict.message.length > 0)
assert('message mentions words/voice/face',
  contradict.message.includes('words') &&
  contradict.message.includes('voice') &&
  contradict.message.includes('face')
)
assert('message format correct (ends with period)',
  contradict.message.trim().endsWith('.')
)

// Print a sample message so it can be reviewed visually
console.log(`\n  Sample contradiction message:\n  "${contradict.message}"`)

// ── Precision check ───────────────────────────────────────────────────────────

console.log('\nPrecision')

for (let i = 0; i < 20; i++) {
  const r = () => Math.floor(Math.random() * 100)
  const rand = { joy: r(), anger: r(), fear: r(), sadness: r(), disgust: r(), surprise: r() }
  const result = fuseEmotions(rand, rand, rand, rand)
  if (sum(result) !== 100) {
    assert(`random trial ${i} sums to 100`, false, `got ${sum(result)}`)
  }
}
assert('20 random fuse calls all sum to 100', true)

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`  ${passed} passed  ${failed} failed`)
if (failed > 0) process.exit(1)
