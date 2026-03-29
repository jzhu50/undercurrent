import { auth } from '@clerk/nextjs/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Entry from '@/lib/models/Entry'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  await connectToDatabase()

  const entry = await Entry.findOne({ _id: id, userId }).lean()
  if (!entry) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({ data: entry })
}

/** PATCH /api/entries/[id] — generate and save keywords for an entry */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  await connectToDatabase()

  const entry = await Entry.findOne({ _id: id, userId })
  if (!entry) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const transcript = entry.transcript ?? entry.emotionBeneath ?? ''
  if (!transcript) {
    return Response.json({ error: 'No transcript to summarize' }, { status: 422 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Read this journal transcript and respond with exactly 3 lowercase keywords (single words or short phrases, no punctuation) that capture the core themes, separated by commas. Nothing else.

Transcript:
${transcript}`

  const result = await model.generateContent(prompt)
  const keywords = result.response
    .text()
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3)

  entry.keywords = keywords
  await entry.save()

  return Response.json({ keywords })
}
