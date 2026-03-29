import { auth } from '@clerk/nextjs/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { HumeClient } from 'hume'
import type { NextRequest } from 'next/server'

import {
  fuseEmotions,
  detectContradiction,
  type GeminiEmotions,
  type HumeVoiceEmotions,
  type HumeFaceEmotions,
  type PresageEmotions,
} from '@/lib/fusion'
import type { FusedEmotions } from '@/lib/models/Entry'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Used as a neutral stand-in when a signal is unavailable. */
const NEUTRAL_EMOTIONS: GeminiEmotions = {
  joy: 16.7,
  anger: 16.7,
  fear: 16.7,
  sadness: 16.7,
  disgust: 16.7,
  surprise: 16.5,
}

const HUME_EMOTION_MAP: Record<string, keyof GeminiEmotions> = {
  joy: 'joy',
  anger: 'anger',
  fear: 'fear',
  sadness: 'sadness',
  disgust: 'disgust',
  surprise: 'surprise',
  // Hume name variants
  'amusement': 'joy',
  'excitement': 'joy',
  'satisfaction': 'joy',
  'awe': 'surprise',
  'horror': 'fear',
  'anxiety': 'fear',
  'contempt': 'disgust',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps a flat array of Hume EmotionScore objects (score 0–1) to our 6-key
 * emotion shape (0–100). Unknown emotion names are accumulated into their
 * mapped bucket; anything unmapped is ignored.
 */
function mapHumeScores(
  scores: Array<{ name: string; score: number }>,
): GeminiEmotions {
  const out = { joy: 0, anger: 0, fear: 0, sadness: 0, disgust: 0, surprise: 0 }

  for (const { name, score } of scores) {
    const key = HUME_EMOTION_MAP[name.toLowerCase()]
    if (key) out[key] = Math.max(out[key], score * 100)
  }

  return out
}

/** Strips markdown code fences so JSON.parse can handle Gemini's raw response. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) return brace[0]
  return text.trim()
}

// ── Signal callers ────────────────────────────────────────────────────────────

async function getGeminiEmotions(transcript: string): Promise<GeminiEmotions> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing env: GEMINI_API_KEY')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Analyze the emotional content of the following journal entry transcript.
Return ONLY a valid JSON object with exactly these 6 keys: joy, anger, fear, sadness, disgust, surprise.
Each value must be a number from 0 to 100. All 6 values must sum to exactly 100.
Do not include any explanation, markdown, or extra text — only the JSON object.

Transcript:
${transcript}`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>

  return {
    joy:      Number(parsed.joy      ?? 0),
    anger:    Number(parsed.anger    ?? 0),
    fear:     Number(parsed.fear     ?? 0),
    sadness:  Number(parsed.sadness  ?? 0),
    disgust:  Number(parsed.disgust  ?? 0),
    surprise: Number(parsed.surprise ?? 0),
  }
}

async function getHumeVoiceEmotions(audio: Blob): Promise<HumeVoiceEmotions> {
  const apiKey = process.env.HUME_API_KEY
  if (!apiKey) throw new Error('Missing env: HUME_API_KEY')

  const client = new HumeClient({ apiKey })

  const job = await client.expressionMeasurement.batch.startInferenceJobFromLocalFile({
    file: [audio],
    json: { models: { prosody: {} } },
  })

  await job.awaitCompletion()

  const predictions = await client.expressionMeasurement.batch.getJobPredictions(job.jobId)

  const emotions =
    predictions[0]?.results?.predictions[0]?.models?.prosody
      ?.groupedPredictions[0]?.predictions[0]?.emotions ?? []

  return mapHumeScores(emotions)
}

async function getHumeFaceEmotions(
  frame: Blob | null,
): Promise<HumeFaceEmotions | null> {
  if (!frame) return null

  const apiKey = process.env.HUME_API_KEY
  if (!apiKey) throw new Error('Missing env: HUME_API_KEY')

  const client = new HumeClient({ apiKey })

  const job = await client.expressionMeasurement.batch.startInferenceJobFromLocalFile({
    file: [frame],
    json: { models: { face: {} } },
  })

  await job.awaitCompletion()

  const predictions = await client.expressionMeasurement.batch.getJobPredictions(job.jobId)

  const emotions =
    predictions[0]?.results?.predictions[0]?.models?.face
      ?.groupedPredictions[0]?.predictions[0]?.emotions ?? []

  return mapHumeScores(emotions)
}

/**
 * Presage REST integration — wraps in try/catch per spec so any failure
 * returns null rather than aborting the whole pipeline.
 *
 * Expected env vars: PRESAGE_API_URL, PRESAGE_API_KEY
 * Expected response: { joy, anger, fear, sadness, disgust, surprise } 0–100
 */
async function getPresageEmotions(audio: Blob): Promise<PresageEmotions | null> {
  const url = process.env.PRESAGE_API_URL
  const key = process.env.PRESAGE_API_KEY
  if (!url || !key) return null

  try {
    const body = new FormData()
    body.append('audio', audio, 'recording.webm')

    const res = await fetch(`${url}/v1/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body,
    })

    if (!res.ok) {
      console.warn(`Presage returned ${res.status} — skipping signal`)
      return null
    }

    const data = (await res.json()) as Record<string, unknown>

    return {
      joy:      Number(data.joy      ?? 0),
      anger:    Number(data.anger    ?? 0),
      fear:     Number(data.fear     ?? 0),
      sadness:  Number(data.sadness  ?? 0),
      disgust:  Number(data.disgust  ?? 0),
      surprise: Number(data.surprise ?? 0),
    }
  } catch (err) {
    console.warn('Presage signal failed gracefully:', err)
    return null
  }
}

async function getKeywords(transcript: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Read this journal transcript and respond with exactly 3 lowercase keywords (single words or short phrases, no punctuation) that capture the core themes, separated by commas. Nothing else.

Transcript:
${transcript}`

  const result = await model.generateContent(prompt)
  return result.response
    .text()
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3)
}

async function getEmotionBeneath(
  transcript: string,
  fused: FusedEmotions,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return ''

  const dominantKey = (Object.keys(fused) as Array<keyof FusedEmotions>).reduce(
    (best, k) => (fused[k] > fused[best] ? k : best),
  )

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a compassionate emotional insight guide. Based on this journal entry and its dominant emotional signal (${dominantKey}), write 1–2 plain sentences that gently name what might be driving the emotion beneath the surface. Use simple, direct language — no jargon, no clinical terms, no labels. Write as if speaking to a trusted friend.

Transcript:
${transcript}`

  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const audio = formData.get('audio')
  const transcript = formData.get('transcript')
  const videoFrame = formData.get('videoFrame')

  if (!(audio instanceof Blob)) {
    return Response.json({ error: 'Missing required field: audio (blob)' }, { status: 400 })
  }
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    return Response.json({ error: 'Missing required field: transcript (string)' }, { status: 400 })
  }

  const frameBlob = videoFrame instanceof Blob ? videoFrame : null

  // Run all 4 signals in parallel — one failure must not crash the pipeline
  const [geminiResult, humeVoiceResult, humeFaceResult, presageResult] =
    await Promise.allSettled([
      getGeminiEmotions(transcript),
      getHumeVoiceEmotions(audio),
      getHumeFaceEmotions(frameBlob),
      getPresageEmotions(audio),
    ])

  if (geminiResult.status === 'rejected') {
    console.error('Gemini signal failed:', geminiResult.reason)
  }
  if (humeVoiceResult.status === 'rejected') {
    console.error('Hume voice signal failed:', humeVoiceResult.reason)
  }
  if (humeFaceResult.status === 'rejected') {
    console.error('Hume face signal failed:', humeFaceResult.reason)
  }

  const gemini    = geminiResult.status    === 'fulfilled' ? geminiResult.value    : NEUTRAL_EMOTIONS
  const humeVoice = humeVoiceResult.status === 'fulfilled' ? humeVoiceResult.value : NEUTRAL_EMOTIONS
  // humeFace is null when no frame was provided OR when the signal failed
  const humeFaceRaw = humeFaceResult.status === 'fulfilled' ? humeFaceResult.value : null
  const humeFace    = humeFaceRaw ?? NEUTRAL_EMOTIONS
  const presage   = presageResult.status   === 'fulfilled' ? presageResult.value   : null

  const fusedEmotions = fuseEmotions(gemini, humeVoice, humeFace, presage)
  const { detected, message } = detectContradiction(gemini, humeVoice, humeFace, presage)

  const [emotionBeneath, keywords] = await Promise.all([
    getEmotionBeneath(transcript, fusedEmotions),
    getKeywords(transcript),
  ])

  return Response.json({
    fusedEmotions,
    contradictionDetected: detected,
    contradictionMessage: message,
    emotionBeneath,
    keywords,
  })
}
