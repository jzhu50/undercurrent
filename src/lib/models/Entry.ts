import mongoose, { Schema, Document, Model } from 'mongoose'

export interface EmotionScore {
  label: string
  score: number
}

export interface FusedEmotions {
  joy: number
  anger: number
  fear: number
  sadness: number
  disgust: number
  surprise: number
}

export interface IEntry extends Document {
  userId: string             // Clerk user ID
  audioUrl?: string          // ElevenLabs / stored recording URL
  transcript?: string        // Whisper / transcription output
  // Raw signal data
  emotions?: EmotionScore[]  // Hume Expression API results
  geminiInsight?: string     // Gemini analysis text
  presageScore?: number      // Presage wellness metric
  // Per-signal emotion breakdowns (each mirrors FusedEmotions shape, 0–100)
  geminiEmotions?: FusedEmotions
  humeVoiceEmotions?: FusedEmotions
  humeFaceEmotions?: FusedEmotions
  // Processed outputs
  fusedEmotions?: FusedEmotions          // Weighted blend of all signals (0–100 per dimension)
  contradictionDetected?: boolean        // True when signals disagreed past threshold
  contradictionMessage?: string          // e.g. 'Your words said calm. Your voice said fear.'
  emotionBeneath?: string                // Gemini's hidden driver insight
  keywords?: string[]                    // 3 AI-summarized keywords for the entry
  gradientColors?: string[]              // Precomputed hex codes for the entry gradient
  recordingCount?: number                // How many recordings have been merged into this entry
  createdAt: Date
  updatedAt: Date
}

const EmotionScoreSchema = new Schema<EmotionScore>(
  {
    label: { type: String, required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
)

const FusedEmotionsSchema = new Schema<FusedEmotions>(
  {
    joy:      { type: Number, required: true },
    anger:    { type: Number, required: true },
    fear:     { type: Number, required: true },
    sadness:  { type: Number, required: true },
    disgust:  { type: Number, required: true },
    surprise: { type: Number, required: true },
  },
  { _id: false }
)

const EntrySchema = new Schema<IEntry>(
  {
    userId: { type: String, required: true, index: true },
    audioUrl: { type: String },
    transcript: { type: String },
    // Raw signal data
    emotions: { type: [EmotionScoreSchema], default: [] },
    geminiInsight: { type: String },
    presageScore: { type: Number },
    geminiEmotions:    { type: FusedEmotionsSchema },
    humeVoiceEmotions: { type: FusedEmotionsSchema },
    humeFaceEmotions:  { type: FusedEmotionsSchema },
    // Processed outputs
    fusedEmotions: { type: FusedEmotionsSchema },
    contradictionDetected: { type: Boolean },
    contradictionMessage: { type: String },
    emotionBeneath: { type: String },
    keywords: { type: [String] },
    gradientColors: { type: [String] },
    recordingCount: { type: Number, default: 1 },
  },
  { timestamps: true }
)

const Entry: Model<IEntry> =
  mongoose.models.Entry ?? mongoose.model<IEntry>('Entry', EntrySchema)

export default Entry
