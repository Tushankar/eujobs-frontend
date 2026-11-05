import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, CircleSlash, SearchX } from 'lucide-react'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import Copyright from '@/components/layout/Copyright.jsx'
import LanguagePicker from '@/components/layout/LanguagePicker.jsx'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { errorCode } from '@/app/api.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetPublicCertificateQuery } from '@/features/learning/api.js'
import styles from './CertificatePage.module.css'

const TONE = { valid: 'success', revoked: 'danger', no_longer_valid: 'neutral' }
const ICON = { valid: BadgeCheck, revoked: CircleSlash, no_longer_valid: CircleSlash }

/**
 * /certificates/:code (M-105, U17, C18): the public check, signed in or not, in the visitor's language: name,
 * course and date with Valid, Revoked or No longer valid. No Figma frame (OD16): the legal pages' public layout.
 */
export default function CertificatePage() {
  const { t } = useTranslation('certificates')
  const format = useFormat()
  const errorText = useErrorText()
  const { code } = useParams()
  const { data, error, isLoading } = useGetPublicCertificateQuery(code)
  useDocumentTitle(t('title'))
  const notFound = errorCode(error) === 'NOT_FOUND' || errorCode(error) === 'VALIDATION_FAILED'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" aria-label={t('shell:brandHome')}>
          <BrandLogo height={36} />
        </Link>
        <LanguagePicker />
      </header>

      <main className={styles.main}>
        <Panel padding={32} className={styles.panel} data-certificate-check={data?.status ?? (notFound ? 'not_found' : undefined)}>
          <p className={styles.eyebrow}>{t('title')}</p>
          <p className={styles.code}>{code.toUpperCase()}</p>
          {isLoading && (
            <SkeletonRegion className={styles.result}>
              <Skeleton shape="circle" width={28} height={28} />
              <Skeleton shape="pill" />
              <dl className={styles.facts}>
                {[
                  ['holder', 160],
                  ['course', 220],
                  ['issued', 120],
                ].map(([key, width]) => (
                  <div key={key}>
                    <dt>{t(key)}</dt>
                    <dd>
                      <Skeleton width={width} height={12} />
                    </dd>
                  </div>
                ))}
              </dl>
              <Skeleton width="70%" />
            </SkeletonRegion>
          )}
          {error && (
            <div className={styles.result}>
              <Icon as={SearchX} size={28} className={styles.icon} />
              <h1 className={styles.heading}>{notFound ? t('notFound.title') : errorText.code(error)}</h1>
              {notFound && <p className={styles.text}>{t('notFound.text')}</p>}
            </div>
          )}
          {data && (
            <div className={styles.result}>
              <Icon as={ICON[data.status]} size={28} className={styles[data.status]} />
              <PillBadge tone={TONE[data.status]} data-certificate-status={data.status}>
                {t(`status.${data.status}`)}
              </PillBadge>
              {data.status === 'no_longer_valid' ? (
                <p className={styles.text}>{t('noLongerValid')}</p>
              ) : (
                <dl className={styles.facts}>
                  <div>
                    <dt>{t('holder')}</dt>
                    <dd data-certificate-holder>{data.holderName}</dd>
                  </div>
                  <div>
                    <dt>{t('course')}</dt>
                    <dd>{data.courseTitle}</dd>
                  </div>
                  <div>
                    <dt>{t('issued')}</dt>
                    <dd>{format.date(data.issuedAt, { dateStyle: 'long' })}</dd>
                  </div>
                  {data.revokedAt && (
                    <div>
                      <dt>{t('revoked')}</dt>
                      <dd>{format.date(data.revokedAt, { dateStyle: 'long' })}</dd>
                    </div>
                  )}
                </dl>
              )}
              <p className={styles.note}>{t('note')}</p>
            </div>
          )}
        </Panel>
      </main>

      <footer className={styles.footer}>
        <Copyright />
      </footer>
    </div>
  )
}
