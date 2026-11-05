import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { ChevronRight, Lock } from 'lucide-react'
import { useGetConfigQuery, useGetMeQuery } from '@/app/api.js'
import { openUpgrade } from '@/app/upgrade.js'
import { Button, Checkbox, Icon, Modal, SelectField, TextareaField } from '@/components/ui'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { useGetCvVersionsQuery } from '@/features/candidate/cv/api.js'
import { completenessIcon } from '@/features/candidate/profile/utils/completenessIcons.js'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useApplyMutation } from '../api.js'
import styles from './ApplyFlow.module.css'

/** The checklist share as a ring, with "done/total" in the middle. */
function ProgressRing({ done, total }) {
  const radius = 22
  const length = 2 * Math.PI * radius
  return (
    <span className={styles.ring}>
      <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
        <circle className={styles.ringTrack} cx="26" cy="26" r={radius} />
        <circle className={styles.ringFill} cx="26" cy="26" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - done / total)} />
      </svg>
      <span className={styles.ringValue}>
        {done}/{total}
      </span>
    </span>
  )
}

/**
 * The apply gate (§3.4, M-118, A: candidate N3): the missing checklist items with links and, for Free, the upgrade.
 * Apply stays disabled until both are met; the server checks the same in one request.
 */
function ApplyGate({ completeness, missing, planRequired, onClose }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  // Step numbers only make sense when both the profile and the plan are open.
  const numbered = missing.length > 0 && planRequired
  return (
    <Modal
      open
      onClose={onClose}
      title={t('applications:gate.title')}
      description={t('applications:gate.description')}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('applications:gate.close')}
          </Button>
          <Button variant={planRequired ? 'outline' : 'primary'} leftIcon={<Icon as={Lock} size={14} />} disabled>
            {t('applications:gate.apply')}
          </Button>
          {planRequired && (
            <Button
              onClick={() => {
                onClose()
                dispatch(openUpgrade('apply'))
              }}
            >
              {t('applications:gate.upgrade')}
            </Button>
          )}
        </>
      }
    >
      <div className={styles.gate} data-apply-gate>
        {missing.length > 0 && (
          <div className={styles.progress}>
            <ProgressRing done={completeness.done} total={completeness.total} />
            <div>
              <p className={styles.eyebrow}>{t('completeness:title')}</p>
              <p className={styles.progressText}>{t('completeness:progress', { done: completeness.done, total: completeness.total })}</p>
            </div>
          </div>
        )}
        {missing.length > 0 && (
          <section className={styles.step}>
            <div className={styles.stepHeader}>
              {numbered && <span className={styles.stepNumber}>1</span>}
              <h3 className={styles.heading}>{t('applications:gate.missingTitle')}</h3>
              <span className={styles.count}>{t('applications:gate.openCount', { count: missing.length })}</span>
            </div>
            <p className={styles.text}>{t('applications:gate.missingText')}</p>
            <ul className={styles.missing}>
              {missing.map((item) => (
                <li key={item.key} data-missing-item={item.key}>
                  <Link to={item.route} className={styles.missingLink} onClick={onClose}>
                    <span className={styles.itemIcon}>
                      <Icon as={completenessIcon(item.key)} size={16} />
                    </span>
                    <span className={styles.itemLabel}>{t(`completeness:items.${item.key}`)}</span>
                    <Icon as={ChevronRight} size={16} className={styles.chevron} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {planRequired && (
          <section className={styles.step} data-plan-required>
            <div className={styles.stepHeader}>
              {numbered && <span className={styles.stepNumber}>2</span>}
              <h3 className={styles.heading}>{t('applications:gate.planTitle')}</h3>
            </div>
            <div className={styles.plan}>
              <span className={styles.planIcon}>
                <Icon as={Lock} size={18} />
              </span>
              <div>
                <p className={styles.planText}>{t('applications:gate.planText')}</p>
                <p className={styles.text}>{t('billing:upgrade.description')}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}

/** M-073: the CV version (live by default), an optional cover note and the required consent. */
function ApplyDialog({ job, onClose, onApplied }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: cv } = useGetCvVersionsQuery()
  const [apply, { isLoading }] = useApplyMutation()
  const { values, set, errors, failure, run } = useFormState({ cvVersionId: '', coverNote: '', consent: false })
  const max = config?.limits.application.coverNote.max
  const company = job.company.displayName
  const cvVersionId = values.cvVersionId || cv?.liveVersionId || ''

  async function handleSubmit(event) {
    event.preventDefault()
    const sent = await run({ coverNote: check.maxLength(values.coverNote, max), consent: values.consent ? undefined : { key: 'required' } }, () =>
      // Before the CV list has loaded no version is sent, and the server uses the live one (M-073).
      apply({ jobId: job.id, cvVersionId: cvVersionId || undefined, coverNote: values.coverNote.trim(), consent: values.consent }).unwrap(),
    )
    if (sent) onApplied()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('applications:dialog.title', { title: job.title })}
      description={t('applications:dialog.description', { company })}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('applications:dialog.cancel')}
          </Button>
          <Button type="submit" form="apply-form" loading={isLoading}>
            {t('applications:dialog.submit')}
          </Button>
        </>
      }
    >
      <form id="apply-form" className={styles.form} onSubmit={handleSubmit} noValidate data-apply-dialog>
        <SelectField
          label={t('applications:dialog.cv')}
          name="cvVersionId"
          value={cvVersionId}
          error={errorText.field('cvVersionId', errors.cvVersionId)}
          options={(cv?.items ?? []).map((version) => ({
            value: version.id,
            label: t(version.live ? 'applications:dialog.cvLive' : 'applications:dialog.cvOption', { number: version.number, name: version.originalName }),
          }))}
          onChange={(event) => set('cvVersionId', event.target.value)}
        />
        <TextareaField
          label={t('applications:dialog.coverNote')}
          name="coverNote"
          rows={5}
          hint={max ? t('applications:dialog.coverNoteHint', { count: values.coverNote.trim().length, max }) : undefined}
          value={values.coverNote}
          error={errorText.field('coverNote', errors.coverNote)}
          data-autofocus
          onChange={(event) => set('coverNote', event.target.value)}
        />
        <div>
          <Checkbox name="consent" checked={values.consent} onChange={(event) => set('consent', event.target.checked)} aria-invalid={errors.consent ? true : undefined}>
            {t('applications:dialog.consent', { company })}
          </Checkbox>
          {errors.consent && (
            <p className={styles.error} role="alert">
              {errorText.field('consent', errors.consent)}
            </p>
          )}
        </div>
        {failure && (
          <p className={styles.error} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </form>
    </Modal>
  )
}

/** Apply: the gate when the plan or the profile is missing (from /me), else the apply dialog. */
export default function ApplyFlow({ job, onClose, onApplied }) {
  const { data: me } = useGetMeQuery()
  if (!me) return null
  const missing = me.completeness.items.filter((item) => !item.done)
  const planRequired = lacksEntitlement(me, 'apply')
  if (missing.length > 0 || planRequired) return <ApplyGate completeness={me.completeness} missing={missing} planRequired={planRequired} onClose={onClose} />
  return <ApplyDialog job={job} onClose={onClose} onApplied={onApplied ?? onClose} />
}

/** Apply now, or Applied (a link to Applications) once the candidate has an active application to the job. */
export function ApplyButton({ job, size, fullWidth, className }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (job.application) {
    return (
      <Button as={Link} to="/candidate/applications" variant="secondary" size={size} fullWidth={fullWidth} className={className} aria-label={t('applications:apply.appliedLabel', { title: job.title })} data-applied>
        {t('applications:apply.applied')}
      </Button>
    )
  }
  if (job.accepting === false) {
    return (
      <Button size={size} fullWidth={fullWidth} className={className} disabled>
        {t('applications:apply.closed')}
      </Button>
    )
  }
  return (
    <>
      <Button size={size} fullWidth={fullWidth} className={className} aria-label={t('applications:apply.label', { title: job.title, company: job.company.displayName })} data-apply={job.id} onClick={() => setOpen(true)}>
        {t('applications:apply.button')}
      </Button>
      {open && <ApplyFlow job={job} onClose={() => setOpen(false)} />}
    </>
  )
}
