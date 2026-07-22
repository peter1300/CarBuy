export interface Env {
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_STREAM_API_TOKEN: string
  STREAM_WEBHOOK_SECRET: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_ANON_KEY: string
  MAX_DURATION_SECONDS?: string
}

type UploadKind = 'main' | 'flaws'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...extraHeaders },
  })
}

function formatDurationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function getAuthedUserId(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null

  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  })
  if (!res.ok) return null
  const body = (await res.json()) as { id?: string }
  return body.id ?? null
}

async function assertListingOwner(
  env: Env,
  listingId: string,
  userId: string,
): Promise<boolean> {
  const res = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}&select=owner_id`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok) return false
  const rows = (await res.json()) as Array<{ owner_id: string | null }>
  return rows[0]?.owner_id === userId
}

async function supabasePatchListing(env: Env, listingId: string, patch: Record<string, unknown>) {
  const res = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase patch failed: ${res.status} ${text}`)
  }
}

async function supabasePatchByStreamUid(
  env: Env,
  uid: string,
  kind: UploadKind,
  patch: Record<string, unknown>,
) {
  const column = kind === 'flaws' ? 'flaws_stream_uid' : 'stream_uid'
  const res = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/listings?${column}=eq.${encodeURIComponent(uid)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase patch by uid failed: ${res.status} ${text}`)
  }
}

async function createDirectUpload(
  env: Env,
  meta: Record<string, string>,
): Promise<{ uploadURL: string; uid: string }> {
  const maxDurationSeconds = Number(env.MAX_DURATION_SECONDS || 600)
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maxDurationSeconds,
      meta,
    }),
  })
  const body = (await res.json()) as {
    success?: boolean
    result?: { uploadURL?: string; uid?: string }
    errors?: Array<{ message?: string }>
  }
  if (!res.ok || !body.success || !body.result?.uploadURL || !body.result?.uid) {
    throw new Error(body.errors?.[0]?.message || 'Failed to create Stream direct upload')
  }
  return { uploadURL: body.result.uploadURL, uid: body.result.uid }
}

async function fetchStreamVideo(env: Env, uid: string) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
    {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}` },
    },
  )
  const body = (await res.json()) as {
    success?: boolean
    result?: StreamVideo
    errors?: Array<{ message?: string }>
  }
  if (!res.ok || !body.success || !body.result) {
    throw new Error(body.errors?.[0]?.message || 'Failed to fetch Stream video')
  }
  return body.result
}

type StreamVideo = {
  uid: string
  readyToStream?: boolean
  thumbnail?: string
  duration?: number
  size?: number
  preview?: string
  meta?: Record<string, string>
  status?: { state?: string; pctComplete?: string; errorReasonText?: string }
  playback?: { hls?: string; dash?: string }
}

