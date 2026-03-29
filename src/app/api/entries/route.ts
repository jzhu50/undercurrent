import { auth } from '@clerk/nextjs/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Entry from '@/lib/models/Entry'
import { computeGradientColors } from '@/lib/gradients'
import type { FusedEmotions } from '@/lib/models/Entry'
import { syncUser } from '@/lib/syncUser'

async function generateKeywords(transcript: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !transcript.trim()) return []
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(
    `Read this journal transcript and respond with exactly 3 lowercase keywords (single words or short phrases, no punctuation) that capture the core themes, separated by commas. Nothing else.\n\nTranscript:\n${transcript}`,
  )
  return result.response
    .text()
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3)
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await syncUser(userId).catch(() => {})
  await connectToDatabase()

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))
  const skip = (page - 1) * limit

  const [entries, total] = await Promise.all([
    Entry.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Entry.countDocuments({ userId }),
  ])

  return Response.json({
    data: entries,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await syncUser(userId).catch(() => {})

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Request body must be an object' }, { status: 400 })
  }

  await connectToDatabase()

  const {
    audioUrl,
    transcript,
    emotions,
    geminiInsight,
    fusedEmotions,
    geminiEmotions,
    humeVoiceEmotions,
    humeFaceEmotions,
    contradictionDetected,
    contradictionMessage,
    emotionBeneath,
    keywords,
  } = body as Record<string, unknown>

  const isFusedEmotions = (v: unknown): v is FusedEmotions =>
    typeof v === 'object' &&
    v !== null &&
    ['joy', 'anger', 'fear', 'sadness', 'disgust', 'surprise'].every(
      (k) => typeof (v as Record<string, unknown>)[k] === 'number',
    )

  const newFused = isFusedEmotions(fusedEmotions) ? fusedEmotions : undefined

  // One entry per user per calendar day
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date()
  dayEnd.setHours(23, 59, 59, 999)

  const existing = await Entry.findOne({ userId, createdAt: { $gte: dayStart, $lte: dayEnd } }).lean()

  // Always use the latest transcript
  const mergedTranscript = typeof transcript === 'string' && transcript.trim()
    ? transcript.trim()
    : typeof existing?.transcript === 'string' ? existing.transcript : undefined

  // Merge fusedEmotions — true running weighted average using recordingCount
  const EMOTION_KEYS: (keyof FusedEmotions)[] = ['joy', 'anger', 'fear', 'sadness', 'disgust', 'surprise']
  const oldCount = typeof existing?.recordingCount === 'number' ? existing.recordingCount : (existing ? 1 : 0)
  const newCount = oldCount + 1

  const mergedFused: FusedEmotions | undefined = (() => {
    const oldFused = isFusedEmotions(existing?.fusedEmotions) ? existing!.fusedEmotions as unknown as FusedEmotions : undefined
    if (!newFused && !oldFused) return undefined
    if (!newFused) return oldFused
    if (!oldFused) return newFused
    // Weighted average: each recording contributes equally regardless of merge order
    return Object.fromEntries(
      EMOTION_KEYS.map((k) => [k, (oldFused[k] * oldCount + newFused[k]) / newCount])
    ) as unknown as FusedEmotions
  })()

  const gradientColors = mergedFused ? computeGradientColors(mergedFused) : undefined

  // Generate keywords if not provided by the analyze pipeline
  const resolvedKeywords: string[] =
    Array.isArray(keywords) && keywords.length > 0
      ? (keywords as string[])
      : mergedTranscript
        ? await generateKeywords(mergedTranscript).catch(() => [])
        : []

  const update = {
    ...(mergedTranscript                           && { transcript: mergedTranscript }),
    ...(typeof audioUrl              === 'string'  && { audioUrl }),
    ...(Array.isArray(emotions)                    && { emotions }),
    ...(typeof geminiInsight         === 'string'  && { geminiInsight }),
    ...(newFused                                   && { latestEmotions: newFused }),
    ...(mergedFused                                && { fusedEmotions: mergedFused }),
    ...(isFusedEmotions(geminiEmotions)            && { geminiEmotions }),
    ...(isFusedEmotions(humeVoiceEmotions)         && { humeVoiceEmotions }),
    ...(isFusedEmotions(humeFaceEmotions)          && { humeFaceEmotions }),
    ...(typeof contradictionDetected === 'boolean' && { contradictionDetected }),
    ...(typeof contradictionMessage  === 'string'  && { contradictionMessage }),
    ...(typeof emotionBeneath        === 'string'  && { emotionBeneath }),
    ...(resolvedKeywords.length > 0 && { keywords: resolvedKeywords }),
    ...(gradientColors                             && { gradientColors }),
    recordingCount: newCount,
  }

  const entry = await Entry.findOneAndUpdate(
    { userId, createdAt: { $gte: dayStart, $lte: dayEnd } },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  return Response.json({ data: entry }, { status: 201 })
}
