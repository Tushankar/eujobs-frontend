import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { Button, CodeInput, Icon, TextField } from '@/components/ui'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { useCooldown, useErrorText } from '@/lib/forms.js'
import AuthenticatorSetup from '@/features/account/components/AuthenticatorSetup.jsx'
import BackupCodes from '@/features/account/components/BackupCodes.jsx'
import { useResendLoginCodeMutation, useSetupLoginAppMutation, useVerifyLoginMutation } from '../api.js'
import AuthIntro from './AuthIntro.jsx'
import FormAlert from './FormAlert.jsx'
import styles from '../pages/AuthFlowPage.module.css'
import own from './LoginVerification.module.css'

/**
 * The sign-in second step (owner 2026-11-18), after a correct password. `verification` = { challenge, method, email? }:
 * `email` (code sent to the address), `totp` (authenticator or backup code) or `totp_setup` (an admin sets the app up,
 * then saves the backup codes). `onDone` gets { token, me }; `onBack` returns to the password form.
 */
export default function LoginVerification({ verification, onDone, onBack }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [verify, { isLoading }] = useVerifyLoginMutation()
  const [resend, { isLoading: resending }] = useResendLoginCodeMutation()
  const [loadSetup, { data: setup }] = useSetupLoginAppMutation()
  const cooldown = useCooldown()
  const startCooldown = cooldown.start
  const [code, setCode] = useState('')
  // A wrong code empties the boxes and puts the cursor back in the first one (a new key remounts them).
  const [attempt, setAttempt] = useState(0)
  const [backup, setBackup] = useState(false)
  const [failure, setFailure] = useState(null)
  const [resent, setResent] = useState(false)
  const [finished, setFinished] = useState(null)
  const { method, challenge } = verification
  const resendSeconds = config && config.limits.code.resendAfterMs / 1000

  useEffect(() => {
    if (method === 'totp_setup') loadSetup(challenge)
  }, [method, challenge, loadSetup])

  // The code went out with the sign-in, so resending opens one interval later.
  useEffect(() => {
    if (method === 'email' && resendSeconds) startCooldown(resendSeconds)
  }, [method, resendSeconds, startCooldown])

  async function handleSubmit(event) {
    event.preventDefault()
    setFailure(null)
    setResent(false)
    try {
      const result = await verify({ challenge, code: code.trim() }).unwrap()
      if (result.backupCodes) setFinished(result)
      else onDone(result)
    } catch (error) {
      setFailure(error)
      if (!backup) {
        setCode('')
        setAttempt((count) => count + 1)
      }
    }
  }

  async function handleResend() {
    setFailure(null)
    try {
      await resend(challenge).unwrap()
      setResent(true)
      setCode('')
      cooldown.start(resendSeconds)
    } catch (error) {
      setFailure(error)
      const retryAfter = error?.data?.error?.params?.retryAfter
      if (retryAfter) cooldown.start(retryAfter)
    }
  }

  if (finished) {
    return (
      <>
        <AuthIntro title={t('auth:loginStep.backupTitle')} />
        <div className={styles.body}>
          <p>{t('auth:loginStep.backupLead')}</p>
          <BackupCodes codes={finished.backupCodes} />
          <Button fullWidth onClick={() => onDone(finished)} data-backup-continue>
            {t('auth:loginStep.backupContinue')}
          </Button>
        </div>
      </>
    )
  }

  const failureCode = failure && errorCode(failure)
  // A spent, expired or unknown challenge means starting the sign-in again.
  const expired = failureCode?.startsWith('TOKEN_')
  const fieldError = failureCode === 'CODE_INVALID' || failureCode === 'VALIDATION_FAILED' ? errorText.code(failure) : undefined
  const codeLength = config?.limits.code.length ?? 6
  // A 6-digit code goes in separate boxes; a backup code ("abcd-efgh") in one field.
  const codeField = backup ? (
    <TextField label={t('auth:loginStep.backupLabel')} name="code" autoComplete="off" autoFocus maxLength={9} value={code} onChange={(event) => setCode(event.target.value)} error={fieldError} />
  ) : (
    <CodeInput
      key={attempt}
      label={t(method === 'email' ? 'auth:loginStep.emailLabel' : 'auth:loginStep.appLabel')}
      length={codeLength}
      value={code}
      onChange={(next) => {
        setCode(next)
        setFailure(null)
      }}
      error={fieldError}
      autoFocus
    />
  )
  const complete = backup ? code.trim().length > 0 : code.length === codeLength
  const submit = (
    <Button type="submit" fullWidth loading={isLoading} disabled={!complete || expired || (method === 'totp_setup' && !setup)}>
      {t(method === 'totp_setup' ? 'auth:loginStep.setupSubmit' : 'auth:loginStep.submit')}
    </Button>
  )

  return (
    <>
      <AuthIntro title={t(`auth:loginStep.title.${method}`)} />
      <form className={styles.body} onSubmit={handleSubmit} noValidate data-login-step={method}>
        <p>
          {method === 'email' ? (
            <Trans i18nKey="auth:loginStep.emailLead" values={{ email: verification.email }} components={{ email: <span className={styles.address} /> }} />
          ) : (
            t(`auth:loginStep.lead.${method}`)
          )}
        </p>
        {expired && <FormAlert>{t('auth:loginStep.expired')}</FormAlert>}
        {failure && !fieldError && !expired && <FormAlert>{errorText.code(failure)}</FormAlert>}
        {resent && <FormAlert tone="success">{t('auth:emailCode.resent')}</FormAlert>}
        {method === 'totp_setup' ? (
          <AuthenticatorSetup setup={setup}>
            {codeField}
            {submit}
          </AuthenticatorSetup>
        ) : (
          <>
            {codeField}
            {submit}
          </>
        )}
        {verification.rememberDays && (
          <p className={own.remember}>
            <Icon as={ShieldCheck} size={16} className={own.rememberIcon} />
            {t('auth:loginStep.remember', { count: verification.rememberDays })}
          </p>
        )}
        <div className={styles.links}>
          {method === 'email' && (
            <button type="button" onClick={handleResend} disabled={cooldown.remaining > 0 || resending}>
              {cooldown.remaining > 0 ? t('auth:emailCode.resendIn', { count: cooldown.remaining }) : t('auth:emailCode.resend')}
            </button>
          )}
          {method === 'totp' && (
            <button
              type="button"
              onClick={() => {
                setBackup(!backup)
                setCode('')
                setFailure(null)
              }}
            >
              {t(backup ? 'auth:loginStep.useApp' : 'auth:loginStep.useBackup')}
            </button>
          )}
          <button type="button" onClick={onBack}>
            {t('auth:loginStep.back')}
          </button>
        </div>
      </form>
    </>
  )
}
