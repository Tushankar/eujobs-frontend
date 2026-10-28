import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon } from '@/components/ui'
import { JOB_STEPS, validateAll, validateStep } from '../data/jobFields.js'
import JobStepFields from './JobStepFields.jsx'
import styles from './JobWizard.module.css'

/**
 * The 9-step Create a job form. Owns the form values, current step and validation; the page decides what
 * happens on finish. `finishActions` = [{ id, label, status, variant? }] shown on the last step, and
 * `onProgress({ values, step })` is called on every change so the page can persist an in-progress draft.
 */
export default function JobWizard({
  initialValues,
  initialStep = 0,
  note,
  cancelLabel = 'Cancel',
  finishActions,
  onProgress,
  onCancel,
  onFinish,
}) {
  const [values, setValues] = useState(initialValues)
  const [step, setStep] = useState(initialStep)
  const [reached, setReached] = useState(initialStep)
  const [errors, setErrors] = useState({})
  const headingRef = useRef(null)
  const changedStep = useRef(false)

  const current = JOB_STEPS[step]
  const isFirst = step === 0
  const isLast = step === JOB_STEPS.length - 1

  useEffect(() => {
    onProgress?.({ values, step })
  }, [values, step, onProgress])

  useEffect(() => {
    if (changedStep.current) headingRef.current?.focus()
    changedStep.current = true
  }, [step])

  function setValue(name, value) {
    setValues((currentValues) => ({ ...currentValues, [name]: value }))
    setErrors((currentErrors) => (currentErrors[name] ? { ...currentErrors, [name]: undefined } : currentErrors))
  }

  function bind(name) {
    return {
      name,
      value: values[name],
      error: errors[name],
      onChange: (event) => setValue(name, event.target.value),
    }
  }

  function goTo(index) {
    setErrors({})
    setStep(index)
    setReached((furthest) => Math.max(furthest, index))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isLast) return
    const stepErrors = validateStep(current.id, values)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length === 0) goTo(step + 1)
  }

  function finish(action) {
    // A draft only needs a title; publishing or saving a live job needs every step to be valid.
    const { errors: allErrors, firstStep } =
      action.status === 'draft' ? { errors: validateStep('basics', values), firstStep: 0 } : validateAll(values)
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      setStep(firstStep)
      return
    }
    onFinish(values, action)
  }

  return (
    <div className={styles.wizard}>
      <aside className={styles.sidebar}>
        <ol className={styles.steps}>
          {JOB_STEPS.map((item, index) => {
            const active = index === step
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cx(
                    styles.stepButton,
                    active && styles.stepActive,
                    !active && index > reached && styles.stepLocked,
                  )}
                  aria-current={active ? 'step' : undefined}
                  disabled={index > reached}
                  onClick={() => goTo(index)}
                >
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span className={styles.stepLabel}>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className={styles.note}>{note}</p>
      </aside>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.eyebrow}>
          Step {step + 1} of {JOB_STEPS.length}
        </p>
        <h2 className={styles.title} ref={headingRef} tabIndex={-1}>
          {current.label}
        </h2>

        <div className={styles.body}>
          <JobStepFields
            stepId={current.id}
            values={values}
            errors={errors}
            bind={bind}
            setValue={setValue}
            choosesStatus={finishActions.length > 1}
          />
        </div>

        <div className={styles.footer}>
          <Button
            variant="ghost"
            className={styles.back}
            onClick={isFirst ? onCancel : () => goTo(step - 1)}
            leftIcon={<Icon as={ArrowLeft} size={13} />}
          >
            {isFirst ? cancelLabel : 'Back'}
          </Button>
          {isLast ? (
            <div className={styles.finish}>
              {finishActions.map((action, index) => (
                <Button
                  key={action.id}
                  variant={index === finishActions.length - 1 ? 'primary' : 'secondary'}
                  onClick={() => finish(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : (
            <Button type="submit" rightIcon={<Icon as={ArrowRight} size={13} />}>
              Continue
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
