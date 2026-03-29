import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
import mongoose from 'mongoose'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  const db = mongoose.connection.db!
  const users = await db.collection('users').find({}).limit(10).toArray()
  const entries = await db.collection('entries').find({}).limit(3).toArray()
  console.log('USERS:', JSON.stringify(users.map((u) => ({ clerkId: u.clerkId, email: u.email })), null, 2))
  console.log('SAMPLE ENTRY userId:', entries[0]?.userId)
  await mongoose.disconnect()
}

main().catch(console.error)
