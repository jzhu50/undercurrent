import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Entry from '@/lib/models/Entry'
import { computeGradientColors } from '@/lib/gradients'
import type { FusedEmotions } from '@/lib/models/Entry'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    presageScore,
    fusedEmotions,
    contradictionDetected,
    contradictionMessage,
    emotionBeneath,
  } = body as Record<string, unknown>

  const isFusedEmotions = (v: unknown): v is FusedEmotions =>
    typeof v === 'object' &&
    v !== null &&
    ['joy', 'anger', 'fear', 'sadness', 'disgust', 'surprise'].every(
      (k) => typeof (v as Record<string, unknown>)[k] === 'number',
    )

  const fused = isFusedEmotions(fusedEmotions) ? fusedEmotions : undefined
  const gradientColors = fused ? computeGradientColors(fused) : undefined

  const entry = await Entry.create({
    userId,
    audioUrl:              typeof audioUrl              === 'string'  ? audioUrl              : undefined,
    transcript:            typeof transcript            === 'string'  ? transcript            : undefined,
    emotions:              Array.isArray(emotions)                    ? emotions              : [],
    geminiInsight:         typeof geminiInsight         === 'string'  ? geminiInsight         : undefined,
    presageScore:          typeof presageScore          === 'number'  ? presageScore          : undefined,
    fusedEmotions:         fused,
    contradictionDetected: typeof contradictionDetected === 'boolean' ? contradictionDetected : undefined,
    contradictionMessage:  typeof contradictionMessage  === 'string'  ? contradictionMessage  : undefined,
    emotionBeneath:        typeof emotionBeneath        === 'string'  ? emotionBeneath        : undefined,
    gradientColors,
  })

  return Response.json({ data: entry }, { status: 201 })
}
