'use client'

import '@fontsource/eb-garamond'
import { useEffect, useRef, useState } from 'react'
import NavBar from '@/components/NavBar'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Mood {
  key: string      // internal emotion key (joy, anger, …)
  label: string    // display name
  default: string  // hex default from Figma
}

// Maps Figma display names → internal emotion keys + default colors
const MOODS: Mood[] = [
  { key: 'joy',      label: 'happy',   default: '#fde2e4' },
  { key: 'sadness',  label: 'sad',     default: '#e2ece9' },
  { key: 'anger',    label: 'angry',   default: '#dbcfbd' },
  { key: 'surprise', label: 'excited', default: '#fefae0' },
  { key: 'disgust',  label: 'guilt',   default: '#efcfe3' },
  { key: 'fear',     label: 'scared',  default: '#add8e6' },
]

const STORAGE_KEY = 'undercurrent_emotion_colors'

function loadColors(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveColors(colors: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
}

// ── Color card ────────────────────────────────────────────────────────────────

function ColorCard({
  mood,
  color,
  onChange,
}: {
  mood: Mood
  color: string
  onChange: (key: string, hex: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col items-center gap-5 w-[120px]">
      {/* Circle — clicking triggers the hidden color input */}
      <button
        onClick={() => inputRef.current?.click()}
        className="w-[100px] h-[100px] rounded-full shadow-[2px_2px_5px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95 focus:outline-none"
        style={{ background: color }}
        aria-label={`Edit color for ${mood.label}`}
      />

      {/* Hidden native color picker */}
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(mood.key, e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />

      <p className="text-black text-[20px] text-center w-full" style={{ fontFamily: '"DM Mono", monospace' }}>
        {mood.label}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ColorsPage() {
  const [colors, setColors] = useState<Record<string, string>>({})

  // Hydrate from localStorage after mount
  useEffect(() => {
    setColors(loadColors())
  }, [])

  function handleChange(key: string, hex: string) {
    const next = { ...colors, [key]: hex }
    setColors(next)
    saveColors(next)
  }

  function resolveColor(mood: Mood): string {
    return colors[mood.key] ?? mood.default
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ backgroundImage: 'url(/paper-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/75" />
      <NavBar />

      <div className="relative z-10 flex flex-col items-center gap-14">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-black text-[48px] leading-[60px]" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
            my colors
          </p>
          <p className="text-[#7f7f7f] text-[20px]" style={{ fontFamily: '"DM Mono", monospace' }}>
            click a mood to edit its color
          </p>
        </div>

        {/* 3 × 2 grid */}
        <div className="grid grid-cols-3 gap-x-9 gap-y-9 py-6">
          {MOODS.map((mood) => (
            <ColorCard
              key={mood.key}
              mood={mood}
              color={resolveColor(mood)}
              onChange={handleChange}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
