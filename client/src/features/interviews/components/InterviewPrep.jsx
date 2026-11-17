import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import { usePrepareInterviewMutation } from '@/features/ai/api.js'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import styles from './InterviewPrep.module.css'

/**
 * "Prepare with AI" on a candidate's confirmed interview (owner 2026-11-17): the questions the interviewer is likely to
 * ask about this job, each with a talking point from the candidate's own profile, and three questions to ask them.
 * One AI use; opening it again for the same interview and profile is answered from the server cache.
 */
export default function InterviewPrep({ interview }) {
  const { t } = useTranslation('interviews')
  const [open, setOpen] = useState(false)
  const [prepare, state] = usePrepareInterviewMutation()
  const run = () => prepare(interview.id)

  return (
    <>
      <AiButton
        variant="outline"
        size="sm"
        leftIcon={<Icon as={Sparkles} size={13} />}
        onClick={() => {
          setOpen(true)
          if (!state.data) run()
        }}
        data-interview-prep={interview.id}
      >
        {t('prep.action')}
      </AiButton>
      {open && (
        <Modal open onClose={() => setOpen(false)} width={600} title={t('prep.title')} description={t('prep.description')} footer={<Button onClick={() => setOpen(false)}>{t('prep.close')}</Button>}>
          <AiStatus isLoading={state.isLoading} error={state.error} onRetry={run}>
            {state.data && (
              <div className={styles.prep} data-interview-prep-result>
                <ol className={styles.questions}>
                  {state.data.questions.map((item) => (
                    <li key={item.question}>
                      <p className={styles.question}>{item.question}</p>
                      <p className={styles.point}>{item.talkingPoint}</p>
                    </li>
                  ))}
                </ol>
                {state.data.askThem.length > 0 && (
                  <section>
                    <h3 className={styles.heading}>{t('prep.askThem')}</h3>
                    <ul className={styles.ask}>
                      {state.data.askThem.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </AiStatus>
        </Modal>
      )}
    </>
  )
}
