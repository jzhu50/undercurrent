'use client'

import { useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyzeResult {
  fusedEmotions: Record<string, number>
  contradictionDetected: boolean
  contradictionMessage: string
  emotionBeneath: string
}

interface Entry {
  _id: string
  transcript?: string
  fusedEmotions?: Record<string, number>
  emotionBeneath?: string
  gradientColors?: string[]
  createdAt: string
}

interface EntriesResponse {
  data: Entry[]
  meta: { total: number; page: number; pages: number }
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-zinc-800">{title}</h2>
      {children}
    </div>
  )
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? '200 OK' : 'ERROR'}
    </span>
  )
}

function Pre({ data }: { data: unknown }) {
  return (
    <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs overflow-auto max-h-64 text-zinc-700">
      {JSON.stringify(data, null, 2) as string}
    </pre>
  )
}

function Btn({
  onClick,
  disabled,
  children,
  variant = 'primary',
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'primary' | 'danger' | 'ghost'
}) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-700',
    danger:  'bg-red-600 text-white hover:bg-red-500',
    ghost:   'border border-zinc-300 text-zinc-700 hover:bg-zinc-50',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TestPage() {
  // ── 1. Transcribe ────────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcript, setTranscript] = useState('')
  const [transcribeStatus, setTranscribeStatus] = useState<null | boolean>(null)
  const [transcribeLoading, setTranscribeLoading] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const combinedStreamRef = useRef<MediaStream | null>(null)
  const [videoFrame, setVideoFrame] = useState<Blob | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null)

  async function startRecording() {
    // Request audio + video together as one combined stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: 1280, height: 720, facingMode: 'user' },
    }).catch(() =>
      // Fallback: audio only if camera is denied
      navigator.mediaDevices.getUserMedia({ audio: true })
    )

    combinedStreamRef.current = stream

    // Show live webcam preview
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      setCameraActive(true)
    }

    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' })
    chunksRef.current = []
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setAudioBlob(blob) // reuse audioBlob state — now holds the full video
      setRecordedVideoUrl(URL.createObjectURL(blob))
      stream.getTracks().forEach((t) => t.stop())
      setCameraActive(false)
    }
    mr.start(100) // collect data every 100ms
    mediaRef.current = mr
    setRecording(true)
  }

  function stopRecording() {
    // Capture a face frame just before stopping
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) setVideoFrame(blob)
      }, 'image/jpeg', 0.85)
    }
    mediaRef.current?.stop()
    setRecording(false)
  }

  async function runTranscribe() {
    if (!audioBlob) return
    setTranscribeLoading(true)
    setTranscribeStatus(null)
    try {
      const fd = new FormData()
      fd.append('audio', audioBlob, 'recording.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const json = await res.json()
      setTranscribeStatus(res.ok)
      if (res.ok) setTranscript(json.transcript ?? '')
    } finally {
      setTranscribeLoading(false)
    }
  }

  // ── 2. Analyze ───────────────────────────────────────────────────────────
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [analyzeStatus, setAnalyzeStatus] = useState<null | boolean>(null)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [manualTranscript, setManualTranscript] = useState('')

  async function runAnalyze() {
    const text = transcript || manualTranscript
    if (!text.trim()) return
    setAnalyzeLoading(true)
    setAnalyzeStatus(null)
    try {
      const fd = new FormData()
      fd.append('transcript', text)
      const audio = audioBlob ?? new Blob([new Uint8Array(0)], { type: 'audio/webm' })
      fd.append('audio', audio, 'recording.webm')
      if (videoFrame) fd.append('videoFrame', videoFrame, 'frame.jpg')
      const res = await fetch('/api/analyze', { method: 'POST', body: fd })
      const json = await res.json()
      setAnalyzeStatus(res.ok)
      if (res.ok) setAnalyzeResult(json)
    } finally {
      setAnalyzeLoading(false)
    }
  }

  // ── 3. Save entry ────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<null | boolean>(null)
  const [saveResult, setSaveResult] = useState<Record<string, unknown> | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)

  async function runSave() {
    if (!analyzeResult) return
    setSaveLoading(true)
    setSaveStatus(null)
    try {
      const body = {
        transcript: transcript || manualTranscript,
        fusedEmotions:         analyzeResult.fusedEmotions,
        contradictionDetected: analyzeResult.contradictionDetected,
        contradictionMessage:  analyzeResult.contradictionMessage,
        emotionBeneath:        analyzeResult.emotionBeneath,
      }
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      setSaveStatus(res.ok)
      setSaveResult(json)
    } finally {
      setSaveLoading(false)
    }
  }

  // ── 4. Fetch entries ─────────────────────────────────────────────────────
  const [entries, setEntries] = useState<EntriesResponse | null>(null)
  const [entriesStatus, setEntriesStatus] = useState<null | boolean>(null)
  const [entriesLoading, setEntriesLoading] = useState(false)

  async function runFetchEntries() {
    setEntriesLoading(true)
    setEntriesStatus(null)
    try {
      const res = await fetch('/api/entries')
      const json = await res.json()
      setEntriesStatus(res.ok)
      if (res.ok) setEntries(json)
    } finally {
      setEntriesLoading(false)
    }
  }

  // ── 5. Upload audio ──────────────────────────────────────────────────────
  const [uploadResult, setUploadResult] = useState<Record<string, unknown> | null>(null)
  const [uploadStatus, setUploadStatus] = useState<null | boolean>(null)
  const [uploadLoading, setUploadLoading] = useState(false)

  async function runUpload() {
    if (!audioBlob) return
    setUploadLoading(true)
    setUploadStatus(null)
    try {
      const fd = new FormData()
      fd.append('audio', audioBlob, 'recording.webm')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      setUploadStatus(res.ok)
      setUploadResult(json)
    } finally {
      setUploadLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">API Test Panel</h1>
        <p className="text-sm text-zinc-500 mt-1">Dev-only — test each backend endpoint manually</p>
      </div>

      {/* ── 1. Record + Transcribe ── */}
      <Section title="1. Record + Transcribe  →  /api/transcribe">
        <div className="flex gap-3 items-center">
          {!recording ? (
            <Btn onClick={startRecording}>⏺ Start recording</Btn>
          ) : (
            <Btn onClick={stopRecording} variant="danger">⏹ Stop recording</Btn>
          )}
          {audioBlob && <span className="text-xs text-zinc-500">Audio captured ({(audioBlob.size / 1024).toFixed(1)} KB)</span>}
        </div>

        {/* Webcam preview — visible while recording */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full max-w-xs rounded-lg border border-zinc-200 ${cameraActive ? 'block' : 'hidden'}`}
        />
        {/* Hidden canvas used to grab a frame */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Show captured frame thumbnail after stop */}
        {videoFrame && (
          <div className="flex items-center gap-2">
            <img
              src={URL.createObjectURL(videoFrame)}
              alt="Captured frame"
              className="w-20 h-14 object-cover rounded border border-zinc-200"
            />
            <span className="text-xs text-green-600">✓ Face frame captured ({(videoFrame.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        {recordedVideoUrl && (
          <video
            controls
            src={recordedVideoUrl}
            className="w-full rounded-lg border border-zinc-200 max-h-48 bg-black"
          />
        )}

        <div className="flex gap-3 items-center">
          <Btn onClick={runTranscribe} disabled={!audioBlob || transcribeLoading}>
            {transcribeLoading ? 'Transcribing…' : 'Send to /api/transcribe'}
          </Btn>
          {transcribeStatus !== null && <Badge ok={transcribeStatus} />}
        </div>

        {transcript && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm text-zinc-700">
            <p className="text-xs text-zinc-400 mb-1">Transcript</p>
            {transcript}
          </div>
        )}
      </Section>

      {/* ── 2. Analyze ── */}
      <Section title="2. Analyze emotions  →  /api/analyze">
        <p className="text-xs text-zinc-500">
        Uses transcript from step 1, or type one manually below. Audio is sent for Hume voice emotion.{' '}
        {videoFrame
          ? <span className="text-green-600 font-medium">Face frame from step 1 will be included. ✓</span>
          : <span className="text-amber-600">No face frame — record with webcam in step 1 for face emotion.</span>
        }
      </p>
        <textarea
          className="w-full border border-zinc-200 rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          placeholder="Type or paste a transcript here (or use the one from step 1)…"
          value={transcript || manualTranscript}
          onChange={(e) => {
            if (transcript) setTranscript(e.target.value)
            else setManualTranscript(e.target.value)
          }}
        />
        <div className="flex gap-3 items-center">
          <Btn
            onClick={runAnalyze}
            disabled={!(transcript || manualTranscript).trim() || analyzeLoading}
          >
            {analyzeLoading ? 'Analyzing…' : 'Send to /api/analyze'}
          </Btn>
          {analyzeStatus !== null && <Badge ok={analyzeStatus} />}
        </div>
        {analyzeResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(analyzeResult.fusedEmotions).map(([k, v]) => (
                <div key={k} className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-zinc-400 capitalize">{k}</p>
                  <p className="text-lg font-semibold text-zinc-800">{v.toFixed(1)}</p>
                </div>
              ))}
            </div>
            {analyzeResult.contradictionDetected && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                ⚠ {analyzeResult.contradictionMessage}
              </div>
            )}
            {analyzeResult.emotionBeneath && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                💡 {analyzeResult.emotionBeneath}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── 3. Save entry ── */}
      <Section title="3. Save entry  →  POST /api/entries">
        <p className="text-xs text-zinc-500">Saves the analyze result from step 2 to MongoDB. Gradient colors are auto-computed on save.</p>
        <div className="flex gap-3 items-center">
          <Btn onClick={runSave} disabled={!analyzeResult || saveLoading}>
            {saveLoading ? 'Saving…' : 'Save to MongoDB'}
          </Btn>
          {saveStatus !== null && <Badge ok={saveStatus} />}
        </div>
        {saveResult && <Pre data={saveResult} />}
      </Section>

      {/* ── 4. Fetch entries ── */}
      <Section title="4. Fetch entries  →  GET /api/entries">
        <div className="flex gap-3 items-center">
          <Btn onClick={runFetchEntries} disabled={entriesLoading}>
            {entriesLoading ? 'Loading…' : 'Fetch my entries'}
          </Btn>
          {entriesStatus !== null && <Badge ok={entriesStatus} />}
        </div>
        {entries && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">{entries.meta.total} total entries</p>
            {entries.data.length === 0 ? (
              <p className="text-sm text-zinc-400">No entries yet — save one in step 3 first.</p>
            ) : (
              entries.data.map((entry) => (
                <div key={entry._id} className="border border-zinc-200 rounded-lg p-3 spimage.pngace-y-1">
                  <div className="flex gap-2 items-center">
                    {entry.gradientColors && entry.gradientColors.length > 0 && (() => {
                      const [c1, c2, c3] = entry.gradientColors
                      const bg = c2
                        ? `linear-gradient(to bottom, ${c1} 0%, ${c2} 50%, ${c3 ?? c2} 100%)`
                        : c1
                      return (
                        <div
                          className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm"
                          style={{ background: bg }}
                        />
                      )
                    })()}
                    <span className="text-xs text-zinc-400">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  {entry.transcript && (
                    <p className="text-sm text-zinc-700 line-clamp-2">{entry.transcript}</p>
                  )}
                  {entry.emotionBeneath && (
                    <p className="text-xs text-zinc-500 italic">{entry.emotionBeneath}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Section>

      {/* ── 5. Upload audio ── */}
      <Section title="5. Upload recording  →  /api/upload (Vercel Blob)">
        <p className="text-xs text-zinc-500">Uploads the full video recording (audio + face) from step 1 to Vercel Blob and returns a URL for playback later.</p>
        <div className="flex gap-3 items-center">
          <Btn onClick={runUpload} disabled={!audioBlob || uploadLoading}>
            {uploadLoading ? 'Uploading…' : 'Upload to Vercel Blob'}
          </Btn>
          {uploadStatus !== null && <Badge ok={uploadStatus} />}
        </div>
        {uploadResult && <Pre data={uploadResult} />}
      </Section>
    </div>
  )
}
