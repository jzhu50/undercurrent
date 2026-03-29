import { auth } from '@clerk/nextjs/server'
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
