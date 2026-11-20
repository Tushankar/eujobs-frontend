import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import { Button, Checkbox, CompanyLogo, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { RulesList } from '@/features/agency/components/ContractRules.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useAgreeToAgreementMutation, useGetAgencyAgreementQuery, useGetMyAgenciesQuery, useMembershipActionMutation } from '../api.js'
import styles from './AgreementPage.module.css'

/** The signed PDF as a local blob: URL, so the API's frame policy (helmet) never blocks the inline view. */
function useLocalPdf(url) {
  const [local, setLocal] = useState({ url: null, failed: false })
  useEffect(() => {
    if (!url) return undefined
    let objectUrl = null
    let cancelled = false
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setLocal({ url: objectUrl, failed: false })
      })
      .catch(() => !cancelled && setLocal({ url: null, failed: true }))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])
  return local
}

/**
 * 2026-11-20 (agencies, phase 5): an agency's current agreement before the candidate agrees: the PDF, the rules EU Jobs
 * applies with their clauses, and "I agree" to this version (recorded with their name and today's date).
 */
export default function AgreementPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const { membershipId } = useParams()
  const { data: agreement, error: loadError, refetch } = useGetAgencyAgreementQuery(membershipId)
  const { data: agencies } = useGetMyAgenciesQuery()
  const membership = agencies?.items.find((item) => item.id === membershipId)
  const pdf = useLocalPdf(agreement?.file.url)
  const [agree, { isLoading }] = useAgreeToAgreementMutation()
  const [act, { isLoading: declining }] = useMembershipActionMutation()
  const [checked, setChecked] = useState(false)
  const [missing, setMissing] = useState(false)
  const [failure, setFailure] = useState(null)
  // The day the agreement is recorded with, as the candidate sees it while signing.
  const [today] = useState(() => new Date())
  const agency = membership?.agency.displayName ?? ''

  async function submit(event) {
    event.preventDefault()
    if (!checked) return setMissing(true)
    try {
      await agree({ id: membershipId, version: agreement.version }).unwrap()
      navigate('/candidate/agencies?tab=agencies', { state: { agreed: agency } })
    } catch (error) {
      setFailure(error)
      // A newer version was published meanwhile: show it, to read before agreeing.
      if (error?.data?.error?.params?.reason === 'agreement_changed') {
        setChecked(false)
        refetch()
      }
    }
  }

  async function decline() {
    try {
      await act({ id: membershipId, action: 'decline' }).unwrap()
      navigate('/candidate/agencies?tab=agencies')
    } catch (error) {
      setFailure(error)
    }
  }

  const back = (
    <Link to="/candidate/agencies?tab=agencies" className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      {t('agency:candidate.agreement.back')}
    </Link>
  )
  if (loadError) {
    return (
      <div>
        {back}
        <p className={styles.failure} role="alert">
          {errorText.code(loadError)}
        </p>
      </div>
    )
  }
  if (!agreement || !membership) {
    return (
      <div>
        {back}
        <SkeletonRegion className={styles.layout}>
          <Skeleton width="40%" height={24} />
          <Skeleton shape="block" width="100%" height={420} />
        </SkeletonRegion>
      </div>
    )
  }

  const reason = failure?.data?.error?.params?.reason
  const failureText = reason === 'agreement_changed' ? t('agency:candidate.agreement.changed', { version: failure.data.error.params.version }) : reason === 'already_agreed' ? t('agency:candidate.agreement.already') : failure && errorText.code(failure)
  const canDecline = membership.status === 'awaiting_agreement'

  return (
    <div data-agreement-page>
      {back}
      <header className={styles.head}>
        <CompanyLogo name={agency} id={membership.agency.id} src={membership.agency.logoUrl ?? undefined} size={48} />
        <div>
          <h1 className={styles.title}>{t('agency:candidate.agreement.title', { agency })}</h1>
          <p className={styles.meta}>{t('agency:candidate.agreement.meta', { version: agreement.version, date: format.date(agreement.publishedAt) })}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.document} aria-label={agreement.file.name}>
          <div className={styles.bar}>
            <Icon as={FileText} size={15} />
            <span className={styles.fileName} title={agreement.file.name}>
              {agreement.file.name}
            </span>
            {agreement.file.url && (
              <a href={agreement.file.url} target="_blank" rel="noopener noreferrer" className={styles.open}>
                {t('agency:candidate.agreement.open')}
                <Icon as={ExternalLink} size={13} />
              </a>
            )}
          </div>
          {pdf.url ? (
            <iframe className={styles.pdf} src={`${pdf.url}#navpanes=0&view=FitH`} title={agreement.file.name} data-agreement-pdf />
          ) : pdf.failed || !agreement.file.url ? (
            <p className={styles.noPreview}>{t('agency:candidate.agreement.noPreview')}</p>
          ) : (
            <SkeletonRegion className={styles.pdfSkeleton}>
              {[90, 75, 85, 60, 80].map((width) => (
                <Skeleton key={width} width={`${width}%`} />
              ))}
            </SkeletonRegion>
          )}
        </section>

        <form className={styles.side} onSubmit={submit} noValidate>
          <h2 className={styles.h2}>{t('agency:candidate.agreement.rulesTitle')}</h2>
          <p className={styles.note}>{t('agency:candidate.rulesIntro')}</p>
          <RulesList rules={agreement.rules} />
          <div className={styles.sign}>
            <Checkbox name="agree" checked={checked} onChange={(event) => {
                setChecked(event.target.checked)
                setMissing(false)
              }} aria-invalid={missing || undefined} data-agree-check>
              {t('agency:candidate.agreement.check', { version: agreement.version, agency })}
            </Checkbox>
            {missing && (
              <p className={styles.failure} role="alert">
                {t('agency:candidate.agreement.required')}
              </p>
            )}
            <p className={styles.signed}>{t('agency:candidate.agreement.signed', { name: me?.fullName ?? '', date: format.date(today) })}</p>
            {failureText && (
              <p className={styles.failure} role="alert">
                {failureText}
              </p>
            )}
            <div className={styles.actions}>
              {canDecline && (
                <Button variant="outline" loading={declining} onClick={decline}>
                  {t('agency:candidate.agreement.decline')}
                </Button>
              )}
              <Button type="submit" loading={isLoading} data-agree>
                {t('agency:candidate.agreement.agree')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
