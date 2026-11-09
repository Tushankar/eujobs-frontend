import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, KeyRound, Mail } from 'lucide-react'
import { Icon } from '@/components/ui'
import { usePreferences } from '@/lib/preferences.js'
import ChangePasswordForm from './ChangePasswordForm.jsx'
import SettingRow, { SettingsSection } from './SettingRow.jsx'
import styles from './AccountSecurity.module.css'

/** Data & account › Sign in & security (candidate, recruiter): the sign-in email and the password row that opens its form. */
export default function AccountSecurity() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const [open, setOpen] = useState(false)
  return (
    <SettingsSection title={t('account:security.title')}>
      <SettingRow
        id="email"
        icon={Mail}
        label={t('auth:fields.email')}
        value={
          <span className={styles.email}>
            {me.email}
            {me.emailVerified && (
              <span className={styles.verified}>
                <Icon as={CircleCheck} size={14} /> {t('account:security.verified')}
              </span>
            )}
          </span>
        }
      />
      <SettingRow id="password" icon={KeyRound} label={t('auth:fields.password')} value="••••••••" open={open} onToggle={() => setOpen(!open)}>
        <p className={styles.description}>{t('account:password.description')}</p>
        <ChangePasswordForm />
      </SettingRow>
    </SettingsSection>
  )
}
