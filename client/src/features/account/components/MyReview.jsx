import { Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, Panel, Skeleton, SkeletonRegion, TextareaField } from '@/components/ui'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDeleteMyReviewMutation, useGetMyReviewQuery, useSaveMyReviewMutation } from '../api.js'
import styles from './MyReview.module.css'

/**
 * Settings › Review (2026-11-13): the user's one review of EU Jobs (1–5 stars and a short text). An admin approves it
 * before it shows on the public home page, as the first name and last initial; any edit sends it back for approval.
 */
export default function MyReview() {
  const { t } = useTranslation()
  const { data: review, isLoading } = useGetMyReviewQuery()
  return (
    <Panel padding={28} className={styles.card}>
      <h2 className={styles.title}>{t('account:review.title')}</h2>
      <p className={styles.description}>{t('account:review.description')}</p>
      {isLoading ? (
        <SkeletonRegion>
          <Skeleton height={120} />
        </SkeletonRegion>
      ) : (
        // A new key starts the form again from the saved review (or empty after a delete).
        <ReviewForm key={review?.id ?? 'new'} review={review} />
      )}
    </Panel>
  )
}

function ReviewForm({ review }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [save, { isLoading: saving }] = useSaveMyReviewMutation()
  const [remove, { isLoading: removing }] = useDeleteMyReviewMutation()
  const form = useFormState({ rating: review?.rating ?? 0, text: review?.text ?? '' })
  const [saved, setSaved] = useState(false)
  const limits = config?.limits.review.text

  async function submit(event) {
    event.preventDefault()
    setSaved(false)
    const text = form.values.text.trim()
    const ok = await form.run(
      {
        rating: form.values.rating ? undefined : { key: 'required' },
        text: !text ? { key: 'required' } : limits && text.length < limits.min ? { key: 'too_short', params: { min: limits.min } } : undefined,
      },
      () => save({ rating: form.values.rating, text }).unwrap(),
    )
    setSaved(ok)
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {review && (
        <p className={cx(styles.status, styles[review.status])} role="status">
          {t(`account:review.status.${review.status}`, { date: format.date(review.decidedAt ?? review.submittedAt) })}
          {review.reason && <span className={styles.reason}>{t('account:review.reason', { reason: review.reason })}</span>}
        </p>
      )}
      <fieldset className={styles.stars}>
        <legend className={styles.label}>{t('account:review.rating')}</legend>
        <div className={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={cx(styles.star, value <= form.values.rating && styles.starOn)}>
              <input type="radio" name="rating" value={value} checked={form.values.rating === value} onChange={() => form.set('rating', value)} />
              <Icon as={Star} size={26} />
              <span className={styles.srOnly}>{t('account:review.stars', { count: value })}</span>
            </label>
          ))}
        </div>
        {form.errors.rating && <p className={styles.error}>{errorText.field('rating', form.errors.rating)}</p>}
      </fieldset>
      <TextareaField
        label={t('account:review.text')}
        hint={limits && t('account:review.hint', { count: form.values.text.trim().length, max: limits.max })}
        rows={4}
        name="text"
        maxLength={limits?.max}
        value={form.values.text}
        onChange={(event) => form.set('text', event.target.value)}
        error={errorText.field('text', form.errors.text)}
      />
      {form.failure && (
        <p className={styles.error} role="alert">
          {errorText.code(form.failure)}
        </p>
      )}
      {saved && (
        <p className={styles.saved} role="status">
          {t('account:review.saved')}
        </p>
      )}
      <div className={styles.actions}>
        {review && (
          <Button variant="outline" onClick={() => remove()} loading={removing}>
            {t('account:review.delete')}
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {t(review ? 'account:review.update' : 'account:review.submit')}
        </Button>
      </div>
    </form>
  )
}
