import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, PasswordField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { SIGN_IN_PATH } from '@/app/session.js'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useResetPasswordMutation } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import FormAlert from '../components/FormAlert.jsx'
import hintStyles from '../components/compactHint.module.css'
import { useFormState } from '../utils/useFormState.js'
import styles from './AuthFlowPage.module.css'

const LINK_PROBLEMS = { TOKEN_EXPIRED: 'expired', TOKEN_USED: 'used', TOKEN_INVALID: 'invalid' }

/** M-009: a new password from the emailed link; it signs out every session and links to that role's sign-in. */
export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const token = useSearchParams()[0].get('token')
  const { data: config } = useGetConfigQuery()
  const { values, errors, setErrors, field } = useFormState({ password: '', confirmPassword: '' })
  const [reset, { isLoading }] = useResetPasswordMutation()
  const [result, setResult] = useState(token ? null : { problem: 'invalid' })
  const [failure, setFailure] = useState(null)

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
      const { role } = await reset({ token, password: values.password }).unwrap()
      setResult({ role })
    } catch (error) {
      const problem = LINK_PROBLEMS[errorCode(error)]
      if (problem) return setResult({ problem })
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  if (result?.role) {
    return (
      <AuthLayout>
        <AuthIntro title={t('auth:reset.done.title')} />
        <div className={styles.body}>
          <p>{t('auth:reset.done.text')}</p>
          <Button as={Link} to={SIGN_IN_PATH[result.role]} fullWidth>
            {t('auth:common.signIn')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (result?.problem) {
    return (
      <AuthLayout>
        <AuthIntro title={t(`auth:reset.${result.problem}.title`)} />
        <div className={styles.body}>
          <p>{t(`auth:reset.${result.problem}.text`)}</p>
          <Button as={Link} to="/forgot-password" fullWidth>
            {t('auth:reset.requestNew')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthIntro title={t('auth:reset.title')} lead={t('auth:reset.lead')} />
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
        <Button type="submit" fullWidth loading={isLoading}>
          {t('auth:reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
