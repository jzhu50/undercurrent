'use client'

import '@fontsource/eb-garamond'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  getRecordingResult,
  subscribeRecordingResult,
  type RecordingResult,
} from '@/lib/recordingStore'

// ── Nav ───────────────────────────────────────────────────────────────────────

function NavBar() {
  const pathname = usePathname()
  const links = [
    { href: '/record',  label: 'record' },
    { href: '/entries', label: 'history' },
    { href: '/colors',  label: 'colors' },
  ]
  return (
    <nav
      className="fixed left-7 top-1/2 -translate-y-1/2 flex flex-col gap-12 px-4 py-12 rounded-full overflow-hidden"
      style={{ fontFamily: '"DM Mono", monospace' }}
    >
      {links.map(({ href, label }) => {
        const active = pathname === '/results' ? href === '/record' : pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 text-[20px] whitespace-nowrap transition-colors ${active ? 'text-black' : 'text-[#7f7f7f] hover:text-zinc-500'}`}
          >
            {active && <span className="w-2 h-2 rounded-full bg-black flex-shrink-0" />}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

// ── Gradient circle ───────────────────────────────────────────────────────────

function GradientCircle({ colors }: { colors: string[] }) {
  const [c1, c2, c3] = colors
  const bg = c2
    ? `linear-gradient(to bottom, ${c1} 0%, ${c2} 50%, ${c3 ?? c2} 100%)`
    : c1 ?? '#e0e0e0'
  return (
    <div
      className="w-60 h-60 rounded-full shadow-[2px_2px_5px_rgba(0,0,0,0.25)]"
      style={{ background: bg }}
    />
  )
}

function LoadingCircle() {
  return (
    <div className="w-60 h-60 rounded-full shadow-[2px_2px_5px_rgba(0,0,0,0.25)] animate-pulse"
      style={{ background: 'linear-gradient(to bottom, #f3e8ff 0%, #e0f2fe 100%)' }}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter()
  const [result, setResult] = useState<RecordingResult>(getRecordingResult)

  // Subscribe to store updates while the pipeline runs on the record page
  useEffect(() => {
    const unsub = subscribeRecordingResult(() => {
      setResult(getRecordingResult())
    })
    // Sync once immediately in case it already finished
    setResult(getRecordingResult())
    return unsub
  }, [])

  const today = new Date()
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    .toLowerCase()

  const isProcessing = result.status === 'processing'
  const isError      = result.status === 'error'

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ backgroundImage: 'url(/paper-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/75" />
      <NavBar />

      <div className="relative z-10 flex flex-col items-center gap-16">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[#7f7f7f] text-[18px]" style={{ fontFamily: '"DM Mono", monospace' }}>
            {today}
          </p>
          <p className="text-black text-[48px] leading-[60px]" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
            today, i feel...
          </p>
        </div>

        {/* Gradient circle */}
        {isProcessing && <LoadingCircle />}
        {!isProcessing && !isError && result.gradientColors && (
          <GradientCircle colors={result.gradientColors} />
        )}
        {isError && (
          <div className="w-60 h-60 rounded-full flex items-center justify-center bg-zinc-100">
            <p className="text-zinc-400 text-xs text-center px-6" style={{ fontFamily: '"DM Mono", monospace' }}>
              {result.error ?? 'something went wrong'}
            </p>
          </div>
        )}

        {/* Status hint while loading */}
        {isProcessing && (
          <p className="text-zinc-400 text-[16px]" style={{ fontFamily: '"DM Mono", monospace' }}>
            analyzing your emotions…
          </p>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-6 items-center">
          <button
            onClick={() => result.entryId ? router.push(`/entries/${result.entryId}`) : undefined}
            disabled={!result.entryId}
            className="w-[360px] bg-white border border-[rgba(127,127,127,0.5)] rounded-full py-3 flex items-center justify-center text-black text-[20px] shadow-[2px_2px_5px_rgba(0,0,0,0.25)] transition hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: '"EB Garamond", Garamond, serif' }}
          >
            {result.entryId ? 'view insights' : isProcessing ? 'saving…' : 'saving…'}
          </button>

          <button
            onClick={() => router.push('/record')}
            className="w-[360px] bg-white border border-[rgba(127,127,127,0.5)] rounded-full py-3 flex items-center justify-center text-black text-[20px] shadow-[2px_2px_5px_rgba(0,0,0,0.25)] transition hover:shadow-md"
            style={{ fontFamily: '"EB Garamond", Garamond, serif' }}
          >
            record more
          </button>
        </div>
      </div>
    </main>
  )
}
