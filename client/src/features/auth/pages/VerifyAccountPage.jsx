import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { refreshMe } from '@/app/session.js'
import { Button, Icon, TextField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCooldown, useErrorText } from '@/lib/forms.js'
import { useConfirmOnboardingPhoneMutation, useRequestOnboardingPhoneCodeMutation, useSubmitOnboardingMutation } from '../api.js'
import hintStyles from '../components/compactHint.module.css'
import StepFooter from '../components/StepFooter.jsx'
import StepHeading from '../components/StepHeading.jsx'
import { stepPath } from '../data/onboarding.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import stepStyles from './OnboardingStepPage.module.css'
import styles from './VerifyAccountPage.module.css'

/**
 * Onboarding step 4 of 5 (M-002, M-003): the email was confirmed right after sign-up; the phone is confirmed
 * with a code shown on screen (no SMS, M-004 rules), then the application is submitted for admin review.
 */
export default function VerifyAccountPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { state } = useOnboarding()
  const { data: config } = useGetConfigQuery()
  const cooldown = useCooldown()
  const [requestCode, { isLoading: sending }] = useRequestOnboardingPhoneCodeMutation()
  const [confirmPhone, { isLoading: confirming }] = useConfirmOnboardingPhoneMutation()
  const [submit, { isLoading: submitting }] = useSubmitOnboardingMutation()
  const [sent, setSent] = useState(null)
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const { phone } = state.account
  const documentName = (type) => state.documents.find((document) => document.type === type)?.name

  const checklist = [
    { key: 'company', value: state.company?.legalName },
    { key: 'identity', value: documentName('identity') },
    { key: 'registration', value: documentName('registration') },
    { key: 'authorization', value: documentName('authorization'), fallback: t('auth:onboarding.verify.checklist.notProvided') },
  ]

  async function send() {
    setErrors({})
    try {
      setSent(await requestCode({ phone: phone.e164 }).unwrap())
      setCode('')
      cooldown.start(config.limits.code.resendAfterMs / 1000)
    } catch (failure) {
      if (errorCode(failure) === 'RATE_LIMITED') cooldown.start(failure.data.error.params.retryAfter)
      setErrors({ send: errorText.code(failure) })
    }
  }

  async function confirm() {
    if (!code.trim()) return setErrors({ code: errorText.field('code', { key: 'required' }) })
    try {
      await confirmPhone(code.trim()).unwrap()
      setSent(null)
      setErrors({})
    } catch (failure) {
      setErrors({ code: errorText.code(failure) })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!state.editable) return navigate(stepPath('review'))
    if (!phone.verified) return setErrors({ submit: t('auth:onboarding.verify.needsPhone') })
    try {
      await submit().unwrap()
      await refreshMe()
      navigate(stepPath('review'))
    } catch (failure) {
      setErrors({ submit: errorText.code(failure) })
    }
  }

  return (
    <>
      <StepHeading title={t('auth:onboarding.verify.title')} description={t('auth:onboarding.verify.description')} />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.intro}>{t('auth:onboarding.verify.intro')}</p>
        <div className={styles.phone}>
          <div className={styles.phoneRow}>
            <div>
              <p className={styles.checkTitle}>{t('auth:onboarding.verify.phone')}</p>
              <p className={styles.checkValue}>{phone.e164}</p>
            </div>
            {phone.verified ? (
              <PillBadge tone="success" dot>
                {t('auth:onboarding.verify.confirmed')}
              </PillBadge>
            ) : (
              state.editable && (
                <div className={styles.phoneActions}>
                  <Button variant="ghost" size="sm" as={Link} to={stepPath('account')}>
                    {t('auth:onboarding.verify.change')}
                  </Button>
                  <Button variant="outline" size="sm" loading={sending} disabled={cooldown.remaining > 0} onClick={send}>
                    {cooldown.remaining > 0
                      ? t('auth:onboarding.verify.resendIn', { count: cooldown.remaining })
                      : t(sent ? 'auth:onboarding.verify.resend' : 'auth:onboarding.verify.send')}
                  </Button>
                </div>
              )
            )}
          </div>
          {errors.send && <p role="alert" className={styles.error}>{errors.send}</p>}
          {sent && !phone.verified && (
            <div className={styles.codeBlock}>
              <p className={styles.codeShown} role="status">
                {t('auth:onboarding.verify.codeShown', { code: sent.code, minutes: Math.round(sent.expiresInSeconds / 60) })}
                <span className={styles.codeNote}>{t('auth:onboarding.verify.codeNote')}</span>
              </p>
              <div className={styles.otpGrid}>
                <TextField
                  className={hintStyles.compactHint}
                  label={t('auth:onboarding.verify.code')}
                  name="phoneCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                    setErrors({})
                  }}
                  // Enter confirms the code here, not the whole application.
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    confirm()
                  }}
                  error={errors.code}
                />
                <div className={styles.confirm}>
                  <Button loading={confirming} onClick={confirm}>
                    {t('auth:onboarding.verify.confirm')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <ul className={styles.checklist}>
          {checklist.map((item) => (
            <li key={item.key} className={styles.checkItem}>
              <Icon as={CircleCheck} size={16} className={item.value ? styles.checkDone : styles.checkEmpty} />
              <div className={styles.checkText}>
                <p className={styles.checkTitle}>{t(`auth:onboarding.verify.checklist.${item.key}`)}</p>
                <p className={styles.checkValue}>{item.value || item.fallback}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className={`${stepStyles.note} ${styles.note}`}>{t('auth:onboarding.verify.note')}</p>
        {errors.submit && <p role="alert" className={styles.error}>{errors.submit}</p>}
        <StepFooter onBack={() => navigate(stepPath('kyc'))} submitLabel={t('auth:onboarding.verify.submit')} loading={submitting} />
      </form>
    </>
  )
}
