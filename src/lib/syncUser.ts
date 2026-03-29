import { clerkClient } from '@clerk/nextjs/server'
import { connectToDatabase } from './mongodb'
import User from './models/User'

/**
 * Upserts the Clerk user into MongoDB.
 * Call this at the start of any authenticated API route so the User
 * document is always present regardless of whether the webhook fired.
 */
export async function syncUser(clerkId: string): Promise<void> {
  await connectToDatabase()

  // Skip if already in DB
  const existing = await User.exists({ clerkId })
  if (existing) return

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(clerkId)

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    clerkUser.externalAccounts.find((a) => a.emailAddress)?.emailAddress

  if (!primaryEmail) return

  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || undefined
  const displayName = clerkUser.username ?? fullName

  await User.findOneAndUpdate(
    { clerkId },
    { clerkId, email: primaryEmail, displayName },
    { upsert: true, new: true },
  )
}