async function verifyWebhookSignature(env: Env, request: Request, rawBody: string): Promise<boolean> {
  const header = request.headers.get('Webhook-Signature') || ''
  if (!header || !env.STREAM_WEBHOOK_SECRET) return false

  const parts = Object.fromEntries(
    header.split(',').map((pair) => {
      const [k, v] = pair.split('=')
      return [k.trim(), (v || '').trim()]
    }),
  )
  const time = parts.time
  const sig1 = parts.sig1
  if (!time || !sig1) return false

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(time))
  if (!Number.isFinite(ageSec) || ageSec > 60 * 30) return false

  const source = `${time}.${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.STREAM_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(source))
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return expected === sig1
}

function readyPatchFromVideo(video: StreamVideo, kind: UploadKind): Record<string, unknown> {
  const hls = video.playback?.hls || null
  const poster = video.thumbnail || null
  const durationLabel = formatDurationLabel(Number(video.duration) || 0)
  const size = typeof video.size === 'number' ? video.size : null

  if (kind === 'flaws') {
    return {
      flaws_video_url: hls,
      flaws_stream_uid: video.uid,
    }
  }

  return {
    video_url: hls,
    video_poster: poster,
    video_duration: durationLabel,
    video_size_bytes: size,
    stream_uid: video.uid,
    processing_status: 'ready',
  }
}

async function markListingReadyFromVideo(env: Env, video: StreamVideo) {
  const kind = (video.meta?.kind as UploadKind) || 'main'
  const listingId = video.meta?.listingId

  const state = video.status?.state
  if (state === 'error') {
    const patch = {
      processing_status: 'failed',
    }
    if (listingId) await supabasePatchListing(env, listingId, patch)
    else await supabasePatchByStreamUid(env, video.uid, kind, patch)
    return
  }

  if (!video.readyToStream && state !== 'ready') return

  const patch = readyPatchFromVideo(video, kind)
  if (listingId) {
    await supabasePatchListing(env, listingId, patch)
    // If flaws finished after main, don't overwrite ready; if main finishes, set ready.
    return
  }
  await supabasePatchByStreamUid(env, video.uid, kind, patch)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true })
      }

      // Create one-time direct upload URL (basic POST, max 200 MB client-side)
      if (request.method === 'POST' && url.pathname === '/create-upload') {
        const userId = await getAuthedUserId(request, env)
        if (!userId) return json({ error: 'Unauthorized' }, 401)

        const body = (await request.json()) as {
          listingId?: string
          kind?: UploadKind
          fileName?: string
        }
        const listingId = String(body.listingId || '').trim()
        const kind: UploadKind = body.kind === 'flaws' ? 'flaws' : 'main'
        if (!listingId) return json({ error: 'listingId required' }, 400)

        const owns = await assertListingOwner(env, listingId, userId)
        if (!owns) return json({ error: 'Forbidden' }, 403)

        const { uploadURL, uid } = await createDirectUpload(env, {
          listingId,
          ownerId: userId,
          kind,
          name: body.fileName || `${kind}-${listingId}`,
        })

        const uidPatch =
          kind === 'flaws'
            ? { flaws_stream_uid: uid, processing_status: 'processing' }
            : { stream_uid: uid, processing_status: 'processing' }
        await supabasePatchListing(env, listingId, uidPatch)

        return json({ uploadURL, uid, kind })
      }

      // Poll Stream status (local/dev fallback when webhook is unavailable)
      if (request.method === 'GET' && url.pathname.startsWith('/status/')) {
        const userId = await getAuthedUserId(request, env)
        if (!userId) return json({ error: 'Unauthorized' }, 401)

        const uid = url.pathname.replace('/status/', '').trim()
        if (!uid) return json({ error: 'uid required' }, 400)

        const video = await fetchStreamVideo(env, uid)
        if (video.meta?.ownerId && video.meta.ownerId !== userId) {
          return json({ error: 'Forbidden' }, 403)
        }

        if (video.readyToStream || video.status?.state === 'ready' || video.status?.state === 'error') {
          await markListingReadyFromVideo(env, video)
        }

        return json({
          uid: video.uid,
          readyToStream: Boolean(video.readyToStream),
          state: video.status?.state ?? 'unknown',
          pctComplete: video.status?.pctComplete ?? null,
          playback: video.playback ?? null,
          thumbnail: video.thumbnail ?? null,
          duration: video.duration ?? null,
          size: video.size ?? null,
          error: video.status?.errorReasonText ?? null,
        })
      }

      // Cloudflare Stream webhook
      if (request.method === 'POST' && url.pathname === '/webhook') {
        const rawBody = await request.text()
        const ok = await verifyWebhookSignature(env, request, rawBody)
        if (!ok) return json({ error: 'Invalid signature' }, 401)

        const video = JSON.parse(rawBody) as StreamVideo
        await markListingReadyFromVideo(env, video)
        return json({ ok: true })
      }

      return json({ error: 'Not found' }, 404)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[stream-api]', message)
      return json({ error: message }, 500)
    }
  },
}
