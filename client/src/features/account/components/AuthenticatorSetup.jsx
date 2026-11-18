import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui'
import styles from './AuthenticatorSetup.module.css'

/**
 * Setting up an authenticator app (owner 2026-11-18): 1. scan the QR code (or type the key), 2. enter the code the app
 * shows (`children`, the code form). `setup` is { secret, qr } from the server; null while it loads.
 */
export default function AuthenticatorSetup({ setup, children }) {
  const { t } = useTranslation()
  return (
    <ol className={styles.steps}>
      <li className={styles.step}>
        <span className={styles.number}>1</span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>{t('account:twoFactor.scanTitle')}</p>
          <p className={styles.stepText}>{t('account:twoFactor.scanText')}</p>
          <div className={styles.qrRow}>
            {setup ? <img src={setup.qr} alt={t('account:twoFactor.qrAlt')} width={168} height={168} className={styles.qr} /> : <Skeleton shape="block" width={168} height={168} />}
            <div className={styles.key}>
              <span className={styles.keyLabel}>{t('account:twoFactor.keyLabel')}</span>
              <code className={styles.keyValue} data-setup-key>
                {setup?.secret.match(/.{1,4}/g).join(' ')}
              </code>
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
