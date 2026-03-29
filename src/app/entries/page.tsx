'use client'

import '@fontsource/eb-garamond'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import { computeGradientColors } from '@/lib/gradients'
import type { FusedEmotions } from '@/lib/models/Entry'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntryData {
  _id: string
  createdAt: string
  emotionBeneath?: string
  fusedEmotions?: Record<string, number>
  gradientColors?: string[]
  keywords?: string[]
}

// ── Nav ───────────────────────────────────────────────────────────────────────


// ── Gradient circle ───────────────────────────────────────────────────────────

function GradientCircle({ colors, size = 'md' }: { colors: string[]; size?: 'sm' | 'md' }) {
  const [c1, c2, c3] = colors
  const bg = c2
    ? `linear-gradient(to bottom, ${c1} 0%, ${c2} 50%, ${c3 ?? c2} 100%)`
    : c1 ?? '#e0e0e0'
  const dim = size === 'sm' ? 'w-[54px] h-[54px]' : 'h-full aspect-square'
  return (
    <div
      className={`${dim} rounded-full flex-shrink-0 shadow-[2px_2px_5px_rgba(0,0,0,0.25)]`}
      style={{ background: bg }}
    />
  )
}

// ── Entry card (recents) ──────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: EntryData }) {
  const date = new Date(entry.createdAt)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    .toLowerCase()

  const subtitle = entry.keywords && entry.keywords.length > 0
    ? entry.keywords.join('  ·  ')
    : ''

  return (
    <Link
      href={`/entries/${entry._id}`}
      className="bg-white border border-[#bebebe] flex gap-11 items-center overflow-hidden px-7 py-8 rounded-3xl shadow-[2px_2px_5px_rgba(0,0,0,0.25)] w-full hover:shadow-md transition-shadow"
    >
      <div className="h-16 flex items-center">
        {entry.gradientColors && entry.gradientColors.length > 0 ? (
          <GradientCircle colors={entry.gradientColors} />
        ) : (
          <div className="h-full aspect-square rounded-full bg-zinc-100 shadow-[2px_2px_5px_rgba(0,0,0,0.25)]" />
        )}
      </div>
      <div className="flex flex-col gap-3.5 min-w-0">
        <p className="text-black text-[32px]" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
          {date}
        </p>
        {subtitle && (
          <p className="text-[#7f7f7f] text-[14px] italic truncate" style={{ fontFamily: '"DM Mono", monospace' }}>
            {subtitle}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const EMOTION_KEYS: (keyof FusedEmotions)[] = ['joy', 'anger', 'fear', 'sadness', 'disgust', 'surprise']

/** Average fusedEmotions across multiple entries and derive a blended gradient. */
function mergedGradient(dayEntries: EntryData[]): string[] | null {
  const withEmotions = dayEntries.filter((e) => e.fusedEmotions)
  if (withEmotions.length === 0) {
    // Fall back to gradientColors of most recent entry
    return dayEntries[0]?.gradientColors ?? null
  }
  const averaged = Object.fromEntries(
    EMOTION_KEYS.map((k) => [
      k,
      withEmotions.reduce((sum, e) => sum + (e.fusedEmotions![k] ?? 0), 0) / withEmotions.length,
    ]),
  ) as unknown as FusedEmotions
  return computeGradientColors(averaged)
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function Calendar({ entries }: { entries: EntryData[] }) {
  const now = new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const year  = viewYear
  const month = viewMonth

  function prevMonth() {
    if (month === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()

  // Collect ALL entries per day (sorted most-recent-first already from API)
  const entriesByDay = new Map<number, EntryData[]>()
  for (const e of entries) {
    const d = new Date(e.createdAt)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!entriesByDay.has(day)) entriesByDay.set(day, [])
      entriesByDay.get(day)!.push(e)
    }
  }

  // Build grid: null = empty cell
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = new Date(year, month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toLowerCase()

  return (
    <div className="flex flex-col gap-6">
      {/* Month navigation header */}
      <div className="flex items-center gap-4 justify-center">
        <button
          onClick={prevMonth}
          className="text-[#7f7f7f] text-[32px] leading-none hover:text-black transition-colors px-1"
          style={{ fontFamily: '"DM Mono", monospace' }}
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-black text-[28px] leading-[36px] min-w-[220px] text-center" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
          {monthLabel}
        </p>
        <button
          onClick={nextMonth}
          className="text-[#7f7f7f] text-[32px] leading-none hover:text-black transition-colors px-1"
          style={{ fontFamily: '"DM Mono", monospace' }}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-3.5">
        {/* Day-of-week header */}
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="w-[54px] h-[54px] flex items-center justify-center">
            <span className="text-black text-[20px]" style={{ fontFamily: '"DM Mono", monospace' }}>{l}</span>
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="w-[54px] h-[54px]" />

          const dayEntries = entriesByDay.get(day)
          if (dayEntries && dayEntries.length > 0) {
            const colors = mergedGradient(dayEntries)
            const href = `/entries/${dayEntries[0]._id}`
            return colors ? (
              <Link key={i} href={href}>
                <GradientCircle colors={colors} size="sm" />
              </Link>
            ) : (
              <Link key={i} href={href}>
                <div className="w-[54px] h-[54px] rounded-full bg-zinc-200 shadow-[2px_2px_5px_rgba(0,0,0,0.15)]" />
              </Link>
            )
          }

          return (
            <div
              key={i}
              className="w-[54px] h-[54px] rounded-full bg-[rgba(190,190,190,0.15)] flex items-center justify-center"
            >
              <span
                className="text-[20px] text-[rgba(127,127,127,0.5)]"
                style={{ fontFamily: '"DM Mono", monospace' }}
              >
                {day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [entries, setEntries]   = useState<EntryData[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/entries?limit=50')
      .then((r) => r.json())
      .then(({ data }: { data?: EntryData[] }) => setEntries(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const recents = entries.slice(0, 3)

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ backgroundImage: 'url(/paper-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/75" />
      <NavBar />

      <div className="relative z-10 w-full max-w-[1035px] mx-auto px-8 flex flex-col gap-14">
        {/* Title */}
        <p className="text-black text-[48px] leading-[60px]" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
          history
        </p>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-[#63d7ba] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-15 items-start">
            {/* Recents */}
            <div className="flex flex-col gap-6 w-[496px] flex-shrink-0">
              <p className="text-[#7f7f7f] text-[20px]" style={{ fontFamily: '"DM Mono", monospace' }}>
                RECENTS
              </p>
              {recents.length === 0 ? (
                <p className="text-zinc-300 text-[18px] italic" style={{ fontFamily: '"DM Mono", monospace' }}>
                  no entries yet
                </p>
              ) : (
                recents.map((e) => <EntryCard key={e._id} entry={e} />)
              )}
            </div>

            {/* Calendar */}
            <div className="flex-1 min-w-0">
              <Calendar entries={entries} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
