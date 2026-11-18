import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, ShieldCheck } from 'lucide-react'
import { Button, CodeInput, Icon, PasswordField } from '@/components/ui'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useDisableTwoFactorMutation, useEnableTwoFactorMutation, useNewBackupCodesMutation, useSetupTwoFactorMutation } from '../api.js'
import AuthenticatorSetup from './AuthenticatorSetup.jsx'
import BackupCodes from './BackupCodes.jsx'
import SettingRow from './SettingRow.jsx'
import styles from './TwoFactorSetting.module.css'

/**
 * Sign in & security › Two-step verification (owner 2026-11-18). Off: set up an authenticator app (it then replaces
 * the emailed code on new browsers). On: new backup codes, or turn it off with the password (not admins: they must keep it).
 */
export default function TwoFactorSetting({ open, onToggle }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const { enabled, backupCodesLeft } = me.twoFactor ?? { enabled: false, backupCodesLeft: 0 }
  return (
    <SettingRow
      id="two-factor"
      icon={ShieldCheck}
      label={t('account:twoFactor.title')}
      value={
        enabled ? (
          <span className={styles.value}>
            <span className={styles.on}>
              <Icon as={CircleCheck} size={14} /> {t('account:twoFactor.on')}
            </span>
            <span>{t('account:twoFactor.onValue', { count: backupCodesLeft })}</span>
          </span>
        ) : (
          t(me.role === 'admin' ? 'account:twoFactor.offValueAdmin' : 'account:twoFactor.offValue')
        )
      }
      open={open}
      onToggle={onToggle}
    >
      <TwoFactorPanel enabled={enabled} admin={me.role === 'admin'} onClose={onToggle} />
    </SettingRow>
  )
}

/** The open row; mounted only while open, so closing resets it. */
function TwoFactorPanel({ enabled, admin, onClose }) {
  const { t } = useTranslation()
  const [codes, setCodes] = useState(null)
  if (codes) {
    return (
      <div className={styles.panel}>
        <p className={styles.text}>{t('account:twoFactor.saveCodes')}</p>
        <BackupCodes codes={codes} />
        <Button className={styles.submit} onClick={onClose}>
          {t('account:twoFactor.done')}
        </Button>
      </div>
    )
  }
  return enabled ? <ManagePanel admin={admin} onCodes={setCodes} onClose={onClose} /> : <SetupPanel onCodes={setCodes} />
}

function SetupPanel({ onCodes }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [start, { data: setup }] = useSetupTwoFactorMutation()
  const [enable, { isLoading }] = useEnableTwoFactorMutation()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  // A wrong code empties the boxes and focuses the first one again.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    start()
  }, [start])

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    try {
      onCodes((await enable(code).unwrap()).backupCodes)
    } catch (failure) {
      setError(serverFieldErrors(failure).code ?? { key: 'invalid' })
      setCode('')
      setAttempt((count) => count + 1)
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.text}>{t('account:twoFactor.setupLead')}</p>
      <AuthenticatorSetup setup={setup}>
        <form className={styles.inline} onSubmit={handleSubmit} noValidate>
          <CodeInput
            key={attempt}
            autoFocus={attempt > 0}
            label={t('auth:loginStep.appLabel')}
            hideLabel
            value={code}
            onChange={(next) => {
              setCode(next)
              setError(null)
            }}
            error={error && errorText.field('code', error)}
          />
          <Button type="submit" loading={isLoading} disabled={code.length !== 6 || !setup} className={styles.codeButton}>
            {t('account:twoFactor.turnOn')}
          </Button>
        </form>
      </AuthenticatorSetup>
    </div>
  )
}

/** On: get new backup codes or turn it off; both ask for the password first. */
function ManagePanel({ admin, onCodes, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [action, setAction] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [renew, { isLoading: renewing }] = useNewBackupCodesMutation()
  const [disable, { isLoading: disabling }] = useDisableTwoFactorMutation()

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    try {
      if (action === 'renew') onCodes((await renew(password).unwrap()).backupCodes)
      else {
        await disable(password).unwrap()
        onClose()
      }
    } catch (failure) {
      setError(serverFieldErrors(failure).password ?? { key: 'invalid' })
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.text}>{t(admin ? 'account:twoFactor.onLeadAdmin' : 'account:twoFactor.onLead')}</p>
      {action ? (
        <form className={styles.stack} onSubmit={handleSubmit} noValidate>
          <PasswordField
            label={t('account:twoFactor.confirmPassword')}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error && errorText.field('currentPassword', error)}
          />
          <Button type="submit" variant={action === 'disable' ? 'danger' : 'primary'} loading={renewing || disabling} disabled={!password}>
            {t(action === 'disable' ? 'account:twoFactor.turnOff' : 'account:twoFactor.newCodes')}
          </Button>
        </form>
      ) : (
        <div className={styles.actions}>
          <Button variant="outline" size="sm" onClick={() => setAction('renew')}>
            {t('account:twoFactor.newCodes')}
          </Button>
          {!admin && (
            <Button variant="outline" size="sm" onClick={() => setAction('disable')}>
              {t('account:twoFactor.turnOff')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
