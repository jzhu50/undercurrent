import { auth } from '@clerk/nextjs/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Entry from '@/lib/models/Entry'
import MonthlyInsightCache from '@/lib/models/MonthlyInsightCache'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const year  = parseInt(searchParams.get('year')  ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10) // 0-indexed

  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
    return Response.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })
  }

  await connectToDatabase()

  const start = new Date(year, month, 1)
  const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)

  const entries = await Entry.find({
    userId,
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: 1 })
    .lean()

  if (entries.length === 0) {
    return Response.json({ insight: null })
  }

  // Return cached insight if entry count hasn't changed since last generation
  const cached = await MonthlyInsightCache.findOne({ userId, year, month }).lean()
  if (cached && cached.entryCount === entries.length) {
    return Response.json({ insight: cached.insight, entryCount: entries.length })
  }

  // Build a compact digest for Gemini — no raw transcripts, just signals
  const emotionLines = entries.map((e) => {
    const date = new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const dominant = e.fusedEmotions
      ? Object.entries(e.fusedEmotions as unknown as Record<string, number>)
          .sort(([, a], [, b]) => b - a)[0]?.[0]
      : null
    const kws = (e.keywords ?? []).join(', ')
    const beneath = e.emotionBeneath ?? ''
    return `- ${date}: dominant emotion = ${dominant ?? 'unknown'}${kws ? `, themes = ${kws}` : ''}${beneath ? `; "${beneath}"` : ''}`
  }).join('\n')

  const monthName = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prompt = `You are a warm, reflective journaling companion. Based on the following emotional snapshot of someone's ${monthName}, write a single paragraph of 2–3 sentences that captures the emotional arc of their month. Be specific, compassionate, and observational — name the feelings and themes you see. Do not give advice. Write in second person ("you"). Do not use the word "journey." Under 30 words total.

${emotionLines}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const insight = result.response.text().trim()

  // Upsert cache — overwrite stale entry if one exists
  await MonthlyInsightCache.findOneAndUpdate(
    { userId, year, month },
    { entryCount: entries.length, insight },
    { upsert: true },
  )

  return Response.json({ insight, entryCount: entries.length })
}
