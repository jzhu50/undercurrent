/**
 * Demo seeder — populates MongoDB with ~2–3 entries per week for the last 3 months.
 * Run with: pnpm tsx scripts/seed-demo.ts
 *
 * Clears existing entries for the target user before inserting, so it is safe
 * to re-run. Pass --dry-run to preview without writing.
 */

import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

import mongoose from 'mongoose'
import Entry from '../src/lib/models/Entry'
import { computeGradientColors } from '../src/lib/gradients'
import type { FusedEmotions } from '../src/lib/models/Entry'

// ── Config ────────────────────────────────────────────────────────────────────

const TARGET_USER_ID = 'user_3BbDT0gnO7Nnlv4Vko0LFHRSpQ1' // michellezhu
const DRY_RUN = process.argv.includes('--dry-run')

// ── Sample transcripts ────────────────────────────────────────────────────────

const TRANSCRIPTS = [
  "I woke up feeling really off today. Couldn't quite shake this low-grade anxiety that's been following me around all week. I got through my morning routine but I just kept thinking about the presentation coming up and whether I'm ready for it.",
  "Had a really nice lunch with Sarah today — we hadn't caught up in a while and it was so good to just laugh and talk about nothing important. I feel lighter than I have in days. Also finally finished that book I've been putting off.",
  "Work was brutal. Three back-to-back meetings and none of them actually needed to be meetings. I'm feeling stretched thin and a little resentful, honestly. I need to get better at saying no.",
  "Spent the morning at the farmers market and it made me genuinely happy in a way I didn't expect. There's something about being outside, surrounded by color and people, that resets me. Bought way too many tomatoes.",
  "I've been thinking a lot about my mom lately. She called yesterday and sounded tired. I don't know — there's this background worry I carry about her and my dad getting older and I don't know what to do with it.",
  "Today felt productive. Actually crossed off three big items on my to-do list and didn't spiral into procrastination. I rewarded myself with a walk and it was perfect — cool air, nobody around. I feel capable right now.",
  "The argument with Marcus last night is still sitting with me. We said things that were probably true but not kind. I don't know if I'm more hurt or more guilty. I want to fix it but I also need some time.",
  "Had the strangest dream last night — I was back in my childhood home but it was rearranged in ways that don't make sense. Woke up unsettled. The day has been fine but that residue is still there, this mild unease I can't explain.",
  "Something shifted today. I've been feeling stuck for weeks and then this morning I just... started. Started the project, started cleaning, started the thing I've been avoiding. I don't know what changed but I'm grateful.",
  "I cried in the car today. Not about anything specific, just that accumulation of everything. I actually felt better after. It's like I needed a release valve. Going to bed early tonight.",
  "Managed to meditate for 20 minutes this morning and I genuinely think it helped. Less reactive at work, more patient with myself. I want to keep this up but I know I'll probably forget by next week.",
  "My sister got some good news about her health today and I felt this wave of relief that I didn't realize I'd been holding back. It's amazing how much worry can just live in your body quietly.",
  "Feeling disconnected lately. I scroll through my phone and talk to people and none of it feels real. I think I need to go somewhere — change of scenery, even just a day trip. Something to remind me that the world is big.",
  "The client meeting went better than expected. I was braced for criticism and instead got genuine enthusiasm. I need to remember this feeling next time I'm spiraling about work — it's usually fine.",
  "Couldn't sleep last night. My mind kept cycling through old conversations, things I said or didn't say. I know it's not useful but knowing that doesn't make it stop. Exhausted today.",
  "Made dinner for the first time in weeks — actually cooked, not just assembled things. There's something meditative about chopping vegetables and it reminded me that I used to find cooking relaxing before everything got so busy.",
  "Had a hard conversation with my manager about my workload and I didn't crumble the way I expected to. I said what I needed to say clearly and she actually listened. I feel surprisingly okay.",
  "Spent the afternoon walking around the neighborhood with no agenda and noticed things I've walked past a hundred times without seeing. That old house on Maple that always has wind chimes. A mural on the side of the coffee shop. I felt present.",
  "I've been carrying this dull sadness all day and I'm not even sure where it's from. Nothing bad happened. Maybe it's the weather, maybe it's just mood chemistry. I'm trying not to interrogate it too hard.",
  "Finally told my friend about the thing I've been keeping to myself for months. She didn't react the way I feared. She just listened and said she was glad I told her. I feel ten pounds lighter.",
  "Work drama that I refuse to let into my system. Took a walk at lunch, breathed through it, let it go. I am more than my job and my job is fine and none of this matters as much as it feels like it does in the moment.",
  "Went for a run this morning for the first time since forever. My body was completely unprepared but my mind was so grateful. Endorphins are real. I need to do this more.",
  "Feeling nostalgic today. Found some old photos on my phone from a few years ago and it hit me how different everything is now. Not worse, just different. Time is strange.",
  "Had a moment of pure stillness this afternoon — sitting in the backyard, sun on my face, birds somewhere in the trees. I thought: I am okay. I mean it in the deepest possible sense. I am okay.",
  "Overwhelmed by small things today. The broken zipper. The delayed package. The email that needed three drafts. None of it is serious but together they wore me down. Tomorrow I will try again.",
  "Reading before bed has changed my sleep. This sounds mundane but it's true. I'm falling asleep easier, dreaming more vividly, waking up with ideas rather than dread.",
  "Talked to my dad for an hour today, longer than we usually manage. He told me a story about his first job that I'd never heard before. I feel closer to him and also sad that there's so much I don't know.",
  "The anxiety about the future has been quieter this week. I don't know if something shifted or if I'm just tired of being anxious. Either way, I'm taking it.",
  "Today was one of those days that will probably feel significant later. A conversation, a decision, a small moment of courage. I can't fully articulate it yet but I felt something unlock.",
  "I am tired in the bone-deep way that sleep doesn't fix. I think I need rest of a different kind — from stimulation, from decisions, from the noise. Planning a very quiet weekend.",
]

