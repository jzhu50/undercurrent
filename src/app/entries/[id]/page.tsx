'use client'

import '@fontsource/eb-garamond'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { computeGradientColors, computeGradientStops, loadEmotionColors, EMOTION_DEFAULTS } from '@/lib/gradients'
import type { FusedEmotions } from '@/lib/models/Entry'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntryData {
  _id: string
  createdAt: string
  transcript?: string
  emotionBeneath?: string
  contradictionDetected?: boolean
  contradictionMessage?: string
  gradientColors?: string[]
  latestEmotions?: Record<string, number>
  fusedEmotions?: Record<string, number>
  geminiEmotions?: Record<string, number>
  humeVoiceEmotions?: Record<string, number>
  humeFaceEmotions?: Record<string, number>
  keywords?: string[]
}

// ── Gradient circle ───────────────────────────────────────────────────────────

function GradientCircle({ colors, stops }: { colors: string[]; stops?: number[] }) {
  const top3 = colors.slice(0, 3)
  const [c1, c2, c3] = top3
  const [s1, s2, s3] = stops ?? [0, 50, 100]
  const bg = c2
    ? `linear-gradient(to bottom, ${c1} ${s1}%, ${c2} ${s2}%, ${c3 ?? c2} ${s3 ?? 100}%)`
    : c1 ?? '#e0e0e0'
  return (
    <div
      className="w-32 h-32 rounded-full flex-shrink-0 shadow-[2px_2px_5px_rgba(0,0,0,0.25)]"
      style={{ background: bg }}
    />
  )
}

// ── Transcript card ───────────────────────────────────────────────────────────

function TranscriptCard({ transcript }: { transcript?: string }) {
  if (!transcript) {
    return (
      <div className="flex-1 bg-white border border-[rgba(127,127,127,0.5)] rounded-3xl shadow-[2px_2px_5px_rgba(0,0,0,0.25)] px-7 py-12 overflow-y-auto" style={{ height: 526 }}>
        <p className="text-zinc-300 text-[16px] italic" style={{ fontFamily: '"DM Mono", monospace' }}>
          no transcript available
        </p>
      </div>
    )
  }

  // Split into rough ~30-word segments for display
  const words = transcript.split(/\s+/)
  const segmentSize = 30
  const segments: string[] = []
  for (let i = 0; i < words.length; i += segmentSize) {
    segments.push(words.slice(i, i + segmentSize).join(' '))
  }

  return (
    <div
      className="flex-1 bg-white border border-[rgba(127,127,127,0.5)] rounded-3xl shadow-[2px_2px_5px_rgba(0,0,0,0.25)] px-7 py-12 overflow-y-auto flex flex-col gap-9"
      style={{ height: 526, fontFamily: '"DM Mono", monospace' }}
    >
      {segments.map((seg, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <p className="text-black text-[16px]">
            {`${Math.floor((i * segmentSize) / 150)}:${String(Math.round(((i * segmentSize) % 150) * 0.4)).padStart(2, '0')}`}
          </p>
          <p className="text-[#7f7f7f] text-[16px] italic">{seg}</p>
        </div>
      ))}
    </div>
  )
}

// ── Signal source helper ──────────────────────────────────────────────────────

function topEmotion(emotions?: Record<string, number>): string | null {
  if (!emotions) return null
  const sorted = Object.entries(emotions).sort(([, a], [, b]) => b - a)
  return sorted[0]?.[0] ?? null
}

// ── Insights card ─────────
// ────────────────────────────────────────────────────

