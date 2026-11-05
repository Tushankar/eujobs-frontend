import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGetConfigQuery, useGetMeQuery } from '@/app/api.js'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useCreateJobMutation, useGetRecruiterJobQuery, usePublishLock, useSetJobStatusMutation, useUpdateJobMutation } from '../api.js'
import JobNotFound from '../components/JobNotFound.jsx'
import JobWizard from '../components/JobWizard.jsx'
import { EMPTY_VALUES, JOB_STEPS, jobToValues, validateAll, valuesToBody } from '../utils/jobForm.js'
import styles from './CreateJobPage.module.css'

const DRAFT_ACTIONS = [
  { id: 'draft', labelKey: 'jobs:wizard.saveDraft', status: 'draft' },
  { id: 'publish', labelKey: 'jobs:wizard.publish', status: 'published' },
]
const LIVE_ACTIONS = [{ id: 'save', labelKey: 'jobs:wizard.saveChanges' }]

function Heading({ editing }) {
  const { t } = useTranslation()
  return (
    <PageTitle
      eyebrow={t(editing ? 'jobs:wizard.editEyebrow' : 'jobs:wizard.newEyebrow')}
      title={t(editing ? 'jobs:wizard.editTitle' : 'jobs:wizard.newTitle')}
      description={t('jobs:wizard.description')}
    />
  )
}

/** M-041, P4-D7: the first valid Continue creates the server draft, and the wizard carries on as that draft's edit page. */
function NewJob() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me } = useGetMeQuery()
  const [createJob] = useCreateJobMutation()

  async function createDraft(values, nextStep) {
    const job = await createJob(valuesToBody(values)).unwrap()
    navigate(`/recruiter/jobs/${job.id}/edit?step=${nextStep}`, { replace: true })
  }

  return (
    <>
      <Heading />
      <div className={styles.wizard}>
        <JobWizard
          initialValues={EMPTY_VALUES}
          note={t('jobs:wizard.newNote')}
          companyName={me?.company?.displayName ?? ''}
          finishActions={DRAFT_ACTIONS}
          onContinue={createDraft}
          onCancel={() => navigate('/recruiter/jobs')}
          onFinish={() => {}}
        />
      </div>
    </>
  )
}

/** A draft saves at every step (P4-D7); a live job saves when finished and must stay publishable (M-037). */
function EditJob({ jobId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: config } = useGetConfigQuery()
  const { data: job, error } = useGetRecruiterJobQuery(jobId)
  const [updateJob] = useUpdateJobMutation()
  const [setJobStatus] = useSetJobStatusMutation()
  const publishLocked = usePublishLock()
  if (error) return <JobNotFound />
  if (!job || !config) return null

  const draft = job.status === 'draft'
  const initialValues = jobToValues(job)
  const step = Math.min(Math.max(Number(params.get('step')) || 0, 0), JOB_STEPS.length - 1)
  // Opened from a failed publish (M-039): show what is missing.
  const initialErrors = params.get('publish') ? validateAll(initialValues, config.limits).errors : {}
  const save = (values) => updateJob({ id: jobId, body: valuesToBody(values) }).unwrap()

  async function finish(values, action) {
    await save(values)
    if (action.status === 'published') await setJobStatus({ id: jobId, status: 'published' }).unwrap()
    const notice = !draft ? 'saved' : action.status === 'published' ? 'published' : 'draft'
    navigate(`/recruiter/jobs/${jobId}`, { state: { notice } })
  }

  return (
    <>
      <Heading editing={!draft} />
      <div className={styles.wizard}>
        <JobWizard
          key={jobId}
          initialValues={initialValues}
          initialStep={step}
          reachable={JOB_STEPS.length - 1}
          initialErrors={initialErrors}
          note={t(draft ? 'jobs:wizard.draftNote' : 'jobs:wizard.liveNote')}
          companyName={job.company.displayName}
          finishActions={draft ? DRAFT_ACTIONS.map((action) => ({ ...action, locked: action.status === 'published' && publishLocked(jobId) })) : LIVE_ACTIONS}
          onContinue={draft ? save : undefined}
          onCancel={() => navigate(`/recruiter/jobs/${jobId}`)}
          onFinish={finish}
        />
      </div>
    </>
  )
}

export default function CreateJobPage() {
  const { jobId } = useParams()
  return jobId ? <EditJob key={jobId} jobId={jobId} /> : <NewJob />
}
