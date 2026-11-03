import { useTranslation } from 'react-i18next'
import { Plus, Trash2, X } from 'lucide-react'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import { Button, Icon, IconButton, Panel, SelectField, TextField } from '@/components/ui'
import { useGetConfigQuery } from '@/app/api.js'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useSaveQuizMutation } from '../api.js'
import styles from './builder.module.css'

const blankQuestion = () => ({ text: '', type: 'single', options: [{ text: '' }, { text: '' }], correct: [] })

/**
 * The final quiz (M-104): pass mark (default 70), 1–50 single- or multiple-choice questions with 2–6 options and
 * the correct ones marked. The server checks every rule; its field errors show on the question. Locked after the
 * first enrollment (M-108).
 */
export default function QuizTab({ course }) {
  const { t } = useTranslation('courses')
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [save, { isLoading, isSuccess, reset }] = useSaveQuizMutation()
  const form = useFormState(() => ({
    passMark: String(course.quiz.passMark),
    questions: course.quiz.questions.map(({ text, type, options, correct }) => ({ text, type, options: options.map((option) => ({ text: option.text })), correct })),
  }))
  const { values, set, errors } = form
  const limits = config?.limits.course.quiz
  const locked = course.locked

  const change = (index, patch) => {
    reset()
    set('questions', values.questions.map((question, at) => (at === index ? { ...question, ...patch } : question)))
  }
  const toggleCorrect = (index, optionIndex) => {
    const question = values.questions[index]
    if (question.type === 'single') return change(index, { correct: [optionIndex] })
    change(index, { correct: question.correct.includes(optionIndex) ? question.correct.filter((at) => at !== optionIndex) : [...question.correct, optionIndex].sort() })
  }
  const removeOption = (index, optionIndex) => {
    const question = values.questions[index]
    change(index, {
      options: question.options.filter((_, at) => at !== optionIndex),
      correct: question.correct.filter((at) => at !== optionIndex).map((at) => (at > optionIndex ? at - 1 : at)),
    })
  }

  async function handleSave(event) {
    event.preventDefault()
    const passMark = values.passMark.trim()
    await form.run({ passMark: /^\d+$/.test(passMark) ? undefined : { key: 'invalid' } }, () =>
      save({ id: course.id, passMark: Number(passMark), questions: values.questions.map((question) => ({ ...question, options: question.options.map((option) => ({ text: option.text })) })) }).unwrap(),
    )
  }

  const error = (path) => errorText.field(path.split('.').pop(), errors[path])
  return (
    <form onSubmit={handleSave} noValidate className={styles.stack} data-quiz-form>
      <Panel padding={24} className={styles.row}>
        <TextField
          label={t('quiz.passMark')}
          hint={t('quiz.passMarkHint')}
          inputMode="numeric"
          value={values.passMark}
          onChange={(event) => set('passMark', event.target.value)}
          error={errorText.field('passMark', errors.passMark)}
          disabled={locked}
        />
      </Panel>

      {values.questions.map((question, index) => (
        <Panel key={index} padding={24} className={styles.stack} data-question={index}>
          <div className={styles.row}>
            <h2 className={styles.heading}>{t('quiz.question', { number: index + 1 })}</h2>
            <span className={styles.grow} />
            <IconButton label={t('quiz.removeQuestion', { number: index + 1 })} onClick={() => set('questions', values.questions.filter((_, at) => at !== index))} disabled={locked} icon={Trash2} iconSize={14} />
          </div>
          <TextField label={t('quiz.text')} value={question.text} onChange={(event) => change(index, { text: event.target.value })} error={error(`questions.${index}.text`)} disabled={locked} />
          <SelectField
            label={t('quiz.type')}
            options={(config?.enums.questionType ?? []).map((value) => ({ value, label: t(`enums:questionType.${value}`) }))}
            value={question.type}
            onChange={(event) => change(index, { type: event.target.value, correct: event.target.value === 'single' ? question.correct.slice(0, 1) : question.correct })}
            disabled={locked}
          />
          <fieldset className={styles.options}>
            <legend className={styles.label}>{t(question.type === 'single' ? 'quiz.optionsSingle' : 'quiz.optionsMultiple')}</legend>
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className={styles.row}>
                <input
                  type={question.type === 'single' ? 'radio' : 'checkbox'}
                  name={`correct-${index}`}
                  checked={question.correct.includes(optionIndex)}
                  onChange={() => toggleCorrect(index, optionIndex)}
                  aria-label={t('quiz.markCorrect', { number: optionIndex + 1 })}
                  disabled={locked}
                  data-correct={optionIndex}
                />
                <TextField
                  className={styles.grow}
                  aria-label={t('quiz.option', { number: optionIndex + 1 })}
                  value={option.text}
                  onChange={(event) => change(index, { options: question.options.map((item, at) => (at === optionIndex ? { text: event.target.value } : item)) })}
                  error={error(`questions.${index}.options.${optionIndex}.text`)}
                  disabled={locked}
                />
                <IconButton label={t('quiz.removeOption', { number: optionIndex + 1 })} onClick={() => removeOption(index, optionIndex)} disabled={locked} icon={X} iconSize={14} />
              </div>
            ))}
            {[`questions.${index}.options`, `questions.${index}.correct`].map(
              (path) =>
                errors[path] && (
                  <p key={path} className={styles.error} role="alert" data-question-error>
                    {error(path)}
                  </p>
                ),
            )}
            <div>
              <Button
                variant="outline"
                leftIcon={<Icon as={Plus} size={14} />}
                onClick={() => change(index, { options: [...question.options, { text: '' }] })}
                disabled={locked || question.options.length >= (limits?.options.max ?? 0)}
              >
                {t('quiz.addOption')}
              </Button>
            </div>
          </fieldset>
        </Panel>
      ))}

      <div>
        <Button variant="outline" leftIcon={<Icon as={Plus} size={14} />} onClick={() => set('questions', [...values.questions, blankQuestion()])} disabled={locked || values.questions.length >= (limits?.questions.max ?? 0)} data-add-question>
          {t('quiz.addQuestion')}
        </Button>
      </div>

      {errors.questions && <p className={styles.error}>{errorText.field('questions', errors.questions)}</p>}
      {form.failure && <NoticeBanner>{errorText.code(form.failure)}</NoticeBanner>}
      <div className={styles.actions}>
        {isSuccess && (
          <span className={styles.saved} role="status">
            {t('builder.saved')}
          </span>
        )}
        <Button type="submit" loading={isLoading} disabled={locked} data-save-quiz>
          {t('quiz.save')}
        </Button>
      </div>
    </form>
  )
}