const KEYWORDS_POOL = [
  ['anxiety', 'work pressure', 'avoidance'],
  ['connection', 'laughter', 'relief'],
  ['burnout', 'boundaries', 'resentment'],
  ['joy', 'presence', 'gratitude'],
  ['worry', 'family', 'aging'],
  ['productivity', 'capability', 'reset'],
  ['conflict', 'guilt', 'repair'],
  ['unsettled', 'dreams', 'unease'],
  ['momentum', 'breakthrough', 'starting'],
  ['release', 'overwhelm', 'exhaustion'],
  ['mindfulness', 'consistency', 'intention'],
  ['relief', 'health', 'family'],
  ['disconnection', 'longing', 'change'],
  ['validation', 'work', 'confidence'],
  ['rumination', 'insomnia', 'past'],
  ['cooking', 'ritual', 'simplicity'],
  ['assertiveness', 'boundaries', 'recognition'],
  ['presence', 'noticing', 'slowness'],
  ['sadness', 'acceptance', 'mood'],
  ['vulnerability', 'trust', 'lightness'],
  ['detachment', 'resilience', 'perspective'],
  ['movement', 'body', 'renewal'],
  ['nostalgia', 'time', 'change'],
  ['stillness', 'peace', 'acceptance'],
  ['overwhelm', 'small things', 'patience'],
  ['sleep', 'reading', 'rest'],
  ['family', 'stories', 'closeness'],
  ['anxiety', 'quiet', 'relief'],
  ['courage', 'decision', 'growth'],
  ['deep rest', 'quiet', 'renewal'],
]

