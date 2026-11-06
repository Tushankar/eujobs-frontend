import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarClock, CalendarPlus, Link2, MapPin, Mic, Phone, Sparkles, Video } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon } from '@/components/ui'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { useMarkSeen } from '@/features/notifications/api.js'
import { downloadFromApi } from '@/lib/download.js'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { joinOpen, useAskOtherTimesMutation, useCancelInterviewMutation, usePickSlotMutation, useRequestRescheduleMutation } from '../api.js'
import { useWhen } from '../useWhen.js'
import OfferDialog from './OfferDialog.jsx'
import { NoShowDialog, NoteDialog, NotesDialog, OutcomeDialog } from './SmallDialogs.jsx'
import styles from './Cards.module.css'

const MODE_ICONS = { video: Video, phone: Phone, in_person: MapPin, link: Link2 }
const STATUS_TONE = { offered: 'info', other_times: 'neutral', confirmed: 'success', cancelled: 'neutral', expired: 'neutral', completed: 'violet' }

/** A clock that ticks every 30 s, so Join opens and slots close without a reload. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/** How the interview takes place, for this viewer (P11d-Q1, Q23). */
function ModeLine({ interview, role }) {
  const { t } = useTranslation()
  const text =
    interview.mode === 'phone'
      ? role === 'recruiter'
        ? interview.phone
          ? t('interviews:mode.phoneRecruiter', { phone: interview.phone })
          : t('interviews:mode.phone')
        : t('interviews:mode.phoneCandidate')
      : t(`interviews:mode.${interview.mode}`)
  return (
    <p className={styles.line} data-interview-mode={interview.mode}>
      <Icon as={MODE_ICONS[interview.mode]} size={16} />
      <span>
        {text}
        {interview.mode === 'in_person' && <> · {interview.address}</>}
        {interview.mode === 'link' && (
          <>
            {' · '}
            <a className={styles.link} href={interview.link} target="_blank" rel="noreferrer noopener">
              {interview.link}
            </a>
          </>
        )}
      </span>
    </p>
  )
}

/**
 * The live interview card in the thread (§3.23, P11d-Q16): the candidate picks a slot or asks for other times, joins,
 * adds it to the calendar or asks to reschedule; the recruiter reschedules, cancels, records the outcome and opens the
 * AI notes. Locked actions (Recruiter Plus) keep their label and open the upgrade dialog (P11d-Q27).
 */
