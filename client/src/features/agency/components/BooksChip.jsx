import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { hiringPath } from '@/app/roles.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useTalentActionMutation } from '../api.js'
import styles from './BooksChip.module.css'

const TONE = { none: 'neutral', requested: 'info', awaiting_agreement: 'warning', active: 'success' }

/**
 * 2026-11-23 (owner: show where an applicant stands before trying Hired): on an agency job's application row or
 * pipeline card, the applicant's place on the agency's books. A request to join is accepted right here; the other
 * states say what is still missing (Hired needs "On your books").
 */
export default function BooksChip({ books }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [act, { isLoading, error }] = useTalentActionMutation()
  if (!books) return null
  const state = books.status === 'active' && books.agreementPending ? 'agreementPending' : books.status
  return (
    <span className={styles.chip} data-books={state}>
      <PillBadge tone={state === 'agreementPending' ? 'warning' : (TONE[books.status] ?? 'neutral')}>{t(`agency:booksChip.${state}`)}</PillBadge>
      {books.status === 'requested' && books.id && (
        <Button size="sm" className={styles.action} loading={isLoading} onClick={() => act({ id: books.id, action: 'accept' })} data-books-accept>
          {t('agency:booksChip.accept')}
        </Button>
      )}
      {books.status === 'none' && (
        <Button as={Link} to={hiringPath('talent')} size="sm" variant="outline" className={styles.action}>
          {t('agency:booksChip.howTo')}
        </Button>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {errorText.code(error)}
        </span>
      )}
    </span>
  )
}
