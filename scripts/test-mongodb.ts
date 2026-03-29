import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'

config({ path: resolve(process.cwd(), '.env.local') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI is not set in .env.local')
  process.exit(1)
}

async function main() {
  console.log('Connecting to MongoDB...')
  try {
    await mongoose.connect(uri!, { serverSelectionTimeoutMS: 8000, bufferCommands: false })
    const db = mongoose.connection.db!
    const { host, port } = mongoose.connection
    const adminDb = db.admin()
    const info = await adminDb.serverInfo()
    console.log('✓ Connected successfully')
    console.log(`  Host:            ${host}:${port}`)
    console.log(`  MongoDB version: ${info.version}`)
    console.log(`  Database:        ${db.databaseName}`)
    const collections = await db.listCollections().toArray()
    console.log(`  Collections:     ${collections.length === 0 ? '(none yet)' : collections.map(c => c.name).join(', ')}`)
  } catch (err) {
    console.error('✗ Connection failed')
    console.error(' ', (err as Error).message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
