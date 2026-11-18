import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Download } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import styles from './BackupCodes.module.css'

/** The one-time backup codes (owner 2026-11-18), shown once after 2FA is set up or renewed: copy or download them. */
export default function BackupCodes({ codes }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const text = `${t('account:twoFactor.backupFileTitle')}\n\n${codes.join('\n')}\n`

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'eu-jobs-backup-codes.txt' })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.box} data-backup-codes>
      <ol className={styles.codes}>
        {codes.map((code) => (
          <li key={code} className={styles.code}>
            {code}
          </li>
        ))}
      </ol>
      <div className={styles.actions}>
        <Button variant="outline" size="sm" leftIcon={<Icon as={copied ? Check : Copy} size={14} />} onClick={copy}>
          {copied ? t('account:twoFactor.copied') : t('account:twoFactor.copy')}
        </Button>
        <Button variant="outline" size="sm" leftIcon={<Icon as={Download} size={14} />} onClick={download}>
          {t('account:twoFactor.download')}
        </Button>
      </div>
    </div>
  )
}
