import { hiringBase, isHiring } from '@/app/roles.js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useMarkCelebrationSeenMutation } from '@/app/api.js'
import { dismissCelebration } from '@/app/celebrate.js'
import SuccessModal from '@/components/common/SuccessModal.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'

/** The browser checks turn the modals off for older scenarios (e2e/lib/browser.js); real users never set this. */
function celebrationsOff() {
  try {
    return localStorage.getItem('eujobs.e2e.celebrations') === 'off'
  } catch {
    return false
  }
}

/** Where each moment's main button goes; null: no main button (close only). */
const PRIMARY = {
  applied: () => '/candidate/applications',
  plan_started: (role) => `/${role}`,
  certificate: (role, params) => `/${role}/learning/${params.courseId}`,
  course_purchased: (role, params) => `/${role}/learning/${params.courseId}`,
  job_published: (role, params) => `${hiringBase(role)}/find-candidates?jobId=${params.jobId}`,
  interview_confirmed: (role, params) => `/${role}/interviews/${params.interviewId}`,
  hired: (role, params) => `/candidate/applications/${params.applicationId}`,
  profile_complete: () => '/candidate/jobs',
  verification_approved: () => '/candidate/verification',
  onboarding_done: () => '/candidate/jobs',
  account_approved: (role) => `${hiringBase(role)}/jobs/new`,
  candidate_hired: (role, params) => `${hiringBase(role)}/jobs/${params.jobId}`,
  company_submitted: () => null,
  first_alert: () => null,
}

/** The texts of one moment: role-specific steps where the moment differs per role. */
function useContent() {
  const { t, i18n } = useTranslation('success')
  const format = useFormat()
  const { me } = usePreferences()
  return ({ kind, params }) => {
    const role = isHiring(me?.role) ? 'recruiter' : 'candidate'
    const values = {
      ...params,
      plan: params.planKey ? t(`enums:planKey.${params.planKey}`) : '',
      category: params.category ? t(`enums:verificationCategory.${params.category}`).toLowerCase() : '',
      when: params.startAt ? format.dateTime(params.startAt) : '',
      frequency: params.frequency ? t(`jobAlerts:frequency.${params.frequency}`).toLowerCase() : '',
    }
    // Some moments word their steps per role; asking for a key that does not exist would log a missing-key error.
    const roleKey = `${kind}.steps.${role}`
    const steps = t(i18n.exists(roleKey, { ns: 'success' }) ? roleKey : `${kind}.steps`, { ...values, returnObjects: true })
    const to = PRIMARY[kind]?.(role, params)
    return {
      title: t(`${kind}.title`, values),
      message: i18n.exists(`${kind}.message`, { ns: 'success' }) ? t(`${kind}.message`, values) : '',
      steps: Array.isArray(steps) ? steps : [],
      primary: to ? { label: t(`${kind}.primary`, values), to } : null,
    }
  }
}

/**
 * Shows success modals one at a time (owner 2026-11-17): moments from this screen (the celebrate slice) first, then
 * moments decided elsewhere that /me lists until they are seen once (any device).
 */
export default function CelebrationHost() {
  const { t } = useTranslation('success')
  const dispatch = useDispatch()
  const { me } = usePreferences()
  const local = useSelector((state) => state.celebrate.queue)
  const [markSeen] = useMarkCelebrationSeenMutation()
  // Seen server moments stay hidden until /me comes back without them.
  const [seen, setSeen] = useState([])
  const content = useContent()
  const server = (me?.celebrations ?? []).filter((item) => !seen.includes(item.id))
  const current = local[0] ?? server[0]
  if (!current || celebrationsOff()) return null

  function close() {
    if (local[0]) dispatch(dismissCelebration(current.id))
    else {
      setSeen((ids) => [...ids, current.id])
      markSeen(current.id)
    }
  }

  const { title, message, steps, primary } = content(current)
  return (
    <SuccessModal
      key={current.id}
      open
      onClose={close}
      title={title}
      message={message}
      steps={steps}
      stepsTitle={t('nextTitle')}
      primary={primary}
      closeLabel={t(primary ? 'close' : 'done')}
      data-success-kind={current.kind}
    />
  )
}
