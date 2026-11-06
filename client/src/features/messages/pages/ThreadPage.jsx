import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, MessageSquareOff, Sparkles } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import Translatable from '@/features/ai/components/Translatable.jsx'
import { CardMessage, RecruiterThreadActions } from '@/features/interviews/components/ThreadCards.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import ReportButton from '@/features/moderation/components/ReportButton.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useMarkReadMutation, useSendMessageMutation, useThread } from '../api.js'
import Counterpart from '../components/Counterpart.jsx'
import MessageForm from '../components/MessageForm.jsx'
import ReplySuggestions from '../components/ReplySuggestions.jsx'
import styles from './ThreadPage.module.css'

// The loading thread's bubbles: whose side, width and lines.
const BUBBLES = [
  [false, 320, 2],
  [true, 240, 1],
  [false, 380, 1],
  [true, 280, 2],
]

/** The thread while it loads: the counterpart, a few bubbles on both sides and the composer, as placeholders. */
function ThreadSkeleton({ role }) {
  return (
    <SkeletonRegion>
      <Panel padding={0} className={styles.thread}>
        <header className={styles.header}>
          <span className={styles.skeletonPerson}>
            <Skeleton shape="circle" width={44} height={44} className={role === 'candidate' ? styles.skeletonLogo : undefined} />
            <span className={styles.skeletonLines}>
              <Skeleton width={160} height={12} />
              <Skeleton width={220} />
            </span>
          </span>
        </header>
        <div className={styles.messages}>
          {BUBBLES.map(([mine, width, lines], index) => (
            <div key={index} className={cx(styles.message, mine && styles.mine)}>
              <Skeleton shape="block" width={width} height={20 + lines * 21} />
              <Skeleton width={96} height={8} />
            </div>
          ))}
        </div>
        <footer className={cx(styles.footer, styles.skeletonComposer)}>
          <Skeleton width={64} height={12} />
          <Skeleton shape="block" height={120} />
          <Skeleton shape="pill" width={80} height={40} className={styles.skeletonSend} />
        </footer>
      </Panel>
    </SkeletonRegion>
  )
}

/**
 * One thread (§3.5): the messages oldest first, read marking while the page is open, and the composer. A candidate
 * without `message_send` reads only and sees the upgrade prompt in place of the composer (M-118).
 */
export default function ThreadPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const dispatch = useDispatch()
  const { conversationId } = useParams()
  const { me } = usePreferences()
  const { data, error, isLoading } = useThread(conversationId)
  const [markRead] = useMarkReadMutation()
  const [send] = useSendMessageMutation()
  const end = useRef(null)
  // A picked suggested reply, handed to the composer.
  const [draft, setDraft] = useState(null)
  const inboxPath = `/${me.role}/messages`
  const unread = data?.conversation.unread ?? 0
  const count = data?.items.length ?? 0
  // §3.23: the latest message of each interview or request shows its live card; the suggested replies answer typed messages only.
  const latestCard = new Map((data?.items ?? []).filter((message) => message.cardId).map((message) => [message.cardId, message.id]))
  const lastText = data?.items.filter((message) => message.kind === 'text').at(-1)
  // An item link (/interviews/:id, /document-requests/:id) opens the thread at its card.
  const focusCard = new URLSearchParams(useLocation().search).get('card')

  // Opening the thread, and every poll that brings new messages, marks the other side's messages read.
  useEffect(() => {
    if (unread > 0) markRead(conversationId)
  }, [unread, conversationId, markRead])

  useEffect(() => {
    const card = focusCard && document.querySelector(`[data-interview-card="${focusCard}"], [data-document-request="${focusCard}"]`)
    ;(card ?? end.current)?.scrollIntoView({ block: card ? 'center' : 'end' })
  }, [count, focusCard])

  const back = (
    <Link to={inboxPath} className={styles.back}>
      <Icon as={ArrowLeft} size={14} strokeWidth={2} />
      {t('messages:thread.back')}
    </Link>
  )
  if (error) {
    return (
      <>
        {back}
        <EmptyState icon={MessageSquareOff} title={t('messages:thread.notFound')} description={t('messages:thread.notFoundText')} />
      </>
    )
  }
  if (isLoading) {
    return (
      <>
        {back}
        <ThreadSkeleton role={me.role} />
      </>
    )
  }
  if (!data) return back

  return (
    <>
      {back}
      <Panel padding={0} className={styles.thread}>
        <header className={cx(styles.header, styles.headerRow)}>
          <Counterpart conversation={data.conversation} role={me.role} size={44} />
          {me.role === 'recruiter' && !data.conversation.closed && <RecruiterThreadActions applications={data.cards?.activeApplications} />}
        </header>
        <ol className={styles.messages} aria-label={t('messages:thread.messages')}>
          {data.items.map((message) => (
            <li key={message.id} className={cx(styles.message, message.mine && styles.mine, message.cardId && styles.cardMessage)} data-message={message.mine ? 'mine' : 'theirs'}>
              {message.cardId ? (
                <CardMessage message={message} latest={latestCard.get(message.cardId) === message.id} cards={data.cards} counterpartName={data.conversation.counterpart?.name ?? ''} />
              ) : message.mine ? (
                <>
                  <p className={styles.bubble}>{message.body}</p>
                  <time className={styles.time} dateTime={message.createdAt}>
                    {format.dateTime(message.createdAt)}
                  </time>
                </>
              ) : (
                // M-144, M-088: the other side's message in the reader's language on demand; time, Translate and Report on one line
                <Translatable
                  source={{ entity: 'message', id: message.id, field: 'body' }}
                  texts={[message.body]}
                  meta={
                    <>
                      <time className={styles.time} dateTime={message.createdAt}>
                        {format.dateTime(message.createdAt)}
                      </time>
                      <ReportButton targetType="message" targetId={message.id} size="sm" className={styles.report} />
                    </>
                  }
                >
                  {([body]) => <p className={styles.bubble}>{body}</p>}
                </Translatable>
              )}
            </li>
          ))}
        </ol>
        <div ref={end} />
        <footer className={styles.footer}>
          {data.conversation.closed ? (
            // P12-Q2, M-189: the other side deleted their account; nobody can reply.
            <div className={styles.locked} data-conversation-closed>
              <Icon as={MessageSquareOff} size={16} />
              <p>{t('messages:thread.closed')}</p>
            </div>
          ) : lacksEntitlement(me, 'message_send') ? (
            <div className={styles.locked} data-upgrade-prompt>
              <Icon as={Lock} size={16} />
              <p>{t('messages:thread.locked')}</p>
              <Button leftIcon={<Icon as={Sparkles} size={14} />} onClick={() => dispatch(openUpgrade('message_send'))}>
                {t('messages:thread.upgrade')}
              </Button>
            </div>
          ) : (
            <>
              <ReplySuggestions conversationId={conversationId} lastMessage={lastText} onPick={setDraft} />
              <MessageForm
                submitLabel={t('messages:thread.send')}
                placeholder={t('messages:form.placeholder')}
                draft={draft}
                onSubmit={(body) => send({ id: conversationId, body }).unwrap()}
                resetOnSuccess
              />
            </>
          )}
        </footer>
      </Panel>
    </>
  )
}
