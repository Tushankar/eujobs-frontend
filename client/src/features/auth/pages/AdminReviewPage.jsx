import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CircleCheck, FileText, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { refreshMe } from '@/app/session.js'
import { Avatar, Button, CompanyLogo, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useSubmitOnboardingMutation } from '../api.js'
import StepHeading from '../components/StepHeading.jsx'
import { stepPath } from '../data/onboarding.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import styles from './AdminReviewPage.module.css'

const STATUS_TONES = { pending_review: 'warning', rejected: 'danger', suspended: 'danger' }

/** A value with a green check when the check passed. */
function Checked({ ok, children, note }) {
  return (
    <>
      <span className={styles.value}>{children}</span>
      {ok && (
        <span className={styles.check}>
          <Icon as={CircleCheck} size={14} />
          {note}
        </span>
      )}
    </>
  )
}

/**
 * Onboarding step 5 of 5 (M-151, M-152, M-165): the review status. Pending waits for an admin; rejected shows the
 * reason with Edit and Resubmit; suspended shows the blocked message. Approval opens the workspace (the route
 * loader sends an approved recruiter there).
 */
export default function AdminReviewPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { state } = useOnboarding()
  const [submit, { isLoading }] = useSubmitOnboardingMutation()
  const [failure, setFailure] = useState(null)
  const { status, decision, account, company } = state
  const blocked = status === 'suspended'
  const review = (key, params) => t(`auth:onboarding.review.${key}`, params)

  async function resubmit() {
    setFailure(null)
    try {
      await submit().unwrap()
      await refreshMe()
    } catch (error) {
      setFailure(error)
    }
  }

  const rows = [
    {
      key: 'applicant',
      value: (
        <span className={styles.person}>
          <Avatar name={account.fullName} size={28} />
          <span className={styles.value}>{[account.fullName, account.jobTitle].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { key: 'email', value: <Checked ok={account.emailVerified} note={review('values.verified')}>{account.email}</Checked> },
    {
      key: 'phone',
      value: (
        <Checked ok={account.phone.verified} note={review('values.phoneConfirmed')}>
          {account.phone.e164}
        </Checked>
      ),
    },
    {
      key: 'documents',
      value: (
        <ul className={styles.documents}>
          {state.documents.map((document) => (
            <li key={document.id}>
              <Icon as={FileText} size={14} />
              <span className={styles.value}>{t(`auth:onboarding.verify.checklist.${document.type}`)}</span>
              <span className={styles.fileName}>{document.name}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'access',
      value: (
        <span className={styles.access}>
          <Icon as={Lock} size={14} />
          {review(blocked ? 'values.blocked' : 'values.locked')}
        </span>
      ),
    },
  ]

  return (
    <>
      <StepHeading title={review('title')} description={review('description')} />

      <section className={styles.status}>
        <Icon as={status === 'pending_review' ? ShieldCheck : ShieldAlert} size={28} className={styles.statusIcon} />
        <div className={styles.statusBody}>
          <div className={styles.statusHead}>
            <h3 className={styles.statusTitle}>{review(`${status}Title`)}</h3>
            <PillBadge tone={STATUS_TONES[status]} dot>
              {review(`badge.${status}`)}
            </PillBadge>
          </div>
          <p className={styles.statusText}>{review(`${status}Text`)}</p>
          {status === 'pending_review' && state.submittedAt && <p className={styles.meta}>{review('submittedOn', { date: format.date(state.submittedAt) })}</p>}
          {status !== 'pending_review' && decision?.reason && (
            <div className={styles.reason}>
              <p>{review('reason', { reason: decision.reason })}</p>
              <p className={styles.meta}>{review('decidedOn', { date: format.date(decision.at) })}</p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.application}>
        <h3 className={styles.sectionTitle}>{review('applicationTitle')}</h3>
        {company && (
          <div className={styles.company}>
            <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={44} />
            <div className={styles.companyText}>
              <p className={styles.companyName}>{company.legalName}</p>
              <p className={styles.companyMeta}>
                {[company.industry, company.location && t('common:city.value', { city: company.location.city, country: format.country(company.location.countryCode) })]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
        )}
        <dl className={styles.rows}>
          {rows.map((row) => (
            <div key={row.key} className={styles.row}>
              <dt>{review(`summary.${row.key}`)}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {failure && <p role="alert" className={styles.error}>{errorText.code(failure)}</p>}
      <div className={styles.actions}>
        {status === 'rejected' ? (
          <>
            <Button as={Link} to={stepPath('company')} variant="outline">
              {review('edit')}
            </Button>
            <Button loading={isLoading} onClick={resubmit}>
              {review('resubmit')}
            </Button>
          </>
        ) : (
          <>
            <Button as={Link} to="/recruiter/sign-in" variant="outline">
              {review('signIn')}
            </Button>
            <Button disabled rightIcon={<Icon as={Lock} size={14} />}>
              {review('toolsLocked')}
            </Button>
          </>
        )}
      </div>
    </>
  )
}
