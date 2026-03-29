'use client'

import '@fontsource/eb-garamond'
import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { setRecordingResult } from '@/lib/recordingStore'
import { computeGradientColors } from '@/lib/gradients'
import type { FusedEmotions } from '@/lib/models/Entry'

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'recording'

interface TranscriptSegment { time: string; text: string }

interface AnalyzeResult {
  fusedEmotions: Record<string, number>
  contradictionDetected: boolean
  contradictionMessage: string
  emotionBeneath: string
  keywords: string[]
}

// SpeechRecognition isn't in the default TS lib — declare just enough
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: Event) => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

// ── Nav ───────────────────────────────────────────────────────────────────────


// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RecordPage() {
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [segments, setSegments]             = useState<TranscriptSegment[]>([])
  const [interimText, setInterimText]       = useState('')

  const videoRef     = useRef<HTMLVideoElement | null>(null)
  const canvasRef    = useRef<HTMLCanvasElement | null>(null)
  const mediaRef     = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const streamRef    = useRef<MediaStream | null>(null)
  const videoBlobRef = useRef<Blob | null>(null)
  const recStartRef  = useRef<number>(0)
  const srRef        = useRef<SpeechRecognitionInstance | null>(null)
  const scrollRef    = useRef<HTMLDivElement | null>(null)

  // ── Sync user to MongoDB on mount (handles OAuth users missed by webhook) ───

  useEffect(() => {
    fetch('/api/user').catch(() => {})
  }, [])

  // ── Webcam preview on mount ───────────────────────────────────────────────

  useEffect(() => {
    let active = true
    navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError('Camera or microphone access denied.'))
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // ── Auto-scroll transcript panel ─────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments, interimText])

  // ── Start recording ───────────────────────────────────────────────────────

  function startRecording() {
    setError(null)
    setSegments([])
    setInterimText('')
    const stream = streamRef.current
    if (!stream) return

    // MediaRecorder
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' })
    chunksRef.current = []
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      videoBlobRef.current = blob
    }
    mr.start(100)
    mediaRef.current = mr
    recStartRef.current = Date.now()

    // SpeechRecognition for live captions
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (SR) {
      const sr = new SR()
      sr.continuous      = true
      sr.interimResults  = true
      sr.lang            = 'en-US'

      sr.onresult = (e: SpeechRecognitionEvent) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) {
            const text = r[0].transcript.trim()
            if (text) {
              const time = formatElapsed(Date.now() - recStartRef.current)
              setSegments((prev) => [...prev, { time, text }])
            }
          } else {
            interim += r[0].transcript
          }
        }
        setInterimText(interim)
      }
      sr.onerror = () => { /* silent — captions are best-effort */ }
      sr.start()
      srRef.current = sr
    }

    setStage('recording')
  }

  // ── Stop recording + redirect immediately ────────────────────────────────

  async function stopAndProcess() {
    srRef.current?.stop()
    srRef.current = null
    setInterimText('')

    // Capture face frame before stopping the stream
    let frameBlob: Blob | null = null
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current
      const c = canvasRef.current
      c.width  = v.videoWidth  || 640
      c.height = v.videoHeight || 480
      c.getContext('2d')?.drawImage(v, 0, 0)
      frameBlob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85))
    }

    mediaRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())

    // Mark store as processing and navigate right away
    setRecordingResult({ status: 'processing' })
    router.push('/results')

    // Wait for MediaRecorder onstop to fire and populate videoBlobRef
    await new Promise((res) => setTimeout(res, 300))
    const videoBlob = videoBlobRef.current
    if (!videoBlob) {
      setRecordingResult({ status: 'error', error: 'Recording failed.' })
      return
    }

    // Pipeline runs in the background after navigation
    try {
      // 1. Transcribe
      const tfd = new FormData()
      tfd.append('audio', videoBlob, 'recording.webm')
      const tRes = await fetch('/api/transcribe', { method: 'POST', body: tfd })
      const { transcript } = await tRes.json() as { transcript: string }

      // 2. Analyze
      const afd = new FormData()
      afd.append('audio', videoBlob, 'recording.webm')
      afd.append('transcript', transcript ?? '')
      if (frameBlob) afd.append('videoFrame', frameBlob, 'frame.jpg')
      const aRes = await fetch('/api/analyze', { method: 'POST', body: afd })
      const analyzed = await aRes.json() as AnalyzeResult

      // Compute gradient colors from fused emotions
      const gradientColors = analyzed.fusedEmotions
        ? computeGradientColors(analyzed.fusedEmotions as unknown as FusedEmotions)
        : []

      // Push results to the store so the results page can render them
      setRecordingResult({
        status: 'done',
        gradientColors,
        emotionBeneath:        analyzed.emotionBeneath,
        contradictionDetected: analyzed.contradictionDetected,
        contradictionMessage:  analyzed.contradictionMessage,
      })

      // 3. Upload video + save entry; capture entryId once persisted
      const uploadUrl = await fetch('/api/upload', {
        method: 'POST',
        body: (() => { const f = new FormData(); f.append('audio', videoBlob, 'recording.webm'); return f })(),
      })
        .then((r) => r.json())
        .then(({ url }: { url?: string }) => url)
        .catch(() => undefined)

      const saved = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          audioUrl: uploadUrl,
          fusedEmotions:         analyzed.fusedEmotions,
          contradictionDetected: analyzed.contradictionDetected,
          contradictionMessage:  analyzed.contradictionMessage,
          emotionBeneath:        analyzed.emotionBeneath,
          keywords:              analyzed.keywords ?? [],
        }),
      }).then((r) => r.json()) as { data?: { _id: string } }

      if (saved.data?._id) {
        // Update store with entryId so results page can enable "view insights"
        setRecordingResult({
          ...{ status: 'done', gradientColors, emotionBeneath: analyzed.emotionBeneath,
               contradictionDetected: analyzed.contradictionDetected,
               contradictionMessage:  analyzed.contradictionMessage },
          entryId: String(saved.data._id),
        })
      }
    } catch (err) {
      console.error(err)
      setRecordingResult({ status: 'error', error: 'Something went wrong. Please try again.' })
    }
  }

  // ── Date label ────────────────────────────────────────────────────────────

  const today = new Date()
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    .toLowerCase()

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ backgroundImage: 'url(/paper-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/75" />
      <NavBar />
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative z-10 flex flex-col items-center gap-14">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[#7f7f7f] text-[20px]" style={{ fontFamily: '"DM Mono", monospace' }}>
            {today}
          </p>
          <p className="text-black text-[48px] leading-[60px]" style={{ fontFamily: '"EB Garamond", Garamond, serif' }}>
            today, i feel...
          </p>
        </div>

        {/* Content row: video + (optional) transcript panel */}
        <div className={`flex items-start gap-20 ${stage === 'recording' ? '' : 'flex-col items-center'}`}>

          {/* Left column: video + button */}
          <div className="flex flex-col items-center gap-14">
          {/* Video area */}
          <div className="relative w-[648px] h-[364px] rounded-xl overflow-hidden bg-zinc-100">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

              {/* Recording indicator */}
              {stage === 'recording' && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-white drop-shadow" style={{ fontFamily: '"DM Mono", monospace' }}>rec</span>
                </div>
              )}
            </div>

            {/* Buttons */}
            {stage === 'idle' && (
              <button
                onClick={startRecording}
                className="w-[360px] bg-white border border-[#63d7ba] rounded-full py-3.5 text-black text-[32px] shadow-[2px_2px_5px_rgba(99,215,186,0.5)] transition hover:shadow-[2px_2px_10px_rgba(99,215,186,0.7)]"
                style={{ fontFamily: '"EB Garamond", Garamond, serif' }}
              >
                record
              </button>
            )}

            {stage === 'recording' && (
              <button
                onClick={stopAndProcess}
                className="w-[360px] bg-white border border-[#ff7480] rounded-full py-3.5 text-black text-[32px] shadow-[2px_2px_5px_rgba(255,116,128,0.25)] transition hover:shadow-[2px_2px_10px_rgba(255,116,128,0.4)]"
                style={{ fontFamily: '"EB Garamond", Garamond, serif' }}
              >
                stop
              </button>
            )}

          </div>

          {/* Right column: live transcript panel (recording only) */}
          {stage === 'recording' && (
            <div
              ref={scrollRef}
              className="w-[320px] self-stretch bg-white border border-[rgba(127,127,127,0.5)] rounded-3xl shadow-[2px_2px_5px_rgba(0,0,0,0.25)] px-7 py-12 flex flex-col gap-9 overflow-y-auto"
              style={{ maxHeight: 480 }}
            >
              {segments.map((seg, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <p className="text-black text-[18px]" style={{ fontFamily: '"DM Mono", monospace' }}>
                    {seg.time}
                  </p>
                  <p className="text-[#7f7f7f] text-[18px] italic" style={{ fontFamily: '"DM Mono", monospace' }}>
                    {seg.text}
                  </p>
                </div>
              ))}

              {/* Interim text (partial, still being spoken) */}
              {interimText && (
                <div className="flex flex-col gap-1.5 opacity-50">
                  <p className="text-black text-[18px]" style={{ fontFamily: '"DM Mono", monospace' }}>
                    {formatElapsed(Date.now() - recStartRef.current)}
                  </p>
                  <p className="text-[#7f7f7f] text-[18px] italic" style={{ fontFamily: '"DM Mono", monospace' }}>
                    {interimText}
                  </p>
                </div>
              )}

              {/* Empty state before first words */}
              {segments.length === 0 && !interimText && (
                <p className="text-zinc-300 text-[16px] italic" style={{ fontFamily: '"DM Mono", monospace' }}>
                  start speaking…
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm" style={{ fontFamily: '"DM Mono", monospace' }}>{error}</p>
        )}
      </div>
    </main>
  )
}
