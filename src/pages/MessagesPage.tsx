import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  ALLOWED_MESSAGE_VIDEO_TYPES,
  MAX_MESSAGE_VIDEO_BYTES,
  useMessages,
} from '../context/MessagesContext'
import { useLocale } from '../i18n/LocaleContext'
import { listingPath } from '../lib/listingUrl'

function formatTime(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export function MessagesInboxPage() {
  const { user, loading: authLoading } = useAuth()
  const { conversations, loadingConversations, conversationsError } = useMessages()
  const { t, locale } = useLocale()

  if (authLoading) {
    return (
      <main className="page messages-page">
        <div className="container">
          <p className="state-message">{t('messages.loading')}</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" state={{ from: '/uzenetek' }} replace />
  }

  return (
    <main className="page messages-page">
      <div className="container messages-page__narrow">
        <header className="messages-header">
          <h1>{t('messages.title')}</h1>
          <p>{t('messages.emptyHint')}</p>
        </header>

        {loadingConversations && <p className="state-message">{t('messages.loading')}</p>}
        {conversationsError && !loadingConversations && (
          <p className="form-error">{conversationsError}</p>
        )}
        {!loadingConversations && !conversationsError && conversations.length === 0 && (
          <p className="state-message">{t('messages.empty')}</p>
        )}

        {conversations.length > 0 && (
          <ul className="messages-thread-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link to={`/uzenetek/${c.id}`} className="messages-thread">
                  {c.listingPoster ? (
                    <img src={c.listingPoster} alt="" className="messages-thread__thumb" />
                  ) : (
                    <span className="messages-thread__thumb messages-thread__thumb--empty" />
                  )}
                  <span className="messages-thread__body">
                    <span className="messages-thread__top">
                      <strong>
                        {c.otherName}
                        {c.unreadCount > 0 && (
                          <span className="messages-thread__unread">{c.unreadCount}</span>
                        )}
                      </strong>
                      <time dateTime={c.lastMessageAt}>{formatTime(c.lastMessageAt, locale)}</time>
                    </span>
                    <span className="messages-thread__listing">{c.listingTitle}</span>
                    <span className="messages-thread__preview">{c.lastPreview}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

export function MessagesChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const {
    conversations,
    loadingConversations,
    getConversation,
    messages,
    loadingMessages,
    messagesError,
    setActiveConversationId,
    sendMessage,
    refreshConversations,
  } = useMessages()
  const { t, locale } = useLocale()

  const [text, setText] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const conversation = conversationId ? getConversation(conversationId) : undefined

  useEffect(() => {
    setActiveConversationId(conversationId ?? null)
    return () => setActiveConversationId(null)
  }, [conversationId, setActiveConversationId])

  useEffect(() => {
    if (conversationId && !loadingConversations && !conversation) {
      void refreshConversations()
    }
  }, [conversationId, loadingConversations, conversation, refreshConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (authLoading) {
    return (
      <main className="page messages-page">
        <div className="container">
          <p className="state-message">{t('messages.loading')}</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/belepes"
        state={{ from: conversationId ? `/uzenetek/${conversationId}` : '/uzenetek' }}
        replace
      />
    )
  }

  if (!conversationId) {
    return <Navigate to="/uzenetek" replace />
  }

  if (!loadingConversations && conversations.length > 0 && !conversation) {
    return (
      <main className="page messages-page">
        <div className="container messages-page__narrow">
          <p className="form-error">{t('messages.notFound')}</p>
          <Link to="/uzenetek" className="btn btn--outline">
            {t('messages.back')}
          </Link>
        </div>
      </main>
    )
  }

  const onPickVideo = (file: File | null) => {
    setSendError(null)
    if (!file) {
      setVideoFile(null)
      return
    }
    if (!ALLOWED_MESSAGE_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_MESSAGE_VIDEO_TYPES)[number]) && !file.type.startsWith('video/')) {
      setSendError(t('messages.videoType'))
      setVideoFile(null)
      return
    }
    if (file.size > MAX_MESSAGE_VIDEO_BYTES) {
      setSendError(t('messages.videoSize'))
      setVideoFile(null)
      return
    }
    setVideoFile(file)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setSendError(null)
    const result = await sendMessage({
      conversationId,
      text,
      videoFile,
    })
    setSending(false)
    if (result.error) {
      setSendError(result.error)
      return
    }
    setText('')
    setVideoFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <main className="page messages-page messages-page--chat">
      <div className="container messages-page__chat">
        <header className="messages-chat-header">
          <button type="button" className="product__back" onClick={() => navigate('/uzenetek')}>
            ← {t('messages.back')}
          </button>
          <div className="messages-chat-header__meta">
            <h1>{conversation?.otherName ?? t('messages.title')}</h1>
            {conversation && (
              <p>
                <Link
                  to={listingPath({
                    id: conversation.listingId,
                    title: conversation.listingTitle,
                    make: conversation.listingMake || 'egyeb',
                    model: conversation.listingModel || 'egyeb',
                  })}
                >
                  {conversation.listingTitle}
                </Link>
              </p>
            )}
          </div>
        </header>

        <div className="messages-chat-stream" role="log" aria-live="polite">
          {loadingMessages && <p className="state-message">{t('messages.loading')}</p>}
          {messagesError && !loadingMessages && <p className="form-error">{messagesError}</p>}
          {!loadingMessages && messages.length === 0 && (
            <p className="state-message">{t('messages.empty')}</p>
          )}
          {messages.map((msg) => {
            const mine = msg.senderId === user.id
            return (
              <article
                key={msg.id}
                className={`messages-bubble${mine ? ' messages-bubble--mine' : ''}`}
              >
                {msg.body && <p className="messages-bubble__text">{msg.body}</p>}
                {msg.videoUrl && (
                  <video
                    className="messages-bubble__video"
                    src={msg.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                )}
                {msg.videoPath && !msg.videoUrl && (
                  <p className="messages-bubble__text">{t('messages.loading')}</p>
                )}
                <time className="messages-bubble__time" dateTime={msg.createdAt}>
                  {formatTime(msg.createdAt, locale)}
                </time>
              </article>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <form className="messages-composer" onSubmit={(e) => void handleSubmit(e)}>
          {sendError && <p className="form-error">{sendError}</p>}
          {videoFile && (
            <div className="messages-composer__attach">
              <span>{videoFile.name}</span>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setVideoFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                {t('messages.remove')}
              </button>
            </div>
          )}
          <div className="messages-composer__row">
            <label className="messages-composer__file">
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)}
              />
              <span aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M13 9l4-2v8l-4-2V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="sr-only">{t('messages.attachVideo')}</span>
            </label>
            <input
              type="text"
              className="messages-composer__input"
              placeholder={t('messages.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              disabled={sending}
            />
            <button type="submit" className="btn btn--accent" disabled={sending}>
              {sending ? t('messages.send') : t('messages.send')}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
