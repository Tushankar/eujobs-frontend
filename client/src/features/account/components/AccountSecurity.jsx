import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, KeyRound, Mail } from 'lucide-react'
import { Icon } from '@/components/ui'
import EmailText from '@/components/common/EmailText.jsx'
import { usePreferences } from '@/lib/preferences.js'
import ChangePasswordForm from './ChangePasswordForm.jsx'
import SettingRow, { SettingsSection } from './SettingRow.jsx'
import TwoFactorSetting from './TwoFactorSetting.jsx'
import styles from './AccountSecurity.module.css'

/**
 * Data & account › Sign in & security (candidate, recruiter): the sign-in email, the password row that opens its form
 * and two-step verification (2026-11-18); one row is open at a time.
 */
export default function AccountSecurity() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const [open, setOpen] = useState(null)
  const toggle = (row) => setOpen((current) => (current === row ? null : row))
  return (
    <SettingsSection title={t('account:security.title')}>
      <SettingRow
        id="email"
        icon={Mail}
        label={t('auth:fields.email')}
        value={
          <span className={styles.email}>
            <span>
              <EmailText email={me.email} />
            </span>
            {me.emailVerified && (
              <span className={styles.verified}>
                <Icon as={CircleCheck} size={14} /> {t('account:security.verified')}
              </span>
            )}
          </span>
        }
      />
      <SettingRow id="password" icon={KeyRound} label={t('auth:fields.password')} value="••••••••" open={open === 'password'} onToggle={() => toggle('password')}>
        <p className={styles.description}>{t('account:password.description')}</p>
        <ChangePasswordForm />
      </SettingRow>
      <TwoFactorSetting open={open === 'twoFactor'} onToggle={() => toggle('twoFactor')} />
    </SettingsSection>
  )
}