export default function InterviewCard({ interview, counterpartName }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const when = useWhen()
  const now = useNow()
  const { data: config } = useGetConfigQuery()
  const role = me.role
  const recruiter = role === 'recruiter'
  const [dialog, setDialog] = useState(null)
  const [choice, setChoice] = useState(null)
  const [pick, { isLoading: picking }] = usePickSlotMutation()
  const [askOtherTimes] = useAskOtherTimesMutation()
  const [requestReschedule] = useRequestRescheduleMutation()
  const [cancel] = useCancelInterviewMutation()
  useMarkSeen('interview', interview.id)
  const cutoff = config?.limits.interviews.pickCutoffMs ?? 0
  const pickable = (slot) => new Date(slot.startAt).getTime() - now >= cutoff
  const started = interview.startAt && new Date(interview.startAt).getTime() <= now
  const open = joinOpen(interview, now)
  const plusProps = { entitlement: 'interviews', roles: ['recruiter'] }
  const noteMax = config?.limits.interviews.note.max ?? 500
  const close = () => setDialog(null)

  return (
    <article className={styles.card} data-interview-card={interview.id} data-interview-status={interview.status}>
      <header className={styles.head}>
        <Icon as={CalendarClock} size={18} className={styles.headIcon} />
        <div className={styles.headText}>
          <p className={styles.title}>{t('interviews:card.title')}</p>
          <p className={styles.sub}>{interview.job.title}</p>
        </div>
        <StatusBadge tone={STATUS_TONE[interview.status]}>{t(`enums:interviewStatus.${interview.status}`)}</StatusBadge>
      </header>

      <ModeLine interview={interview} role={role} />
      {interview.aiNotes && (
        <p className={styles.line}>
          <Icon as={Sparkles} size={16} />
          <span>{t('interviews:card.aiNotesRequested')}</span>
        </p>
      )}

      {interview.status === 'offered' &&
        (recruiter ? (
          <>
            <ul className={styles.rows}>
              {interview.slots.map((slot) => (
                <li key={slot.startAt} className={styles.row}>
                  <span className={styles.rowMain}>{when(slot.startAt, slot.minutes)}</span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{t('interviews:card.waiting', { name: counterpartName })}</p>
          </>
        ) : (
          <>
            <p className={styles.hint}>{t('interviews:card.pickHint')}</p>
            <ul className={styles.rows} role="radiogroup" aria-label={t('interviews:card.slots')}>
              {interview.slots.map((slot) => (
                <li key={slot.startAt} className={styles.row}>
                  <label className={cx(styles.slot, !pickable(slot) && styles.slotDisabled)}>
                    <input type="radio" name={`slot-${interview.id}`} value={slot.startAt} disabled={!pickable(slot)} checked={choice === slot.startAt} onChange={() => setChoice(slot.startAt)} data-slot={slot.startAt} />
                    <span className={styles.rowMain}>
                      {when(slot.startAt, slot.minutes)}
                      {!pickable(slot) && <span className={styles.rowMeta}>{t('interviews:card.slotClosed')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <Button disabled={!choice} loading={picking} onClick={() => pick({ id: interview.id, startAt: choice })} data-pick-slot>
                {t('interviews:card.confirm')}
              </Button>
              <Button variant="outline" onClick={() => setDialog('otherTimes')} data-other-times>
                {t('interviews:card.otherTimes')}
              </Button>
            </div>
          </>
        ))}

      {interview.status === 'other_times' && (
        <>
          <p className={styles.hint}>{recruiter ? t('interviews:card.otherTimesAsked', { name: counterpartName }) : t('interviews:card.otherTimesSent')}</p>
          {interview.otherTimesNote && <p className={styles.note}>{interview.otherTimesNote}</p>}
        </>
      )}

      {interview.status === 'confirmed' && (
        <>
          <p className={styles.line}>
            <Icon as={CalendarClock} size={16} />
            <span className={styles.when} data-interview-when>
              {when(interview.startAt, interview.minutes)}
            </span>
          </p>
          {interview.rescheduleRequest && (
            <>
              <p className={styles.hint}>{recruiter ? t('interviews:card.rescheduleAsked', { name: counterpartName }) : t('interviews:card.rescheduleSent')}</p>
              <p className={styles.note}>{interview.rescheduleRequest.note}</p>
            </>
          )}
          {interview.mode === 'video' && !open && !started && <p className={styles.hint}>{t('interviews:card.joinOpens')}</p>}
          {interview.recording.status === 'processing' && recruiter && (
            <p className={styles.recording}>
              <Icon as={Mic} size={14} /> {t('interviews:card.notesPreparing')}
            </p>
          )}
        </>
      )}

      {interview.status === 'cancelled' && interview.cancelReason && <p className={styles.note}>{interview.cancelReason}</p>}
      {interview.status === 'expired' && <p className={styles.hint}>{t('interviews:card.expired')}</p>}
      {interview.status === 'completed' && recruiter && interview.outcome && (
        <p className={styles.line} data-interview-outcome={interview.outcome.result}>
          <span>
            <strong>{t(`enums:interviewOutcome.${interview.outcome.result}`)}</strong>
            {interview.outcome.note && <span className={styles.rowMeta}>{interview.outcome.note}</span>}
          </span>
        </p>
      )}

      <div className={styles.actions}>
        {interview.status === 'confirmed' && interview.mode === 'video' && (
          <Button as={open ? Link : 'button'} to={open ? `/${role}/interviews/${interview.id}/call` : undefined} disabled={!open} leftIcon={<Icon as={Video} size={14} />} data-join-interview>
            {t('interviews:card.join')}
          </Button>
        )}
        {interview.status === 'confirmed' && (
          <Button variant="outline" leftIcon={<Icon as={CalendarPlus} size={14} />} onClick={() => downloadFromApi(`/interviews/${interview.id}/calendar`)} data-add-calendar>
            {t('interviews:card.addToCalendar')}
          </Button>
        )}
        {!recruiter && interview.status === 'confirmed' && !started && !interview.rescheduleRequest && (
          <Button variant="ghost" onClick={() => setDialog('askReschedule')} data-ask-reschedule>
            {t('interviews:card.askReschedule')}
          </Button>
        )}
        {recruiter && interview.status === 'confirmed' && started && (
          <Button onClick={() => setDialog('outcome')} data-record-outcome>
            {t('interviews:card.recordOutcome')}
          </Button>
        )}
        {recruiter && interview.hasNotes && (
          <Button variant="outline" leftIcon={<Icon as={Sparkles} size={14} />} onClick={() => setDialog('notes')} data-open-notes>
            {t('interviews:card.notes')}
          </Button>
        )}
        {recruiter && ['offered', 'other_times', 'confirmed', 'expired'].includes(interview.status) && !(interview.status === 'confirmed' && started) && (
          <PlanButton {...plusProps} variant={interview.status === 'confirmed' || interview.status === 'offered' ? 'outline' : 'primary'} onClick={() => setDialog('reschedule')} data-reschedule>
            {t(interview.status === 'confirmed' || interview.status === 'offered' ? 'interviews:card.reschedule' : 'interviews:card.offerNew')}
          </PlanButton>
        )}
        {recruiter && ['offered', 'other_times', 'confirmed', 'expired'].includes(interview.status) && (
          <Button variant="ghost" onClick={() => setDialog('cancel')} data-cancel-interview>
            {t('interviews:card.cancel')}
          </Button>
        )}
      </div>

      {dialog === 'otherTimes' && (
        <NoteDialog
          title={t('interviews:otherTimes.title')}
          description={t('interviews:otherTimes.description')}
          label={t('interviews:otherTimes.label')}
          submitLabel={t('interviews:otherTimes.send')}
          max={noteMax}
          send={(note) => askOtherTimes({ id: interview.id, note }).unwrap()}
          onClose={close}
        />
      )}
      {dialog === 'askReschedule' && (
        <NoteDialog
          title={t('interviews:askReschedule.title')}
          description={t('interviews:askReschedule.description')}
          label={t('interviews:askReschedule.label')}
          submitLabel={t('interviews:askReschedule.send')}
          max={noteMax}
          send={(note) => requestReschedule({ id: interview.id, note }).unwrap()}
          onClose={close}
        />
      )}
      {dialog === 'cancel' && (
        <NoteDialog
          title={t('interviews:cancel.title')}
          description={t('interviews:cancel.description', { name: counterpartName })}
          label={t('interviews:cancel.label')}
          submitLabel={t('interviews:cancel.confirm')}
          tone="danger"
          required={false}
          max={config?.limits.interviews.reason.max ?? 500}
          send={(reason) => cancel({ id: interview.id, ...(reason && { reason }) }).unwrap()}
          onClose={close}
        />
      )}
      {dialog === 'reschedule' && <OfferDialog interview={interview} onClose={close} />}
      {dialog === 'outcome' && (
        <OutcomeDialog
          interview={interview}
          candidateName={counterpartName}
          onClose={close}
          onNext={(result) => setDialog({ another_round: 'nextRound', did_not_attend: 'noShow' }[result] ?? null)}
        />
      )}
      {dialog === 'noShow' && <NoShowDialog interview={interview} candidateName={counterpartName} onReschedule={() => setDialog('nextRound')} onClose={close} />}
      {dialog === 'nextRound' && <OfferDialog applicationId={interview.applicationId} onClose={close} />}
      {dialog === 'notes' && <NotesDialog interview={interview} candidateName={counterpartName} onClose={close} />}
    </article>
  )
}
