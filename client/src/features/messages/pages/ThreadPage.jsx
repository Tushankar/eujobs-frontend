import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, MessageSquareOff, Sparkles } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Icon, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useMarkReadMutation, useSendMessageMutation, useThread } from '../api.js'
import Counterpart from '../components/Counterpart.jsx'
import MessageForm from '../components/MessageForm.jsx'
import styles from './ThreadPage.module.css'

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
  const { data, error } = useThread(conversationId)
  const [markRead] = useMarkReadMutation()
  const [send] = useSendMessageMutation()
  const end = useRef(null)
  const inboxPath = `/${me.role}/messages`
  const unread = data?.conversation.unread ?? 0
  const count = data?.items.length ?? 0

  // Opening the thread, and every poll that brings new messages, marks the other side's messages read.
  useEffect(() => {
    if (unread > 0) markRead(conversationId)
  }, [unread, conversationId, markRead])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [count])

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
  if (!data) return back

  return (
    <>
      {back}
      <Panel padding={0} className={styles.thread}>
        <header className={styles.header}>
          <Counterpart conversation={data.conversation} role={me.role} size={44} />
        </header>
        <ol className={styles.messages} aria-label={t('messages:thread.messages')}>
          {data.items.map((message) => (
            <li key={message.id} className={cx(styles.message, message.mine && styles.mine)} data-message={message.mine ? 'mine' : 'theirs'}>
              <p className={styles.bubble}>{message.body}</p>
              <time className={styles.time} dateTime={message.createdAt}>
                {format.dateTime(message.createdAt)}
              </time>
            </li>
          ))}
        </ol>
        <div ref={end} />
        <footer className={styles.footer}>
          {lacksEntitlement(me, 'message_send') ? (
            <div className={styles.locked} data-upgrade-prompt>
              <Icon as={Lock} size={16} />
              <p>{t('messages:thread.locked')}</p>
              <Button leftIcon={<Icon as={Sparkles} size={14} />} onClick={() => dispatch(openUpgrade('message_send'))}>
                {t('messages:thread.upgrade')}
              </Button>
            </div>
          ) : (
            <MessageForm submitLabel={t('messages:thread.send')} onSubmit={(body) => send({ id: conversationId, body }).unwrap()} resetOnSuccess />
          )}
        </footer>
      </Panel>
    </>
  )
}
