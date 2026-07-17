import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from './AuthContext'
import type { Listing } from '../data/listings'
import type { ConversationRow, MessageRow, ProfileRow } from '../lib/database.types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export const MAX_MESSAGE_VIDEO_BYTES = 40 * 1024 * 1024
export const ALLOWED_MESSAGE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const

export type ConversationSummary = {
  id: string
  listingId: string
  listingTitle: string
  listingPoster: string
  listingMake: string
  listingModel: string
  buyerId: string
  sellerId: string
  otherName: string
  lastMessageAt: string
  lastPreview: string
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  body: string | null
  videoPath: string | null
  videoUrl: string | null
  createdAt: string
}

type MessagesContextValue = {
  conversations: ConversationSummary[]
  loadingConversations: boolean
  conversationsError: string | null
  refreshConversations: () => Promise<void>
  openOrCreateConversation: (listing: Listing) => Promise<{ id?: string; error?: string }>
  messages: ChatMessage[]
  loadingMessages: boolean
  messagesError: string | null
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  sendMessage: (input: {
    conversationId: string
    text?: string
    videoFile?: File | null
  }) => Promise<{ error?: string }>
  getConversation: (id: string) => ConversationSummary | undefined
}

const MessagesContext = createContext<MessagesContextValue | null>(null)

const videoUrlCache = new Map<string, string>()

async function resolveVideoUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const cached = videoUrlCache.get(path)
  if (cached) return cached

  const { data, error } = await supabase.storage
    .from('message-videos')
    .createSignedUrl(path, 60 * 60)

  if (error || !data?.signedUrl) {
    console.warn('[CarBuy] signed video URL failed', error?.message)
    return null
  }
  videoUrlCache.set(path, data.signedUrl)
  return data.signedUrl
}

async function mapMessage(row: MessageRow): Promise<ChatMessage> {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    videoPath: row.video_path,
    videoUrl: await resolveVideoUrl(row.video_path),
    createdAt: row.created_at,
  }
}

