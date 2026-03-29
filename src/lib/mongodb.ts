import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Missing environment variable: MONGODB_URI')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

// Reuse connection across hot-reloads in development
const globalWithMongoose = global as typeof globalThis & { mongoose?: MongooseCache }

const cache: MongooseCache = globalWithMongoose.mongoose ?? { conn: null, promise: null }
globalWithMongoose.mongoose = cache

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
    })
  }

  cache.conn = await cache.promise
  return cache.conn
}
