import { useState } from 'react'
import { BriefcaseBusiness, CircleCheck, CircleHelp, GraduationCap, Mail, ShieldCheck } from 'lucide-react'
import { Button, Icon, Panel, TextField } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { cx } from '@/utils/cx.js'
import CheckRow from '../components/CheckRow.jsx'
import SubmitEvidenceModal from '../components/SubmitEvidenceModal.jsx'
import { ACCOUNT_EMAIL, CREDENTIAL_CHECKS, INITIAL_VERIFICATION, VERIFICATION_STORAGE_KEY } from '../data/verification.js'
import styles from './VerificationPage.module.css'

const CHECK_ICONS = { identity: ShieldCheck, academic: GraduationCap, employment: BriefcaseBusiness }
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/
const STATUS_LABEL = { 'not-started': 'Not started', 'in-review': 'In review', verified: 'Verified' }

function normalisePhone(value) {
  return value.replace(/[\s().-]/g, '')
}

/** "Verification": contact confirmation plus three credential checks, with status saved on this device. */
export default function VerificationPage() {
  const [state, setState] = useLocalStorage(VERIFICATION_STORAGE_KEY, INITIAL_VERIFICATION)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [submitting, setSubmitting] = useState(null)

  const normalisedPhone = normalisePhone(state.phone)
  const phoneValid = PHONE_PATTERN.test(normalisedPhone)
  const phoneVerified = phoneValid && normalisedPhone === state.verifiedPhone
  const phoneError =
    phoneTouched && state.phone.trim() !== '' && !phoneValid
      ? 'Enter the number in international format, like +44 7700 900000.'
      : undefined

  const statusOf = (id) => state.checks[id]?.status ?? 'not-started'
  const eligible = CREDENTIAL_CHECKS.every((check) => statusOf(check.id) === 'verified')

  function setCheck(id, entry) {
    setState((current) => ({ ...current, checks: { ...current.checks, [id]: entry } }))
  }

  function handleSubmitEvidence({ evidenceType, fileName }) {
    setCheck(submitting.id, { status: 'in-review', evidenceType, fileName, submittedAt: new Date().toISOString() })
    setSubmitting(null)
  }

  function handleMarkReviewed(id) {
    setCheck(id, { ...state.checks[id], status: 'verified' })
  }

  return (
    <>
      <PageTitle
        eyebrow="Trust, with context"
        title="Verification you can understand."
        description="Confirm basic contact details, see what each level means, and stay in control of any additional checks."
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>Basic verification</h2>
            <p className={styles.sectionLead}>
              Contact checks support account integrity. They do not verify skills, identity, education, or employment.
            </p>

            <div className={styles.contact}>
              <div className={cx(styles.contactRow, styles.emailRow)}>
                <span className={styles.tile}>
                  <Icon as={Mail} size={18} />
                </span>
                <div className={styles.contactBody}>
                  <p className={styles.contactLabel}>Email address</p>
                  <p className={styles.contactValue}>{ACCOUNT_EMAIL}</p>
                </div>
                <PillBadge tone="success" dot>
                  Verified
                </PillBadge>
              </div>

              <div className={cx(styles.contactRow, styles.phoneRow)}>
                <span className={styles.tile}>
                  <Icon as={ShieldCheck} size={18} />
                </span>
                <TextField
                  className={styles.phoneField}
                  label="Phone number"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+44 7700 900000"
                  hint="Use an international format. No code is actually sent."
                  value={state.phone}
                  error={phoneError}
                  onChange={(event) => setState((current) => ({ ...current, phone: event.target.value }))}
                  onBlur={() => setPhoneTouched(true)}
                />
                {phoneVerified ? (
                  <span className={styles.phoneBadge}>
                    <PillBadge tone="success" dot>
                      Verified
                    </PillBadge>
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    className={styles.confirm}
                    disabled={!phoneValid}
                    onClick={() => setState((current) => ({ ...current, verifiedPhone: normalisedPhone }))}
                  >
                    Confirm demo code
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>Profile Verification</h2>
            <p className={styles.sectionLead}>Complete each named check to become eligible for premium job opportunities.</p>

            <div className={styles.banner}>
              <span className={styles.bannerIcon}>
                <Icon as={CircleCheck} size={23} />
              </span>
              <div className={styles.bannerText}>
                <p className={styles.bannerTitle}>Complete all three verification checks</p>
                <p className={styles.bannerLead}>A blue tick appears beside each successfully reviewed category.</p>
              </div>
              <PillBadge tone={eligible ? 'success' : 'neutral'}>{eligible ? 'Eligible' : 'Not yet eligible'}</PillBadge>
            </div>

            <ul className={styles.checks}>
              {CREDENTIAL_CHECKS.map((check) => (
                <CheckRow
                  key={check.id}
                  check={check}
                  icon={CHECK_ICONS[check.id]}
                  entry={state.checks[check.id]}
                  onSubmit={() => setSubmitting(check)}
                  onMarkReviewed={() => handleMarkReviewed(check.id)}
                />
              ))}
            </ul>
          </Panel>
        </div>

        <aside className={styles.side}>
          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>Your current status</h2>
            <dl className={styles.statusList}>
              <div className={styles.statusRow}>
                <dt>Email</dt>
                <dd>
                  <PillBadge tone="success">Verified</PillBadge>
                </dd>
              </div>
              <div className={styles.statusRow}>
                <dt>Phone</dt>
                <dd>
                  <PillBadge tone={phoneVerified ? 'success' : 'neutral'}>
                    {phoneVerified ? 'Verified' : 'Not verified'}
                  </PillBadge>
                </dd>
              </div>
            </dl>
            <div className={styles.credentials}>
              <h3 className={styles.credentialsTitle}>Credential checks</h3>
              <dl className={styles.credentialList}>
                {CREDENTIAL_CHECKS.map((check) => (
                  <div key={check.id} className={styles.credentialRow}>
                    <dt>{check.label}</dt>
                    <dd className={styles[`status-${statusOf(check.id)}`]}>{STATUS_LABEL[statusOf(check.id)]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>

          <section className={styles.badgeNote}>
            <Icon as={CircleHelp} size={20} className={styles.badgeNoteIcon} />
            <h2 className={styles.badgeNoteTitle}>What a badge means</h2>
            <p className={styles.badgeNoteText}>
              A badge represents only the checks named beside it. It is not an endorsement, hiring recommendation, or
              guarantee that profile claims are accurate.
            </p>
          </section>
        </aside>
      </div>

      <SubmitEvidenceModal check={submitting} onSubmit={handleSubmitEvidence} onClose={() => setSubmitting(null)} />
    </>
  )
}