function previewFromMessage(row: Pick<MessageRow, 'body' | 'video_path'> | null | undefined): string {
  if (!row) return 'Új beszélgetés'
  if (row.body?.trim()) return row.body.trim()
  if (row.video_path) return 'Videó csatolva'
  return 'Üzenet'
}

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const activeIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeIdRef.current = activeConversationId
  }, [activeConversationId])

  const refreshConversations = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setConversations([])
      setConversationsError(null)
      setLoadingConversations(false)
      return
    }

    setLoadingConversations(true)
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (error) {
      setConversationsError(error.message)
      setConversations([])
      setLoadingConversations(false)
      return
    }

    const rows = (data ?? []) as ConversationRow[]
    if (rows.length === 0) {
      setConversations([])
      setConversationsError(null)
      setLoadingConversations(false)
      return
    }

    const listingIds = [...new Set(rows.map((r) => r.listing_id))]
    const profileIds = [...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id]))]

    const [{ data: listings }, { data: profiles }, { data: latestMessages }] = await Promise.all([
      supabase.from('listings').select('id, title, video_poster, make, model').in('id', listingIds),
      supabase.from('profiles').select('id, name, company_name, account_type').in('id', profileIds),
      supabase
        .from('messages')
        .select('conversation_id, body, video_path, created_at')
        .in(
          'conversation_id',
          rows.map((r) => r.id),
        )
        .order('created_at', { ascending: false }),
    ])

    const listingMap = new Map(
      (listings ?? []).map((l) => [
        l.id,
        l as { id: string; title: string; video_poster: string; make: string; model: string },
      ]),
    )
    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p as ProfileRow]),
    )

    const latestByConv = new Map<string, { body: string | null; video_path: string | null }>()
    for (const msg of latestMessages ?? []) {
      const m = msg as {
        conversation_id: string
        body: string | null
        video_path: string | null
      }
      if (!latestByConv.has(m.conversation_id)) {
        latestByConv.set(m.conversation_id, m)
      }
    }

    const mapped: ConversationSummary[] = rows.map((row) => {
      const otherId = row.buyer_id === user.id ? row.seller_id : row.buyer_id
      const other = profileMap.get(otherId)
      const listing = listingMap.get(row.listing_id)
      const otherName =
        other?.account_type === 'business' && other.company_name
          ? other.company_name
          : (other?.name ?? 'Felhasználó')

      return {
        id: row.id,
        listingId: row.listing_id,
        listingTitle: listing?.title ?? 'Hirdetés',
        listingPoster: listing?.video_poster ?? '',
        listingMake: listing?.make ?? '',
        listingModel: listing?.model ?? '',
        buyerId: row.buyer_id,
        sellerId: row.seller_id,
        otherName,
        lastMessageAt: row.last_message_at,
        lastPreview: previewFromMessage(latestByConv.get(row.id)),
      }
    })

    setConversations(mapped)
    setConversationsError(null)
    setLoadingConversations(false)
  }, [user])

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations])

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!isSupabaseConfigured) return

    setLoadingMessages(true)
    setMessagesError(null)

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      setMessagesError(error.message)
      setMessages([])
      setLoadingMessages(false)
      return
    }

    const mapped = await Promise.all(((data ?? []) as MessageRow[]).map(mapMessage))
    setMessages(mapped)
    setLoadingMessages(false)
  }, [])

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      setMessagesError(null)
      return
    }
    void loadMessages(activeConversationId)
  }, [activeConversationId, loadMessages])

  // Realtime for active conversation
  useEffect(() => {
    if (!isSupabaseConfigured || !activeConversationId) {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow
          void mapMessage(row).then((msg) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
          })
          void refreshConversations()
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      void supabase.removeChannel(channel)
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [activeConversationId, refreshConversations])

  const openOrCreateConversation = useCallback(
    async (listing: Listing) => {
      if (!isSupabaseConfigured) {
        return { error: 'Supabase nincs beállítva.' }
      }
      if (!user) {
        return { error: 'A üzenetküldéshez be kell jelentkezned.' }
      }
      if (!listing.ownerId) {
        return { error: 'Demó hirdetésre nem küldhető üzenet.' }
      }
      if (listing.ownerId === user.id) {
        return { error: 'Saját hirdetésedre nem indíthatsz beszélgetést.' }
      }

      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .maybeSingle()

      if (existingError) return { error: existingError.message }
      if (existing?.id) {
        await refreshConversations()
        return { id: existing.id }
      }

      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.ownerId,
        })
        .select('id')
        .single()

      if (createError || !created) {
        return { error: createError?.message ?? 'Beszélgetés létrehozása sikertelen.' }
      }

      await refreshConversations()
      return { id: created.id }
    },
    [user, refreshConversations],
  )

  const sendMessage = useCallback(
    async (input: { conversationId: string; text?: string; videoFile?: File | null }) => {
      if (!isSupabaseConfigured || !user) {
        return { error: 'Nincs bejelentkezve.' }
      }

      const text = input.text?.trim() ?? ''
      const file = input.videoFile ?? null

      if (!text && !file) {
        return { error: 'Írj üzenetet vagy csatolj videót.' }
      }

      if (file) {
        if (!ALLOWED_MESSAGE_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_MESSAGE_VIDEO_TYPES)[number])) {
          return { error: 'Csak MP4, WebM vagy MOV videó csatolható.' }
        }
        if (file.size > MAX_MESSAGE_VIDEO_BYTES) {
          return { error: 'A videó maximum 40 MB lehet.' }
        }
      }

      let videoPath: string | null = null

      if (file) {
        const ext =
          file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4'
        const path = `${user.id}/${input.conversationId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('message-videos')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })

        if (uploadError) {
          return { error: uploadError.message || 'Videó feltöltése sikertelen.' }
        }
        videoPath = path
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          sender_id: user.id,
          body: text || null,
          video_path: videoPath,
        })
        .select('*')
        .single()

      if (error || !data) {
        return { error: error?.message ?? 'Üzenet küldése sikertelen.' }
      }

      const mapped = await mapMessage(data as MessageRow)
      setMessages((prev) => {
        if (prev.some((m) => m.id === mapped.id)) return prev
        return [...prev, mapped]
      })
      await refreshConversations()
      return {}
    },
    [user, refreshConversations],
  )

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations],
  )

  const value = useMemo(
    () => ({
      conversations,
      loadingConversations,
      conversationsError,
      refreshConversations,
      openOrCreateConversation,
      messages,
      loadingMessages,
      messagesError,
      activeConversationId,
      setActiveConversationId,
      sendMessage,
      getConversation,
    }),
    [
      conversations,
      loadingConversations,
      conversationsError,
      refreshConversations,
      openOrCreateConversation,
      messages,
      loadingMessages,
      messagesError,
      activeConversationId,
      sendMessage,
      getConversation,
    ],
  )

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export function useMessages() {
  const ctx = useContext(MessagesContext)
  if (!ctx) throw new Error('useMessages must be used within MessagesProvider')
  return ctx
}
