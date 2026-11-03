import { useTranslation } from 'react-i18next'
import { Award, Download, ExternalLink } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetCertificatePdfMutation } from '../api.js'
import styles from './CertificateBlock.module.css'

/** M-105: the earned certificate: code, date, the public check and the stored PDF (a signed download link). */
export default function CertificateBlock({ certificate }) {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const errorText = useErrorText()
  const [getPdf, { isLoading, error }] = useGetCertificatePdfMutation()
  const verifyPath = `/certificates/${certificate.code}`

  async function download() {
    const { url } = await getPdf(certificate.id).unwrap()
    window.location.assign(url)
  }

  return (
    <Panel padding={24} className={styles.block} data-certificate={certificate.code}>
      <div className={styles.head}>
        <span className={styles.icon}>
          <Icon as={Award} size={20} />
        </span>
        <div>
          <h2 className={styles.title}>{t('certificate.title')}</h2>
          <p className={styles.meta}>{t('certificate.issued', { date: format.date(certificate.issuedAt) })}</p>
        </div>
        {certificate.status !== 'valid' && <PillBadge tone="warning">{t(`certificate.status.${certificate.status}`)}</PillBadge>}
      </div>
      <p className={styles.codeLabel}>{t('certificate.code')}</p>
      <p className={styles.code} data-certificate-code>
        {certificate.code}
      </p>
      <div className={styles.actions}>
        <Button leftIcon={<Icon as={Download} size={14} />} loading={isLoading} onClick={download} data-certificate-pdf>
          {t('certificate.download')}
        </Button>
        <Button as="a" href={verifyPath} target="_blank" rel="noopener" variant="outline" leftIcon={<Icon as={ExternalLink} size={14} />} data-certificate-verify>
          {t('certificate.verify')}
        </Button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {errorText.code(error)}
        </p>
      )}
      <p className={styles.note}>{t('certificate.note')}</p>
    </Panel>
  )
}
