import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import AiButton from '@/features/ai/components/AiButton.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePreferences } from '@/lib/preferences.js'
import { useGetReplySuggestionsQuery } from '../api.js'
import styles from './ReplySuggestions.module.css'

const ROLES = ['candidate', 'recruiter']
const BONES = [220, 260, 190]

/** The AI replies to the latest message; a pick goes into the composer through `onPick({ text })`. */
function Suggestions({ conversationId, messageId, onPick }) {
  const { t } = useTranslation()
  const { data, isFetching, isError } = useGetReplySuggestionsQuery({ id: conversationId, messageId })
  // A failure or the daily limit only hides the row; writing by hand still works.
  if (isError || (data && !data.replies.length)) return null
  return (
    <section className={styles.root} aria-label={t('messages:thread.suggestions')} data-reply-suggestions>
      <p className={styles.title}>
        <Icon as={Sparkles} size={14} />
        {t('messages:thread.suggestions')}
        <span className={styles.hint}>{t('messages:thread.suggestionsHint')}</span>
      </p>
      {isFetching || !data ? (
        <SkeletonRegion className={styles.list}>
          {BONES.map((width) => (
            <Skeleton key={width} shape="pill" width={width} height={36} />
          ))}
        </SkeletonRegion>
      ) : (
        <ul className={styles.list}>
          {data.replies.map((reply) => (
            <li key={reply}>
              <button type="button" className={styles.reply} onClick={() => onPick({ text: reply })}>
                {reply}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Suggested replies above the composer while the latest message is the other side's. An AI feature (Plus, Recruiter
 * Plus): without it a locked button opens the upgrade dialog.
 */
export default function ReplySuggestions({ conversationId, lastMessage, onPick }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  if (!lastMessage || lastMessage.mine) return null
  if (lacksEntitlement(me, 'ai', ROLES)) {
    return (
      <div className={styles.root}>
        <AiButton variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={14} />}>
          {t('messages:thread.suggestions')}
        </AiButton>
      </div>
    )
  }
  return <Suggestions conversationId={conversationId} messageId={lastMessage.id} onPick={onPick} />
}