function InsightsCard({
  emotionBeneath,
  contradictionDetected,
  contradictionMessage,
  latestEmotions,
  fusedEmotions,
  geminiEmotions,
  humeVoiceEmotions,
  humeFaceEmotions,
}: Pick<EntryData, 'emotionBeneath' | 'contradictionDetected' | 'contradictionMessage' | 'latestEmotions' | 'fusedEmotions' | 'geminiEmotions' | 'humeVoiceEmotions' | 'humeFaceEmotions'>) {
  const saved = loadEmotionColors()
  const topKey = fusedEmotions
    ? Object.entries(fusedEmotions).sort(([, a], [, b]) => b - a)[0]?.[0]
    : undefined

  return (
    <div
      className="flex-1 bg-white border border-[rgba(127,127,127,0.5)] rounded-3xl shadow-[2px_2px_5px_rgba(0,0,0,0.25)] px-7 py-12 overflow-y-auto flex flex-col gap-8"
      style={{ height: 526 }}
    >
      {emotionBeneath ? (
        <p className="text-black text-[24px] leading-[40px]" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
          {emotionBeneath}
        </p>
      ) : (
        <p className="text-zinc-300 text-[16px] italic" style={{ fontFamily: '"DM Mono", monospace' }}>
          no insights available
        </p>
      )}

      {/* Per-signal breakdown */}
      {(geminiEmotions || humeVoiceEmotions || humeFaceEmotions) && (
        <div className="flex flex-col gap-2" style={{ fontFamily: '"DM Mono", monospace' }}>
          {[
            { label: 'your words said', emotions: geminiEmotions },
            { label: 'your voice said', emotions: humeVoiceEmotions },
            { label: 'your face said',  emotions: humeFaceEmotions },
          ].map(({ label, emotions }) => {
            const top = topEmotion(emotions)
            if (!top) return null
            const color = saved[top] ?? EMOTION_DEFAULTS[top] ?? '#a8abfc'
            return (
              <div key={label} className="flex items-center gap-3 text-[16px]">
                <span className="text-[#7f7f7f] whitespace-nowrap">{label}:</span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-black">{top}</span>
              </div>
            )
          })}
        </div>
      )}

      {(latestEmotions ?? fusedEmotions) && (
        <div className="flex flex-col gap-3 mt-auto">
          {Object.entries(latestEmotions ?? fusedEmotions!)
            .sort(([, a], [, b]) => b - a)
            .map(([k, v]) => {
              const barColor = saved[k] ?? EMOTION_DEFAULTS[k] ?? '#63d7ba'
              return (
                <div key={k} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[16px] text-zinc-400" style={{ fontFamily: '"DM Mono", monospace' }}>
                    <span>{k}</span><span>{v.toFixed(0)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${v}%`, background: barColor }} />
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EntryInsightsPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [entry, setEntry]         = useState<EntryData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [userColors, setUserColors] = useState<Record<string, string>>({})

  useEffect(() => { setUserColors(loadEmotionColors()) }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/entries/${id}`)
      .then((r) => r.json())
      .then(({ data, error: e }: { data?: EntryData; error?: string }) => {
        if (e) { setError(e); return }
        setEntry(data ?? null)
      })
      .catch(() => setError('Failed to load entry.'))
      .finally(() => setLoading(false))
  }, [id])

  const today = entry
    ? new Date(entry.createdAt)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        .toLowerCase()
    : ''

  const subtitle = entry?.keywords && entry.keywords.length > 0
    ? entry.keywords.join('  ·  ')
    : ''

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ backgroundImage: 'url(/paper-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/75" />
      <NavBar activeOverride="history" />

      <div className="relative z-10 w-full max-w-[1035px] mx-auto px-8 py-16 flex flex-col gap-14">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#63d7ba] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 h-64 justify-center">
            <p className="text-zinc-400 text-sm" style={{ fontFamily: '"DM Mono", monospace' }}>{error}</p>
            <button
              onClick={() => router.back()}
              className="text-zinc-500 underline text-sm"
              style={{ fontFamily: '"DM Mono", monospace' }}
            >
              go back
            </button>
          </div>
        )}

        {!loading && entry && (
          <>
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-7">
                {/* Back link */}
                <button
                  onClick={() => router.back()}
                  className="text-[#7f7f7f] text-[20px] text-left"
                  style={{ fontFamily: '"DM Mono", monospace' }}
                >
                  {'← '}<span className="underline">BACK</span>
                </button>

                {/* Date + subtitle */}
                <div className="flex flex-col gap-2">
                  <p className="text-black text-[48px] leading-[60px]" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
                    {today}
                  </p>
                  {subtitle && (
                    <p className="text-[#7f7f7f] text-[16px] italic" style={{ fontFamily: '"DM Mono", monospace' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Gradient circle — computed from fusedEmotions using user's custom colors */}
              {(entry.fusedEmotions || entry.gradientColors) && (() => {
                const fused  = entry.fusedEmotions as unknown as FusedEmotions | undefined
                const colors = fused
                  ? computeGradientColors(fused, userColors)
                  : entry.gradientColors!
                const stops  = fused ? computeGradientStops(fused) : undefined
                return <GradientCircle colors={colors} stops={stops} />
              })()}
            </div>

            {/* Cards row */}
            <div className="flex gap-9 items-start">
              <TranscriptCard transcript={entry.transcript} />
              <InsightsCard
                emotionBeneath={entry.emotionBeneath}
                contradictionDetected={entry.contradictionDetected}
                contradictionMessage={entry.contradictionMessage}
                latestEmotions={entry.latestEmotions}
                fusedEmotions={entry.fusedEmotions}
                geminiEmotions={entry.geminiEmotions}
                humeVoiceEmotions={entry.humeVoiceEmotions}
                humeFaceEmotions={entry.humeFaceEmotions}
              />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
