/**
 * Cloudflare Stream client helpers (upload via Worker, HLS playback).
 */

import { supabase } from './supabase'
import { tGlobal } from '../i18n/messages'

export type StreamUploadKind = 'main' | 'flaws'

export type StreamCreateUploadResponse = {
  uploadURL: string
  uid: string
  kind: StreamUploadKind
}

export type StreamStatusResponse = {
  uid: string
  readyToStream: boolean
  state: string
  pctComplete: string | null
  playback: { hls?: string; dash?: string } | null
  thumbnail: string | null
  duration: number | null
  size: number | null
  error: string | null
}

const UPLOAD_TIMEOUT_MS = 20 * 60 * 1000
const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 20 * 60 * 1000

export function getStreamApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_STREAM_API_URL as string | undefined)?.trim()
  if (!raw) {
    throw new Error(
      'Missing VITE_STREAM_API_URL — set the Cloudflare Stream Worker URL in .env (see .env.example).',
    )
  }
  return raw.replace(/\/$/, '')
}

export function isStreamApiConfigured(): boolean {
  return Boolean((import.meta.env.VITE_STREAM_API_URL as string | undefined)?.trim())
}

export function isHlsUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return /\.m3u8(\?|$)/i.test(url) || /cloudflarestream\.com|videodelivery\.net/i.test(url)
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error(tGlobal('errors.sessionExpired'))
  }
  return data.session.access_token
}

export async function createStreamUpload(input: {
  listingId: string
  kind: StreamUploadKind
  fileName?: string
}): Promise<StreamCreateUploadResponse> {
  const token = await getAccessToken()
  const res = await fetch(`${getStreamApiBaseUrl()}/create-upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      listingId: input.listingId,
      kind: input.kind,
      fileName: input.fileName,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as StreamCreateUploadResponse & {
    error?: string
  }
  if (!res.ok || !body.uploadURL || !body.uid) {
    throw new Error(body.error || `create-upload failed (${res.status})`)
  }
  return { uploadURL: body.uploadURL, uid: body.uid, kind: body.kind ?? input.kind }
}

/** Basic POST direct creator upload (≤ 200 MB). */
export function uploadFileToStream(
  uploadURL: string,
  file: File,
  onRatio?: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file, file.name || 'video.mp4')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadURL)
    xhr.timeout = UPLOAD_TIMEOUT_MS
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      onRatio?.(Math.min(1, event.loaded / event.total))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onRatio?.(1)
        resolve()
        return
      }
      reject(new Error(xhr.responseText || `Stream upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error(tGlobal('errors.generic')))
    xhr.ontimeout = () => reject(new Error('Stream upload timed out'))
    xhr.send(form)
  })
}

export async function fetchStreamStatus(uid: string): Promise<StreamStatusResponse> {
  const token = await getAccessToken()
  const res = await fetch(`${getStreamApiBaseUrl()}/status/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = (await res.json().catch(() => ({}))) as StreamStatusResponse & { error?: string }
  if (!res.ok) {
    throw new Error(body.error || `status failed (${res.status})`)
  }
  return body
}

export async function waitForStreamReady(
  uid: string,
  options?: {
    onProgress?: (status: StreamStatusResponse) => void
    timeoutMs?: number
    intervalMs?: number
  },
): Promise<StreamStatusResponse> {
  const timeoutMs = options?.timeoutMs ?? POLL_TIMEOUT_MS
  const intervalMs = options?.intervalMs ?? POLL_INTERVAL_MS
  const started = Date.now()

  for (;;) {
    const status = await fetchStreamStatus(uid)
    options?.onProgress?.(status)

    if (status.state === 'error' || status.error) {
      throw new Error(status.error || 'Stream encoding failed')
    }
    if (status.readyToStream || status.state === 'ready') {
      return status
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('Stream encoding timed out')
    }
    await new Promise((r) => window.setTimeout(r, intervalMs))
  }
}

/**
 * Attach an MP4 or HLS URL to a video element (hls.js for non-Safari HLS).
 * Returns a cleanup function.
 */
export async function attachMediaSource(
  video: HTMLVideoElement,
  src: string | null | undefined,
): Promise<() => void> {
  if (!src) {
    video.removeAttribute('src')
    video.load()
    return () => undefined
  }

  const canNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''

  if (!isHlsUrl(src) || canNativeHls) {
    video.src = src
    return () => {
      video.removeAttribute('src')
      video.load()
    }
  }

  const { default: Hls } = await import('hls.js')
  if (!Hls.isSupported()) {
    video.src = src
    return () => {
      video.removeAttribute('src')
      video.load()
    }
  }

  // Always prefer the highest available Stream ABR rung for listing playback.
  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    maxBufferLength: 45,
    capLevelToPlayerSize: false,
    testBandwidth: false,
    abrEwmaDefaultEstimate: 20_000_000,
    abrEwmaDefaultEstimateMax: Infinity,
    startLevel: -1,
  })

  const lockHighestQuality = () => {
    const levels = hls.levels
    if (!levels.length) return
    const highest = levels.length - 1
    hls.startLevel = highest
    hls.loadLevel = highest
    hls.nextLevel = highest
    hls.currentLevel = highest
    hls.autoLevelEnabled = false
  }

  hls.on(Hls.Events.MANIFEST_PARSED, lockHighestQuality)
  hls.on(Hls.Events.LEVELS_UPDATED, lockHighestQuality)

  hls.loadSource(src)
  hls.attachMedia(video)
  return () => {
    hls.destroy()
    video.removeAttribute('src')
    video.load()
  }
}
