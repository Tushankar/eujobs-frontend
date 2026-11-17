import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Undo2 } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { Button, Icon, Panel, SelectField } from '@/components/ui'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { useSuggestQuizQuestionsMutation } from '../../ai/api.js'
import styles from './builder.module.css'

const COUNTS = [3, 5, 10]

/**
 * "Suggest questions with AI" (owner 2026-11-17, phase 4): `count` multiple-choice questions drafted from the lesson
 * text are added after `questions` (at most `room` more fit the quiz); nothing is saved until the admin saves the
 * quiz. Undo puts the questions back as they were before. A course without lesson text gets its own message.
 */
export default function QuizAiSuggest({ courseId, questions, room, onAppend, onRestore }) {
  const { t } = useTranslation('courses')
  const [suggest, { isLoading }] = useSuggestQuizQuestionsMutation()
  const [count, setCount] = useState(5)
  const [error, setError] = useState(null)
  const [added, setAdded] = useState(null)
  const counts = room > 0 ? [...new Set(COUNTS.map((value) => Math.min(value, room)))] : [count]
  const chosen = Math.min(count, Math.max(room, 1))

  async function run() {
    setError(null)
    try {
      const before = questions
      const answer = await suggest({ id: courseId, count: chosen }).unwrap()
      onAppend(answer.questions.slice(0, room))
      setAdded({ before, count: Math.min(answer.questions.length, room) })
    } catch (failure) {
      setError(failure)
    }
  }

  const noText = errorCode(error) === 'VALIDATION_FAILED' && error.data?.error?.fields?.lessons
  return (
    <Panel padding={24} className={styles.quizAi} data-quiz-ai>
      <div>
        <h2 className={styles.heading}>{t('quiz.ai.title')}</h2>
        <p className={styles.muted}>{t('quiz.ai.hint')}</p>
      </div>
      <div className={styles.quizAiControls}>
        <SelectField
          className={styles.quizAiCount}
          label={t('quiz.ai.count')}
          value={String(chosen)}
          onChange={(event) => setCount(Number(event.target.value))}
          options={counts.map((value) => ({ value: String(value), label: String(value) }))}
          disabled={isLoading}
        />
        <Button variant="outline" leftIcon={<Icon as={Sparkles} size={13} />} loading={isLoading} disabled={room < 1} onClick={run} data-quiz-ai-run>
          {t('quiz.ai.action')}
        </Button>
      </div>
      {noText ? (
        <p className={styles.error} role="alert" data-quiz-ai-state="no-text">
          {t('quiz.ai.noText')}
        </p>
      ) : (
        <AiStatus isLoading={false} error={error} onRetry={run}>
          {added && (
            <p className={styles.quizAiDone} role="status" data-quiz-ai-added={added.count}>
              {t('quiz.ai.done', { count: added.count })}
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Icon as={Undo2} size={13} />}
                onClick={() => {
                  onRestore(added.before)
                  setAdded(null)
                }}
              >
                {t('quiz.ai.undo')}
              </Button>
            </p>
          )}
        </AiStatus>
      )}
    </Panel>
  )
}
