import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, RotateCcw } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetQuizQuery, useSubmitAttemptMutation } from '../api.js'
import CertificateBlock from '../components/CertificateBlock.jsx'
import { useLearningPath } from '../useCourseText.js'
import styles from './QuizPage.module.css'

/**
 * /…/learning/:courseId/quiz (M-104): unlocked once every lesson is complete; single and multiple choice with the
 * options in a new order on every visit; the score is shown but never the correct answers; unlimited attempts, the
 * best score kept; the first pass completes the course and shows the certificate (M-105).
 */
export default function QuizPage() {
  const { t } = useTranslation('learning')
  const format = useFormat()
  const errorText = useErrorText()
  const { courseId } = useParams()
  const base = useLearningPath()
  const { data: quiz, error, refetch, isFetching } = useGetQuizQuery(courseId)
  const [submit, { data: result, isLoading, error: submitError, reset }] = useSubmitAttemptMutation()
  const [answers, setAnswers] = useState({})
  const coursePath = `${base}/${courseId}`
  const percent = (value) => format.number(value / 100, { style: 'percent' })

  const back = (
    <Link to={coursePath} className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      {t('lesson.back')}
    </Link>
  )
  if (error) return <>{back}<NoticeBanner>{errorText.code(error)}</NoticeBanner></>
  if (!quiz) return back
  if (!quiz.unlocked) {
    return (
      <>
        {back}
        <EmptyState icon={LockKeyhole} title={t('quiz.lockedTitle')} description={t('quiz.lockedText')} action={<Button as={Link} to={coursePath}>{t('lesson.toCourse')}</Button>} />
      </>
    )
  }

  const choose = (question, optionId, checked) =>
    setAnswers((current) => ({
      ...current,
      [question.id]: question.type === 'single' ? [optionId] : checked ? [...(current[question.id] ?? []), optionId] : (current[question.id] ?? []).filter((id) => id !== optionId),
    }))
  const complete = quiz.questions.every((question) => answers[question.id]?.length > 0)

  async function handleSubmit(event) {
    event.preventDefault()
    await submit({ courseId, answers: quiz.questions.map((question) => ({ questionId: question.id, optionIds: answers[question.id] ?? [] })) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function retry() {
    reset()
    setAnswers({})
    await refetch()
  }

  const certificate = result?.certificate ?? quiz.certificate
  return (
    <>
      {back}
      <PageTitle
        eyebrow={quiz.courseTitle}
        title={t('quiz.title')}
        description={t('quiz.description', { passMark: percent(quiz.passMark), count: quiz.questions.length })}
        actions={quiz.bestScore !== null || result ? <PillBadge tone="accent">{t('quiz.best', { score: percent(result?.bestScore ?? quiz.bestScore) })}</PillBadge> : null}
      />

      {result && (
        <Panel padding={24} className={styles.result} data-quiz-result={result.passed ? 'passed' : 'failed'}>
          <p className={styles.score}>{percent(result.scorePercent)}</p>
          <p className={styles.verdict}>{t(result.passed ? 'quiz.passed' : 'quiz.failed', { passMark: percent(result.passMark) })}</p>
          <p className={styles.muted}>{t('quiz.noAnswers')}</p>
          <div>
            <Button variant="outline" leftIcon={<Icon as={RotateCcw} size={14} />} loading={isFetching} onClick={retry} data-quiz-retry>
              {t('quiz.retry')}
            </Button>
          </div>
        </Panel>
      )}
      {certificate && <div className={styles.certificate}><CertificateBlock certificate={certificate} /></div>}

      {!result && (
        <form onSubmit={handleSubmit} className={styles.form} data-quiz-form>
          {quiz.questions.map((question, index) => (
            <Panel key={question.id} padding={24} as="fieldset" className={styles.question} data-quiz-question={index}>
              <legend className={styles.legend}>
                {index + 1}. {question.text}
              </legend>
              <p className={styles.muted}>{t(question.type === 'single' ? 'quiz.chooseOne' : 'quiz.chooseAll')}</p>
              {question.options.map((option) => (
                <label key={option.id} className={styles.option}>
                  <input
                    type={question.type === 'single' ? 'radio' : 'checkbox'}
                    name={question.id}
                    checked={(answers[question.id] ?? []).includes(option.id)}
                    onChange={(event) => choose(question, option.id, event.target.checked)}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </Panel>
          ))}
          {submitError && <NoticeBanner>{errorText.code(submitError)}</NoticeBanner>}
          <div className={styles.actions}>
            {!complete && <span className={styles.muted}>{t('quiz.answerAll')}</span>}
            <Button type="submit" loading={isLoading} disabled={!complete} data-quiz-submit>
              {t('quiz.submit')}
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
