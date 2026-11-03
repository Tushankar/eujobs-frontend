import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, PasswordField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { SIGN_IN_PATH } from '@/app/session.js'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useAcceptInviteMutation, useGetInviteQuery } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import FormAlert from '../components/FormAlert.jsx'
import hintStyles from '../components/compactHint.module.css'
import { useFormState } from '../utils/useFormState.js'
import styles from './AuthFlowPage.module.css'

const LINK_PROBLEMS = { TOKEN_EXPIRED: 'expired', TOKEN_USED: 'used', TOKEN_INVALID: 'invalid' }

/** M-159, U21: an invited admin sets a password once from the emailed link (72 h), then signs in on the admin portal. */
export default function SetPasswordPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const token = useSearchParams()[0].get('token')
  const { data: config } = useGetConfigQuery()
  const invite = useGetInviteQuery(token, { skip: !token })
  const { values, errors, setErrors, field } = useFormState({ password: '', confirmPassword: '' })
  const [accept, { isLoading }] = useAcceptInviteMutation()
  const [done, setDone] = useState(false)
  const [failure, setFailure] = useState(null)

  const problem = !token ? 'invalid' : LINK_PROBLEMS[errorCode(failure)] ?? (invite.isError ? (LINK_PROBLEMS[errorCode(invite.error)] ?? 'invalid') : null)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({
      password: check.newPassword(values.password, config?.limits),
      confirmPassword: check.confirm(values.confirmPassword, values.password),
    })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    try {
      await accept({ token, password: values.password }).unwrap()
      setDone(true)
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <AuthIntro title={t('auth:invite.done.title')} />
        <div className={styles.body}>
          <p>{t('auth:invite.done.text')}</p>
          <Button as={Link} to={SIGN_IN_PATH.admin} fullWidth>
            {t('auth:common.signIn')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (problem) {
    return (
      <AuthLayout>
        <AuthIntro title={t(`auth:invite.${problem}.title`)} />
        <div className={styles.body}>
          <p>{t(`auth:invite.${problem}.text`)}</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthIntro title={t('auth:invite.title')} lead={invite.data && t('auth:invite.lead', { name: invite.data.fullName, email: invite.data.email })} />
      <form className={styles.body} onSubmit={handleSubmit} noValidate>
        {failure && errorCode(failure) !== 'VALIDATION_FAILED' && <FormAlert>{errorText.code(failure)}</FormAlert>}
        <PasswordField
          className={hintStyles.compactHint}
          label={t('auth:fields.newPassword')}
          name="password"
          autoComplete="new-password"
          hint={t('auth:fields.passwordHint', { min: config?.limits.password.min })}
          value={values.password}
          onChange={field('password')}
          error={errorText.field('password', errors.password)}
        />
        <PasswordField
          label={t('auth:fields.confirmPassword')}
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={field('confirmPassword')}
          error={errorText.field('confirmPassword', errors.confirmPassword)}
        />
        <Button type="submit" fullWidth loading={isLoading} disabled={!invite.data}>
          {t('auth:invite.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
