import { Webhook } from 'svix'
import type { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/lib/models/User'

interface ClerkEmailAddress {
  email_address: string
  id: string
}

interface ClerkExternalAccount {
  email_address?: string
  provider?: string
}

interface ClerkUserCreatedEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: {
    id: string
    email_addresses: ClerkEmailAddress[]
    external_accounts: ClerkExternalAccount[]
    primary_email_address_id: string
    first_name?: string
    last_name?: string
    username?: string
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'Missing env: CLERK_WEBHOOK_SECRET' }, { status: 500 })
  }

  const svixId        = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const payload = await request.text()
  const wh = new Webhook(secret)

  let event: ClerkUserCreatedEvent
  try {
    event = wh.verify(payload, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent
  } catch {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (event.type !== 'user.created') {
    return Response.json({ received: true })
  }

  const {
    id,
    email_addresses,
    external_accounts,
    primary_email_address_id,
    first_name,
    last_name,
    username,
  } = event.data

  // Google OAuth users have email in external_accounts, not email_addresses
  const emailFromAddresses =
    email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
    email_addresses[0]?.email_address

  const emailFromOAuth = external_accounts.find((a) => a.email_address)?.email_address

  const email = emailFromAddresses ?? emailFromOAuth

  if (!email) {
    return Response.json({ error: 'No email address found' }, { status: 400 })
  }

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || undefined
  const displayName = username ?? fullName

  await connectToDatabase()

  await User.findOneAndUpdate(
    { clerkId: id },
    { clerkId: id, email, displayName },
    { upsert: true, new: true },
  )

  return Response.json({ received: true })
}
