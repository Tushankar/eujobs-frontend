import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCountryOptions } from '@/lib/countries.js'
import { serverFieldErrors, useCooldown, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useConfirmPhoneMutation, useRequestPhoneCodeMutation } from '../api.js'
import pageStyles from '../pages/VerificationPage.module.css'
import styles from './PhoneVerification.module.css'

/**
 * Phone check (M-003, M-004, OD3): a country plus the number (national numbers are read in that country, stored
 * as E.164), a 6-digit code shown on screen (no SMS), 5 attempts, a new code after 60 s.
 */
export default function PhoneVerification({ phone }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { country: pickerCountry } = usePreferences()
  const countries = useCountryOptions().filter((option) => !option.isRemote)
  const [editing, setEditing] = useState(!phone.verified)
  const [country, setCountry] = useState(pickerCountry && pickerCountry !== 'REMOTE' ? pickerCountry : '')
  const [number, setNumber] = useState(phone.e164 ?? '')
  const [sent, setSent] = useState(null)
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const cooldown = useCooldown()
  const [requestCode, { isLoading: sending }] = useRequestPhoneCodeMutation()
  const [confirmPhone, { isLoading: confirming }] = useConfirmPhoneMutation()

  async function send() {
    setErrors({})
    try {
      const result = await requestCode({ phone: number, country: country || undefined }).unwrap()
      setSent(result)
      setNumber(result.phone)
      setCode('')
      cooldown.start(config.limits.code.resendAfterMs / 1000)
    } catch (failure) {
      const fields = serverFieldErrors(failure)
      if (errorCode(failure) === 'RATE_LIMITED') cooldown.start(failure.data.error.params.retryAfter)
      setErrors(fields.phone ? { phone: errorText.field('phone', fields.phone) } : { send: errorText.code(failure) })
    }
  }

  async function confirm(event) {
    event.preventDefault()
    if (!code.trim()) return setErrors({ code: errorText.field('code', { key: 'required' }) })
    try {
      await confirmPhone(code.trim()).unwrap()
      setSent(null)
      setEditing(false)
      setErrors({})
    } catch (failure) {
      setErrors({ code: errorText.code(failure) })
    }
  }

  return (
    <div className={cx(pageStyles.contactRow, pageStyles.phoneRow)} data-phone={phone.verified ? 'verified' : 'unverified'}>
      <span className={pageStyles.tile}>
        <Icon as={ShieldCheck} size={18} />
      </span>
      <div className={pageStyles.contactBody}>
        <p className={pageStyles.contactLabel}>{t('verification:phone.label')}</p>
        {!editing ? (
          <div className={styles.verified}>
            <p className={pageStyles.contactValue}>{t('verification:phone.verifiedNumber', { phone: phone.e164 })}</p>
            <PillBadge tone="success" dot>
              {t('verification:verified')}
            </PillBadge>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t('verification:phone.change')}
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.numberRow}>
              <SelectField
                label={t('verification:phone.country')}
                name="phoneCountry"
                placeholder={t('verification:phone.country')}
                options={countries.map((option) => ({ value: option.code, label: option.name }))}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
              <TextField
                label={t('verification:phone.number')}
                name="phone"
                type="tel"
                autoComplete="tel"
                hint={t('verification:phone.numberHint')}
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value)
                  setErrors({})
                }}
                error={errors.phone}
              />
            </div>
            <div className={styles.actions}>
              <Button variant="outline" loading={sending} disabled={!number.trim() || cooldown.remaining > 0} onClick={send}>
                {cooldown.remaining > 0 ? t('verification:phone.resendIn', { count: cooldown.remaining }) : t(sent ? 'verification:phone.resend' : 'verification:phone.send')}
              </Button>
            </div>
            {errors.send && (
              <p className={styles.error} role="alert">
                {errors.send}
              </p>
            )}
            {sent && (
              <form className={styles.codeForm} onSubmit={confirm} noValidate>
                <p className={styles.codeShown} role="status">
                  {t('verification:phone.codeShown', { code: sent.code, minutes: Math.round(sent.expiresInSeconds / 60) })}
                  <span className={styles.codeNote}>{t('verification:phone.codeNote')}</span>
                </p>
                <div className={styles.numberRow}>
                  <TextField
                    label={t('verification:phone.code')}
                    name="phoneCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value)
                      setErrors({})
                    }}
                    error={errors.code}
                  />
                  <div className={styles.confirm}>
                    <Button type="submit" loading={confirming}>
                      {t('verification:phone.confirm')}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
