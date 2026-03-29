import { auth } from '@clerk/nextjs/server'
import { put } from '@vercel/blob'
import type { NextRequest } from 'next/server'

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
  if (!(audio instanceof Blob)) {
    return Response.json({ error: 'Missing required field: audio (blob)' }, { status: 400 })
  }

  const type = audio.type || 'video/webm'
  const ext = type.includes('mp4') ? 'mp4' : 'webm'
  const filename = `recordings/${userId}/${Date.now()}.${ext}`

  const blob = await put(filename, audio, {
    access: 'private',
    contentType: type,
  })

  return Response.json({ url: blob.url }, { status: 201 })
}
