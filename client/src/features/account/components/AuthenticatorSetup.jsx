import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Button, Icon, Skeleton } from '@/components/ui'
import styles from './AuthenticatorSetup.module.css'

/**
 * Setting up an authenticator app (owner 2026-11-18): 1. scan the QR code (or copy the key), 2. enter the code the app
 * shows (`children`, the code form). `setup` is { secret, qr } from the server; null while it loads.
 */
export default function AuthenticatorSetup({ setup, children }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copyKey() {
    await navigator.clipboard.writeText(setup.secret)
    setCopied(true)
  }

  return (
    <ol className={styles.steps}>
      <li className={styles.step}>
        <span className={styles.number}>1</span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>{t('account:twoFactor.scanTitle')}</p>
          <p className={styles.stepText}>{t('account:twoFactor.scanText')}</p>
          <div className={styles.qrRow}>
            {setup ? <img src={setup.qr} alt={t('account:twoFactor.qrAlt')} width={148} height={148} className={styles.qr} /> : <Skeleton shape="block" width={148} height={148} />}
            <div className={styles.key}>
              <span className={styles.keyLabel}>{t('account:twoFactor.keyLabel')}</span>
              <div className={styles.keyBox}>
                <code className={styles.keyValue} data-setup-key>
                  {setup?.secret.match(/.{1,4}/g).join(' ')}
                </code>
                <Button variant="outline" size="sm" leftIcon={<Icon as={copied ? Check : Copy} size={14} />} onClick={copyKey} disabled={!setup} className={styles.copy}>
                  {copied ? t('account:twoFactor.copied') : t('account:twoFactor.copyKey')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </li>
      <li className={styles.step}>
        <span className={styles.number}>2</span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>{t('account:twoFactor.codeTitle')}</p>
          {children}
        </div>
      </li>
    </ol>
  )
}
