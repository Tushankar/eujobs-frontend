import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, CalendarPlus, FileText } from 'lucide-react'
import { Icon } from '@/components/ui'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import DocumentRequestCard from './DocumentRequestCard.jsx'
import { useWhen } from '../useWhen.js'
import InterviewCard from './InterviewCard.jsx'
import OfferDialog from './OfferDialog.jsx'
import RequestDocumentsDialog from './RequestDocumentsDialog.jsx'
import styles from './Cards.module.css'

/** An earlier step of an interview or a document request: one short line (the card itself shows the latest state). */
export function EventLine({ message }) {
  const { t } = useTranslation()
  const when = useWhen()
  const params = message.params ?? {}
  const text =
    message.kind === 'document_request'
      ? t(`interviews:events.document_request.${message.event}`)
      : t(`interviews:events.interview.${message.event}`, { when: params.startAt ? when(params.startAt, params.minutes) : '' })
  return (
    <p className={styles.event} data-event={`${message.kind}.${message.event}`}>
      <Icon as={message.kind === 'document_request' ? FileText : CalendarClock} size={13} />
      <span>{text}</span>
    </p>
  )
}

/**
 * A card message of the thread (§3.23, P11d-Q16): the latest message of an interview or request shows its live card,
 * earlier ones an event line.
 */
export function CardMessage({ message, latest, cards, counterpartName }) {
  if (!latest) return <EventLine message={message} />
  if (message.kind === 'interview') {
    const interview = cards.interviews.find((item) => item.id === message.cardId)
    return interview ? <InterviewCard interview={interview} counterpartName={counterpartName} /> : <EventLine message={message} />
  }
  const request = cards.documentRequests.find((item) => item.id === message.cardId)
  return request ? <DocumentRequestCard request={request} /> : <EventLine message={message} />
}

/** The recruiter's thread actions: Schedule interview and Request documents (Recruiter Plus, P11d-Q8). */
export function RecruiterThreadActions({ applications }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(null)
  if (!applications?.length) return null
  return (
    <div className={styles.actions}>
      <PlanButton entitlement="interviews" roles={['recruiter']} variant="outline" size="sm" leftIcon={<Icon as={CalendarPlus} size={14} />} onClick={() => setOpen('interview')} data-schedule-interview>
        {t('interviews:thread.schedule')}
      </PlanButton>
      <PlanButton entitlement="interviews" roles={['recruiter']} variant="outline" size="sm" leftIcon={<Icon as={FileText} size={14} />} onClick={() => setOpen('documents')} data-request-documents>
        {t('interviews:thread.requestDocuments')}
      </PlanButton>
      {open === 'interview' && <OfferDialog applications={applications} onClose={() => setOpen(null)} />}
      {open === 'documents' && <RequestDocumentsDialog applications={applications} onClose={() => setOpen(null)} />}
    </div>
  )
}
