import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { cx } from '@/utils/cx.js'
import { Button, Icon } from '@/components/ui'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { bodyErrorsToForm, JOB_STEPS, validateAll, validateStep } from '../utils/jobForm.js'
import JobStepFields from './JobStepFields.jsx'
import styles from './JobWizard.module.css'

/**
 * The 9-step Create a job form (§3.7). Owns the values, the current step and the errors; the page saves.
 * `onContinue(values, nextStep)` runs after a step passes its checks (the server draft, P4-D7) and
 * `onFinish(values, action)` on the last step. Either may reject with the API error: a VALIDATION_FAILED shows on
 * the fields and opens the step the server names (M-039). `finishActions` = [{ id, labelKey, status }].
 */
export default function JobWizard({ initialValues, initialStep = 0, reachable = initialStep, initialErrors = {}, note, companyName, finishActions, onContinue, onCancel, onFinish }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [values, setValues] = useState(initialValues)
  const [step, setStep] = useState(initialStep)
  const [reached, setReached] = useState(Math.max(initialStep, reachable))
  const [errors, setErrors] = useState(initialErrors)
  const [failure, setFailure] = useState(null)
  const [busy, setBusy] = useState(false)
  const headingRef = useRef(null)
  const changedStep = useRef(false)

  const current = JOB_STEPS[step]
  const isFirst = step === 0
  const isLast = step === JOB_STEPS.length - 1

  useEffect(() => {
    if (changedStep.current) headingRef.current?.focus()
    changedStep.current = true
  }, [step])

  /** `errorField` names the error a value clears when it differs from the value's name (the city clears placeId). */
  function setValue(name, value, errorField = name) {
    setValues((currentValues) => ({ ...currentValues, [name]: value }))
    setErrors((currentErrors) => (currentErrors[errorField] ? { ...currentErrors, [errorField]: undefined } : currentErrors))
  }

  const errorOf = (name) => errorText.field(name, errors[name])

  function bind(name) {
    return { name, value: values[name], error: errorOf(name), onChange: (event) => setValue(name, event.target.value) }
  }

  function goTo(index) {
    setErrors({})
    setFailure(null)
    setStep(index)
    setReached((furthest) => Math.max(furthest, index))
  }

  /** Runs a save; returns true when it worked. */
  async function save(work) {
    setBusy(true)
    setFailure(null)
    try {
      await work()
      return true
    } catch (error) {
      if (errorCode(error) === 'VALIDATION_FAILED') {
        setErrors(bodyErrorsToForm(serverFieldErrors(error)))
        const serverStep = JOB_STEPS.indexOf(error.data.error.params?.step)
        if (serverStep >= 0) setStep(serverStep)
      } else setFailure(error)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isLast) return
    const stepErrors = validateStep(current, values, config.limits)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return
    if (!onContinue || (await save(() => onContinue(values, step + 1)))) goTo(step + 1)
  }

  async function finish(action) {
    // A draft only needs step 1; publishing, or saving a live job, needs every step (M-039).
    const { errors: allErrors, firstStep } =
      action.status === 'draft' ? { errors: validateStep('basics', values, config.limits), firstStep: 0 } : validateAll(values, config.limits)
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      setStep(firstStep)
      return
    }
    await save(() => onFinish(values, action))
  }

  return (
    <div className={styles.wizard}>
      <aside className={`${styles.sidebar} sticky-side`}>
        <ol className={styles.steps}>
          {JOB_STEPS.map((id, index) => {
            const active = index === step
            return (
              <li key={id}>
                <button
                  type="button"
                  className={cx(styles.stepButton, active && styles.stepActive, !active && index > reached && styles.stepLocked)}
                  aria-current={active ? 'step' : undefined}
                  disabled={index > reached || busy}
                  onClick={() => goTo(index)}
                >
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span className={styles.stepLabel}>{t(`jobs:steps.${id}`)}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className={styles.note}>{note}</p>
      </aside>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.eyebrow}>{t('jobs:wizard.stepCount', { current: step + 1, total: JOB_STEPS.length })}</p>
        <h2 className={styles.title} ref={headingRef} tabIndex={-1}>
          {t(`jobs:steps.${current}`)}
        </h2>

        <div className={styles.body}>
          {config && (
            <JobStepFields step={current} values={values} bind={bind} errorOf={errorOf} setValue={setValue} companyName={companyName} choosesStatus={finishActions.length > 1} />
          )}
        </div>

        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
        <div className={styles.footer}>
          <Button variant="ghost" className={styles.back} onClick={isFirst ? onCancel : () => goTo(step - 1)} leftIcon={<Icon as={ArrowLeft} size={13} />}>
            {t(isFirst ? 'jobs:wizard.cancel' : 'jobs:wizard.back')}
          </Button>
          {isLast ? (
            <div className={styles.finish}>
              {/* An action with `locked` (§3.22: Publish while another job is live on Free) opens the upgrade dialog instead. */}
              {finishActions.map((action, index) => (
                <PlanButton
                  key={action.id}
                  entitlement="jobs_unlimited"
                  roles={['recruiter']}
                  when={Boolean(action.locked)}
                  variant={index === finishActions.length - 1 ? 'primary' : 'secondary'}
                  loading={busy}
                  onClick={() => finish(action)}
                >
                  {t(action.labelKey)}
                </PlanButton>
              ))}
            </div>
          ) : (
            <Button type="submit" loading={busy} rightIcon={<Icon as={ArrowRight} size={13} />}>
              {t('jobs:wizard.continue')}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
