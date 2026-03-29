# undercurrent

> *record your unseen emotions.*

Undercurrent is an emotional journaling web app that captures video recordings and uses multi-signal AI analysis to surface the emotions beneath the surface — including ones you may not have named yourself.

## What it does

1. **Record** — webcam + mic captures your journal entry with live speech-to-text captions
2. **Analyze** — four AI signals run in parallel:
   - **Gemini** reads the transcript for semantic emotion content
   - **Hume Voice** reads prosody and tone from the audio
   - **Hume Face** reads facial expressions from a captured frame
3. **Fuse** — signals are weighted and blended into a single emotion profile
4. **Surface** — a gradient visualization, a "emotion beneath" insight, and a contradiction alert (when your words say one thing and your voice says another) are shown on the results page
5. **Persist** — entries are saved to MongoDB with the full signal breakdown, viewable later in the insights page and calendar

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Auth | Clerk v7 |
| Database | MongoDB Atlas + Mongoose |
| AI / NLP | Gemini 2.5 Flash |
| Voice emotion | Hume Expression Measurement API |
| Transcription | ElevenLabs Scribe v2 |
| Video storage | Vercel Blob |
| Webhook verification | Svix |

## Project structure

```
src/
├── app/
│   ├── record/          # Webcam recording + live captions
│   ├── results/         # Live results while pipeline runs
│   ├── entries/         # Entry list + individual insights page
│   ├── calendar/        # Emotion calendar view
│   ├── calibrate/       # Onboarding / emotion color calibration
│   ├── colors/          # Color preference settings
│   ├── sign-in/         # Custom Clerk sign-in page
│   └── sign-up/         # Custom Clerk sign-up page
│   └── api/
│       ├── analyze/     # Core fusion pipeline (4 signals → fused emotions)
│       ├── transcribe/  # ElevenLabs speech-to-text
│       ├── upload/      # Vercel Blob audio upload
│       ├── entries/     # CRUD for journal entries
│       ├── user/        # Clerk → MongoDB user sync
│       └── webhooks/    # Clerk webhook handler
├── lib/
│   ├── fusion.ts        # fuseEmotions(), detectContradiction()
│   ├── gradients.ts     # computeGradientColors()
│   ├── recordingStore.ts # In-memory pipeline state (record → results)
│   ├── mongodb.ts       # Mongoose connection with hot-reload cache
│   └── models/          # User, Entry Mongoose schemas
└── components/
    └── NavBar.tsx
```

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Create `.env.local`:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/record
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/calibrate
CLERK_WEBHOOK_SECRET=

# MongoDB
MONGODB_URI=

# Gemini
GEMINI_API_KEY=

# Hume
HUME_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Presage (optional)
PRESAGE_API_URL=
PRESAGE_API_KEY=
```

### 3. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key design decisions

**Multi-signal fusion** — No single AI signal is reliable on its own. Gemini reads meaning but misses tone; Hume reads tone but misses context. The weighted blend (Gemini 55%, Hume voice 25%, Hume face 10%, Presage 10%) produces a more honest read than any one model alone.

**Session ID guard** — The results page subscribes to a module-level store. A session counter ensures that if a user hits "record more" quickly, the previous recording's in-flight pipeline can't overwrite the new recording's state.

**Immediate navigation** — The user is sent to `/results` before the pipeline finishes, so there's no waiting on the record page. The results page shows a loading state and updates live as signals complete.