const EMOTION_BENEATH_POOL = [
  "There's a quiet fear of not being enough running underneath all of this — it shows up as busy-ness but it's really about worth.",
  "What looks like frustration is really a longing to be seen and appreciated for the effort you put in every day.",
  "Beneath the lightness today is a kind of gratitude you rarely let yourself fully feel — it's okay to sit in it.",
  "The sadness isn't really about what happened today. It's about something older, a feeling of being alone that surfaces when things pile up.",
  "There's an unspoken fear of loss underneath the worry — the kind that lives in the body before it reaches words.",
  "What you're calling anxiety might actually be excitement that hasn't found its outlet yet.",
  "The relief you felt isn't just about this situation — it's been building for a while, a pressure that needed release.",
  "Underneath the productivity is a need to prove something, maybe to yourself more than anyone else.",
  "The disconnection you feel is often your system asking for stillness — it's not emptiness, it's capacity waiting to be refilled.",
  "What feels like sadness today might be your body processing something it couldn't process in the moment it happened.",
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomEmotions(): FusedEmotions {
  // Generate 6 random weights then normalize
  const raw = {
    joy:      rnd(0, 80),
    anger:    rnd(0, 50),
    fear:     rnd(0, 50),
    sadness:  rnd(0, 60),
    disgust:  rnd(0, 30),
    surprise: rnd(0, 40),
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0)
  const keys = Object.keys(raw) as (keyof FusedEmotions)[]
  const normalized = {} as FusedEmotions
  keys.forEach((k) => {
    normalized[k] = Math.round((raw[k] / total) * 1000) / 10
  })
  // Fix rounding drift
  const sum = keys.reduce((a, k) => a + normalized[k], 0)
  const drift = Math.round((100 - sum) * 10) / 10
  normalized.joy = Math.round((normalized.joy + drift) * 10) / 10
  return normalized
}

function emotionBias(
  base: FusedEmotions,
  key: keyof FusedEmotions,
  boost: number,
): FusedEmotions {
  // Boost one emotion and renormalize — used for per-signal variation
  const raw = { ...base, [key]: base[key] + boost }
  const total = Object.values(raw).reduce((a, b) => a + b, 0)
  const keys = Object.keys(raw) as (keyof FusedEmotions)[]
  const out = {} as FusedEmotions
  keys.forEach((k) => { out[k] = Math.round((raw[k] / total) * 1000) / 10 })
  const drift = Math.round((100 - keys.reduce((a, k) => a + out[k], 0)) * 10) / 10
  out.joy = Math.round((out.joy + drift) * 10) / 10
  return out
}

function dominantKey(e: FusedEmotions): keyof FusedEmotions {
  return (Object.keys(e) as (keyof FusedEmotions)[]).reduce((best, k) =>
    e[k] > e[best] ? k : best
  )
}

/** Returns every day across the last `days` days, then we sample from them */
function generateDates(daysBack: number): Date[] {
  const dates: Date[] = []
  const now = new Date()
  now.setHours(12, 0, 0, 0) // noon to avoid timezone edge cases
  for (let i = daysBack; i >= 1; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(12, 0, 0, 0)
    dates.push(d)
  }
  return dates
}

/** Pick ~2–3 days per week spread across the pool */
function sampleDays(allDays: Date[], perWeek: number): Date[] {
  const weeks: Map<string, Date[]> = new Map()
  for (const d of allDays) {
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // ISO week start
    const key = monday.toISOString().split('T')[0]
    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key)!.push(d)
  }

  const chosen: Date[] = []
  for (const days of weeks.values()) {
    // Shuffle and take `perWeek` days from this week
    const shuffled = [...days].sort(() => Math.random() - 0.5)
    chosen.push(...shuffled.slice(0, perWeek))
  }
  return chosen.sort((a, b) => a.getTime() - b.getTime())
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected to MongoDB')

  // Clear existing entries for this user
  if (!DRY_RUN) {
    const deleted = await Entry.deleteMany({ userId: TARGET_USER_ID })
    console.log(`Cleared ${deleted.deletedCount} existing entries for ${TARGET_USER_ID}`)
  }

  const allDays = generateDates(91) // last ~13 weeks
  const days = sampleDays(allDays, 2)
  console.log(`Seeding ${days.length} entries across ${Math.round(allDays.length / 7)} weeks…`)

  let idx = 0
  for (const date of days) {
    const transcript = TRANSCRIPTS[idx % TRANSCRIPTS.length]
    const keywords   = KEYWORDS_POOL[idx % KEYWORDS_POOL.length]
    const emotionBeneath = EMOTION_BENEATH_POOL[idx % EMOTION_BENEATH_POOL.length]

    const fusedEmotions   = randomEmotions()
    const geminiEmotions  = emotionBias(fusedEmotions, pick(['joy', 'sadness', 'fear'] as const), 15)
    const humeVoiceEmotions = emotionBias(fusedEmotions, pick(['anger', 'surprise', 'sadness'] as const), 10)
    const humeFaceEmotions  = emotionBias(fusedEmotions, pick(['joy', 'disgust', 'fear'] as const), 12)
    const latestEmotions  = fusedEmotions

    const gradientColors = computeGradientColors(fusedEmotions)

    const dom1 = dominantKey(geminiEmotions)
    const dom2 = dominantKey(humeVoiceEmotions)
    const dom3 = dominantKey(humeFaceEmotions)
    const contradictionDetected = new Set([dom1, dom2, dom3]).size >= 2
    const contradictionMessage = contradictionDetected
      ? `Your words said ${dom1}. Your voice said ${dom2}. Your face said ${dom3}.`
      : ''

    // Vary recording count for some days (makes weighted average logic realistic)
    const recordingCount = Math.random() < 0.3 ? 2 : 1

    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)

    const entry = {
      userId: TARGET_USER_ID,
      transcript,
      keywords,
      emotionBeneath,
      fusedEmotions,
      latestEmotions,
      geminiEmotions,
      humeVoiceEmotions,
      humeFaceEmotions,
      gradientColors,
      contradictionDetected,
      contradictionMessage,
      recordingCount,
      createdAt: date,
      updatedAt: date,
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${date.toDateString()} — dominant: ${dominantKey(fusedEmotions)}, colors: ${gradientColors.join(', ')}`)
    } else {
      await Entry.create(entry)
      console.log(`  ✓ ${date.toDateString()} — ${dominantKey(fusedEmotions)} (${gradientColors[0]})`)
    }

    idx++
  }

  if (!DRY_RUN) {
    console.log(`\nSeeded ${days.length} entries for ${TARGET_USER_ID}`)
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
