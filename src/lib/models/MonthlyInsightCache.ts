import mongoose, { Schema, Document } from 'mongoose'

export interface IMonthlyInsightCache extends Document {
  userId:     string
  year:       number
  month:      number   // 0-indexed
  entryCount: number   // insight is stale when this no longer matches the real count
  insight:    string
  updatedAt:  Date
}

const MonthlyInsightCacheSchema = new Schema<IMonthlyInsightCache>(
  {
    userId:     { type: String, required: true },
    year:       { type: Number, required: true },
    month:      { type: Number, required: true },
    entryCount: { type: Number, required: true },
    insight:    { type: String, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
)

MonthlyInsightCacheSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true })

export default mongoose.models.MonthlyInsightCache ??
  mongoose.model<IMonthlyInsightCache>('MonthlyInsightCache', MonthlyInsightCacheSchema)
