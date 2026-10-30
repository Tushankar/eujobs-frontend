import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Award, BriefcaseBusiness, CircleCheck, CircleHelp, Earth, GraduationCap, Mail, ShieldCheck } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useErrorText } from '@/lib/forms.js'
import { cx } from '@/utils/cx.js'
import { useGetVerificationQuery, useSubmitEvidenceMutation } from '../api.js'
import CheckRow from '../components/CheckRow.jsx'
import PhoneVerification from '../components/PhoneVerification.jsx'
import SubmitEvidenceModal from '../components/SubmitEvidenceModal.jsx'
import styles from './VerificationPage.module.css'

const CHECK_ICONS = { identity: ShieldCheck, academic: GraduationCap, employment: BriefcaseBusiness }
// P3-D8: a new submission only when there is none yet or the last one was rejected.
const canSubmit = (status) => status === 'not_started' || status === 'rejected'

/** "Verification" (M-003, M-004, M-023, M-166): contact checks, the reviewed checks and the per-entry requests. */
export default function VerificationPage() {
  const { t } = useTranslation()
  const { data: state } = useGetVerificationQuery()
  // Each opening gets a new key, so the dialog starts empty.
  const [request, setRequest] = useState({ value: null, key: 0 })
  const open = (value) => setRequest((current) => ({ value, key: current.key + 1 }))
  const close = () => setRequest((current) => ({ ...current, value: null }))
  if (!state) return null

  const entries = {
    academic: state.entries.academic.map((entry) => ({ id: entry.id, label: `${entry.degree} · ${entry.institution}` })),
    employment: state.entries.employment.map((entry) => ({ id: entry.id, label: `${entry.title} · ${entry.employer}` })),
  }
  const checkStatus = (check) => (!check.required && check.status === 'not_started' ? 'not_needed' : check.status)
  const submitButton = (label, onClick, status) => (
    <Button variant="outline" rightIcon={<Icon as={ArrowRight} size={13} />} aria-label={label} onClick={onClick}>
      {t(status === 'rejected' ? 'verification:resubmit' : 'verification:submit')}
    </Button>
  )

  return (
    <>
      <PageTitle eyebrow={t('verification:eyebrow')} title={t('verification:title')} description={t('verification:description')} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('verification:basic.title')}</h2>
            <p className={styles.sectionLead}>{t('verification:basic.lead')}</p>
            <div className={styles.contact}>
              <div className={cx(styles.contactRow, styles.emailRow)}>
                <span className={styles.tile}>
                  <Icon as={Mail} size={18} />
                </span>
                <div className={styles.contactBody}>
                  <p className={styles.contactLabel}>{t('verification:basic.email')}</p>
                  <p className={styles.contactValue}>{state.email.address}</p>
                </div>
                <PillBadge tone="success" dot>
                  {t('verification:verified')}
                </PillBadge>
              </div>
              <PhoneVerification phone={state.phone} />
            </div>
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('verification:checks.title')}</h2>
            <p className={styles.sectionLead}>{t('verification:checks.lead')}</p>
            <div className={styles.banner}>
              <span className={styles.bannerIcon}>
                <Icon as={CircleCheck} size={23} />
              </span>
              <div className={styles.bannerText}>
                <p className={styles.bannerTitle}>{t('verification:checks.bannerTitle')}</p>
                <p className={styles.bannerLead}>{t('verification:checks.bannerLead')}</p>
              </div>
              <PillBadge tone={state.verified ? 'success' : 'neutral'} dot={state.verified}>
                {state.verified ? t('verification:verified') : t('verification:checks.progress', { done: state.verifiedCount, total: state.requiredCount })}
              </PillBadge>
            </div>
            <ul className={styles.checks}>
              {state.checks.map((check) => {
                const label = t(`verification:check.${check.category}.label`)
                const hasEntries = check.category === 'identity' || entries[check.category].length > 0
                return (
                  <CheckRow
                    key={check.category}
                    icon={CHECK_ICONS[check.category]}
                    title={label}
                    description={t(`verification:check.${check.category}.description`)}
                    accepted={t(`verification:check.${check.category}.accepted`)}
                    note={check.required ? null : t(`verification:check.${check.category}.notNeeded`)}
                    status={checkStatus(check)}
                    latest={check.latest}
                    action={
                      hasEntries &&
                      canSubmit(check.status) &&
                      submitButton(t('verification:submitLabel', { check: label }), () => open({ category: check.category, title: label, evidenceTypes: check.evidenceTypes, entries: entries[check.category] }), check.status)
                    }
                  />
                )
              })}
            </ul>
          </Panel>

          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('verification:rightToWork.title')}</h2>
            <p className={styles.sectionLead}>{t('verification:rightToWork.lead')}</p>
            {state.rightToWork.length === 0 ? (
              <p className={styles.empty}>{t('verification:rightToWork.empty')}</p>
            ) : (
              <ul className={styles.checks}>
                {state.rightToWork.map((entry) => {
                  const label = `${t(`enums:rtwRegion.${entry.region}`)} · ${t(`enums:rtwStatus.${entry.status}`)}`
                  return (
                    <CheckRow
                      key={entry.id}
                      icon={Earth}
                      title={label}
                      status={entry.status}
                      latest={entry.latest}
                      action={canSubmit(entry.status) && submitButton(t('verification:submitLabel', { check: label }), () => open({ category: 'right_to_work', title: label, entryId: entry.id }), entry.status)}
                    />
                  )
                })}
              </ul>
            )}
          </Panel>

          <CertificateChecks certificates={state.certificates} />
        </div>

        <aside className={styles.side}>
          <Panel padding={24}>
            <h2 className={styles.sectionTitle}>{t('verification:summary.title')}</h2>
            <dl className={styles.statusList}>
              <div className={styles.statusRow}>
                <dt>{t('verification:summary.email')}</dt>
                <dd>
                  <PillBadge tone="success">{t('verification:verified')}</PillBadge>
                </dd>
              </div>
              <div className={styles.statusRow}>
                <dt>{t('verification:summary.phone')}</dt>
                <dd>
                  <PillBadge tone={state.phone.verified ? 'success' : 'neutral'}>{t(state.phone.verified ? 'verification:verified' : 'verification:notVerified')}</PillBadge>
                </dd>
              </div>
            </dl>
            <div className={styles.credentials}>
              <h3 className={styles.credentialsTitle}>{t('verification:summary.checks')}</h3>
              <dl className={styles.credentialList}>
                {state.checks.map((check) => (
                  <div key={check.category} className={styles.credentialRow}>
                    <dt>{t(`verification:check.${check.category}.label`)}</dt>
                    <dd className={styles[`status-${checkStatus(check)}`]}>{t(`completeness:verification.status.${checkStatus(check)}`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>

          <section className={styles.badgeNote}>
            <Icon as={CircleHelp} size={20} className={styles.badgeNoteIcon} />
            <h2 className={styles.badgeNoteTitle}>{t('verification:badge.title')}</h2>
            <p className={styles.badgeNoteText}>{t('verification:badge.text')}</p>
          </section>
        </aside>
      </div>

      <SubmitEvidenceModal key={request.key} open={Boolean(request.value)} request={request.value} onSubmitted={close} onClose={close} />
    </>
  )
}

/** M-025: a certificate with a file can be sent for review; it is reviewed from that file. */
function CertificateChecks({ certificates }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [submitEvidence, { isLoading }] = useSubmitEvidenceMutation()
  const [failure, setFailure] = useState(null)

  async function requestReview(certificate) {
    setFailure(null)
    try {
      await submitEvidence({ category: 'certificate', entryId: certificate.id }).unwrap()
    } catch (error) {
      setFailure(error)
    }
  }

  return (
    <Panel padding={24}>
      <h2 className={styles.sectionTitle}>{t('verification:certificates.title')}</h2>
      <p className={styles.sectionLead}>{t('verification:certificates.lead')}</p>
      {failure && (
        <p className={styles.failure} role="alert">
          {errorText.code(failure)}
        </p>
      )}
      {certificates.length === 0 ? (
        <p className={styles.empty}>{t('verification:certificates.empty')}</p>
      ) : (
        <ul className={styles.checks}>
          {certificates.map((certificate) => (
            <CheckRow
              key={certificate.id}
              icon={Award}
              title={`${certificate.name} · ${certificate.issuer}`}
              note={certificate.hasFile ? null : t('verification:certificates.noFile')}
              status={certificate.status}
              latest={certificate.latest}
              action={
                certificate.hasFile &&
                canSubmit(certificate.status) && (
                  <Button variant="outline" loading={isLoading} aria-label={t('verification:certificates.requestLabel', { name: certificate.name })} onClick={() => requestReview(certificate)}>
                    {t('verification:certificates.request')}
                  </Button>
                )
              }
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}
