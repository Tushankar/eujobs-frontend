import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import { useWriteJobSummaryMutation } from '../api.js'
import AiButton from './AiButton.jsx'
import JobSummaryDialog from './JobSummaryDialog.jsx'

/** M-059: the AI job summary on a candidate card or a recruiter row; Free candidates see the lock (M-118). */
export default function JobSummaryButton({ job, className }) {
  const { t } = useTranslation('ai')
  const [open, setOpen] = useState(false)
  const [write, state] = useWriteJobSummaryMutation()
  const request = () => write(job.id).catch(() => {})

  function handleOpen() {
    setOpen(true)
    if (!state.data) request()
  }

  return (
    <>
      <AiButton
        variant="ghost"
        size="sm"
        className={className}
        leftIcon={<img src={aiSparkle} alt="" width={14} height={14} />}
        aria-label={t('jobSummary.actionLabel', { title: job.title })}
        onClick={handleOpen}
        data-job-summary-button
      >
        {t('jobSummary.action')}
      </AiButton>
      <JobSummaryDialog open={open} job={job} state={state} onRetry={request} onClose={() => setOpen(false)} />
    </>
  )
}
