import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, Check, CircleSlash, Copy, Link2, SearchX } from 'lucide-react'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import Copyright from '@/components/layout/Copyright.jsx'
import LanguagePicker from '@/components/layout/LanguagePicker.jsx'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { errorCode } from '@/app/api.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetPublicCertificateQuery } from '@/features/learning/api.js'
import CertificatePreview from '@/features/learning/components/CertificatePreview.jsx'
import styles from './CertificatePage.module.css'

const TONE = { valid: 'success', revoked: 'danger', no_longer_valid: 'neutral' }
const ICON = { valid: BadgeCheck, revoked: CircleSlash, no_longer_valid: CircleSlash, not_found: SearchX, error: SearchX }
// The issuer never changes with the language (M-193).
const BRAND = 'EU Jobs'

/** Copy link and Copy code, each saying "copied" for two seconds. */
function CopyButtons({ code }) {
  const { t } = useTranslation('certificates')
  const [copied, setCopied] = useState(null)
  async function copy(kind, value) {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  }
  return (
    <div className={styles.actions}>
      <Button variant="outline" leftIcon={<Icon as={copied === 'link' ? Check : Link2} size={15} />} onClick={() => copy('link', window.location.href)}>
        {t(copied === 'link' ? 'linkCopied' : 'copyLink')}
      </Button>
      <Button variant="outline" leftIcon={<Icon as={copied === 'code' ? Check : Copy} size={15} />} onClick={() => copy('code', code)}>
        {t(copied === 'code' ? 'codeCopied' : 'copyCode')}
      </Button>
    </div>
  )
}

/** The certificate record: holder, course, level, lessons, category, dates, code and issuer. */
function Details({ certificate }) {
  const { t } = useTranslation('certificates')
  const format = useFormat()
  const facts = [
    ['course', certificate.courseTitle],
    certificate.courseLevel && ['level', t(`enums:courseLevel.${certificate.courseLevel}`)],
    certificate.lessonCount && ['lessons', format.number(certificate.lessonCount)],
    certificate.courseCategory && ['category', certificate.courseCategory],
    ['issued', format.date(certificate.issuedAt, { dateStyle: 'long' })],
    certificate.revokedAt && ['revoked', format.date(certificate.revokedAt, { dateStyle: 'long' })],
    ['code', certificate.code],
    ['issuer', BRAND],
  ].filter(Boolean)
  return (
    <Panel padding={24} className={styles.details} aria-labelledby="certificate-holder">
      <div>
        <h2 id="certificate-holder" className={styles.label}>
          {t('awardedTo')}
        </h2>
        <p className={styles.holder} data-certificate-holder>
          {certificate.holderName}
        </p>
      </div>
      <dl className={styles.facts}>
        {facts.map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <CopyButtons code={certificate.code} />
    </Panel>
  )
}

/** While the record loads: the banner, the preview and the details as placeholders. */
function CheckSkeleton() {
  return (
    <SkeletonRegion className={styles.main}>
      <Panel padding={24} className={styles.banner}>
        <Skeleton shape="circle" width={40} height={40} />
        <div className={styles.bannerText}>
          <Skeleton width={180} height={12} />
          <Skeleton width="min(360px, 70vw)" height={26} />
          <Skeleton width="min(480px, 75vw)" />
        </div>
      </Panel>
      <div className={styles.layout}>
        <Panel padding={16} className={styles.figure}>
          <Skeleton shape="block" className={styles.previewSkeleton} />
        </Panel>
        <Panel padding={24} className={styles.details}>
          <Skeleton width={90} height={12} />
          <Skeleton width={200} height={24} />
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} width="100%" />
          ))}
        </Panel>
      </div>
    </SkeletonRegion>
  )
}

/**
 * /certificates/:code (M-105, U17, C18): the public check, signed in or not, in the visitor's language. A verdict
 * banner (Valid, Revoked, No longer valid or not found, with when it was checked), the certificate as issued and its
 * record, and what a certificate confirms. No Figma frame (OD16); design canvas 2026-11-25.
 */
export default function CertificatePage() {
  const { t } = useTranslation('certificates')
  const format = useFormat()
  const errorText = useErrorText()
  const { code } = useParams()
  const { data, error, isLoading, fulfilledTimeStamp } = useGetPublicCertificateQuery(code)
  useDocumentTitle(t('title'))
  const notFound = errorCode(error) === 'NOT_FOUND' || errorCode(error) === 'VALIDATION_FAILED'
  const state = data?.status ?? (notFound ? 'not_found' : 'error')
  const verdict = {
    valid: [t('headline.valid'), t('lead.valid', { name: data?.holderName })],
    revoked: [t('headline.revoked'), data?.revokedAt && t('lead.revoked', { date: format.date(data.revokedAt, { dateStyle: 'long' }) })],
    no_longer_valid: [t('headline.no_longer_valid'), t('noLongerValid')],
    not_found: [t('notFound.title'), t('notFound.text')],
    error: [errorText.code(error)],
  }[state]
  const showRecord = data && data.status !== 'no_longer_valid'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" aria-label={t('shell:brandHome')}>
          <BrandLogo height={36} />
        </Link>
        <LanguagePicker />
      </header>

      {isLoading ? (
        <CheckSkeleton />
      ) : (
        <main className={styles.main} data-certificate-check={state}>
          <Panel padding={24} className={styles.banner} aria-labelledby="certificate-verdict">
            <Icon as={ICON[state]} size={40} className={styles[state]} />
            <div className={styles.bannerText}>
              <p className={styles.eyebrow}>
                {t('title')} · {code.toUpperCase()}
              </p>
              <h1 id="certificate-verdict" className={styles.heading}>
                {verdict[0]}
              </h1>
              {verdict[1] && <p className={styles.lead}>{verdict[1]}</p>}
            </div>
            {data && (
              <div className={styles.bannerMeta}>
                <PillBadge tone={TONE[data.status]} data-certificate-status={data.status}>
                  {t(`status.${data.status}`)}
                </PillBadge>
                {fulfilledTimeStamp && <span>{t('checkedAt', { time: format.dateTime(fulfilledTimeStamp) })}</span>}
              </div>
            )}
          </Panel>

          {showRecord && (
            <div className={styles.layout}>
              <Panel as="figure" padding={16} className={styles.figure}>
                <CertificatePreview certificate={data} revoked={data.status === 'revoked'} />
                <figcaption className={styles.caption}>{t('previewCaption')}</figcaption>
              </Panel>
              <Details certificate={data} />
            </div>
          )}

          <Panel padding={24} className={styles.about}>
            <div>
              <h2 className={styles.aboutTitle}>{t('aboutTitle')}</h2>
              <p className={styles.text}>{t('note')}</p>
            </div>
            <div>
              <h2 className={styles.aboutTitle}>{t('howTitle')}</h2>
              <p className={styles.text}>{t('how')}</p>
            </div>
          </Panel>
        </main>
      )}

      <footer className={styles.footer}>
        <Copyright />
      </footer>
    </div>
  )
}
