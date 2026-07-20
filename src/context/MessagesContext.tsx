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
import { formatListingTitle } from '../data/listings'
import type { ConversationRow, MessageRow, ProfileRow } from '../lib/database.types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { tGlobal } from '../i18n/messages'

/** Max raw attachment size before compression */
export const MAX_MESSAGE_VIDEO_BYTES = 150 * 1024 * 1024
/** Max size after compression for upload */
export const MAX_MESSAGE_VIDEO_UPLOAD_BYTES = 40 * 1024 * 1024
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
  unreadCount: number
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
  unreadCount: number
  loadingConversations: boolean
  conversationsError: string | null
  refreshConversations: () => Promise<void>
  openOrCreateConversation: (listing: Listing) => Promise<{ id?: string; error?: string }>
  messages: ChatMessage[]
  loadingMessages: boolean
  messagesError: string | null
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  markConversationRead: (conversationId: string) => Promise<void>
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

function previewFromConversation(row: ConversationRow): string {
  if (row.last_message_body?.trim()) return row.last_message_body.trim()
  if (row.last_message_video_path) return tGlobal('messages.videoAttached')
  return tGlobal('messages.newChat')
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
  const inboxChannelRef = useRef<RealtimeChannel | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | undefined>(user?.id)

  useEffect(() => {
    activeIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    userIdRef.current = user?.id
  }, [user?.id])

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

    const [{ data: listings }, { data: profiles }, { data: unreadRows }] = await Promise.all([
      supabase.from('listings').select('id, title, video_poster, make, model').in('id', listingIds),
      supabase.from('profiles').select('id, name, company_name, account_type').in('id', profileIds),
      supabase.rpc('get_unread_message_counts', { p_user_id: user.id }),
    ])

    const unreadByConv = new Map<string, number>(
      (unreadRows ?? []).map((row) => [
        row.conversation_id as string,
        Number(row.unread_count),
      ]),
    )

    const listingMap = new Map(
      (listings ?? []).map((l) => [
        l.id,
        l as { id: string; title: string; video_poster: string; make: string; model: string },
      ]),
    )
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]))

    const mapped: ConversationSummary[] = rows.map((row) => {
      const otherId = row.buyer_id === user.id ? row.seller_id : row.buyer_id
      const other = profileMap.get(otherId)
      const listing = listingMap.get(row.listing_id)
      const otherName =
        other?.account_type === 'business' && other.company_name
          ? other.company_name
          : (other?.name ?? tGlobal('common.user'))

      return {
        id: row.id,
        listingId: row.listing_id,
        listingTitle: listing
          ? formatListingTitle({
              make: listing.make,
              model: listing.model,
              title: listing.title,
            })
          : tGlobal('messages.newChat'),
        listingPoster: listing?.video_poster ?? '',
        listingMake: listing?.make ?? '',
        listingModel: listing?.model ?? '',
        buyerId: row.buyer_id,
        sellerId: row.seller_id,
        otherName,
        lastMessageAt: row.last_message_at,
        lastPreview: previewFromConversation(row),
        unreadCount: unreadByConv.get(row.id) ?? 0,
      }
    })

    setConversations(mapped)
    setConversationsError(null)
    setLoadingConversations(false)
  }, [user])

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations])

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!isSupabaseConfigured || !user) return

    const { data } = await supabase
      .from('conversations')
      .select('buyer_id, seller_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (!data) return

    const now = new Date().toISOString()
    const updatePayload =
      data.buyer_id === user.id
        ? { buyer_last_read_at: now }
        : data.seller_id === user.id
          ? { seller_last_read_at: now }
          : null

    if (!updatePayload) return

    await supabase.from('conversations').update(updatePayload).eq('id', conversationId)

    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    )
  }, [user])

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
    void markConversationRead(activeConversationId)
  }, [activeConversationId, loadMessages, markConversationRead])

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
          void markConversationRead(activeConversationId)
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      void supabase.removeChannel(channel)
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [activeConversationId, markConversationRead])

  // Global inbox realtime — badge updates when logged in
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) {
      if (inboxChannelRef.current) {
        void supabase.removeChannel(inboxChannelRef.current)
        inboxChannelRef.current = null
      }
      return
    }

    const channel = supabase
      .channel(`messages-inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const row = payload.new as MessageRow
          const uid = userIdRef.current
          if (!uid || row.sender_id === uid) {
            void refreshConversations()
            return
          }
          if (activeIdRef.current === row.conversation_id) {
            void markConversationRead(row.conversation_id)
            return
          }
          void refreshConversations()
        },
      )
      .subscribe()

    inboxChannelRef.current = channel
    return () => {
      void supabase.removeChannel(channel)
      if (inboxChannelRef.current === channel) inboxChannelRef.current = null
    }
  }, [user?.id, refreshConversations, markConversationRead])

  const openOrCreateConversation = useCallback(
    async (listing: Listing) => {
      if (!isSupabaseConfigured) {
        return { error: tGlobal('errors.supabaseMissing') }
      }
      if (!user) {
        return { error: tGlobal('errors.notLoggedIn') }
      }
      if (!listing.ownerId) {
        return { error: tGlobal('errors.generic') }
      }
      if (listing.ownerId === user.id) {
        return { error: tGlobal('product.hintOwn') }
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
        return { error: createError?.message ?? tGlobal('errors.generic') }
      }

      await refreshConversations()
      return { id: created.id }
    },
    [user, refreshConversations],
  )

  const sendMessage = useCallback(
    async (input: { conversationId: string; text?: string; videoFile?: File | null }) => {
      if (!isSupabaseConfigured || !user) {
        return { error: tGlobal('errors.notLoggedIn') }
      }

      const text = input.text?.trim() ?? ''
      const file = input.videoFile ?? null

      if (!text && !file) {
        return { error: tGlobal('errors.generic') }
      }

      if (file) {
        if (!ALLOWED_MESSAGE_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_MESSAGE_VIDEO_TYPES)[number]) && !file.type.startsWith('video/')) {
          return { error: tGlobal('messages.videoType') }
        }
        if (file.size > MAX_MESSAGE_VIDEO_BYTES) {
          return { error: tGlobal('messages.videoSize') }
        }
      }

      let videoPath: string | null = null

      if (file) {
        let uploadFile: File
        try {
          const { compressVideoForUpload } = await import('../lib/compressVideo')
          uploadFile = await compressVideoForUpload(file)
        } catch {
          return { error: tGlobal('errors.generic') }
        }
        if (uploadFile.size > MAX_MESSAGE_VIDEO_UPLOAD_BYTES) {
          return { error: tGlobal('messages.videoSize') }
        }
        const path = `${user.id}/${input.conversationId}/${crypto.randomUUID()}.mp4`
        const { error: uploadError } = await supabase.storage
          .from('message-videos')
          .upload(path, uploadFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'video/mp4',
          })

        if (uploadError) {
          return { error: uploadError.message || tGlobal('errors.generic') }
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
        return { error: error?.message ?? tGlobal('errors.generic') }
      }

      const mapped = await mapMessage(data as MessageRow)
      setMessages((prev) => {
        if (prev.some((m) => m.id === mapped.id)) return prev
        return [...prev, mapped]
      })
      await markConversationRead(input.conversationId)
      await refreshConversations()
      return {}
    },
    [user, refreshConversations, markConversationRead],
  )

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations],
  )

  const unreadCount = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  )

  const value = useMemo(
    () => ({
      conversations,
      unreadCount,
      loadingConversations,
      conversationsError,
      refreshConversations,
      openOrCreateConversation,
      messages,
      loadingMessages,
      messagesError,
      activeConversationId,
      setActiveConversationId,
      markConversationRead,
      sendMessage,
      getConversation,
    }),
    [
      conversations,
      unreadCount,
      loadingConversations,
      conversationsError,
      refreshConversations,
      openOrCreateConversation,
      messages,
      loadingMessages,
      messagesError,
      activeConversationId,
      markConversationRead,
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
