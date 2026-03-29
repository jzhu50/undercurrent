import { auth } from '@clerk/nextjs/server'
import { syncUser } from '@/lib/syncUser'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await syncUser(userId)

  return Response.json({ synced: true })
}
