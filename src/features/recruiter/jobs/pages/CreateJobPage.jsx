import { useNavigate, useParams } from 'react-router-dom'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import JobNotFound from '../components/JobNotFound.jsx'
import JobWizard from '../components/JobWizard.jsx'
import { EMPTY_VALUES, jobToValues, valuesToJob } from '../data/jobFields.js'
import { useJobs } from '../hooks/useJobs.js'
import styles from './CreateJobPage.module.css'

const DRAFT_KEY = 'lwm.recruiter.jobWizardDraft'
const INITIAL_DRAFT = { values: EMPTY_VALUES, step: 0 }

const NEW_JOB_ACTIONS = [
  { id: 'draft', label: 'Save as draft', status: 'draft' },
  { id: 'publish', label: 'Publish job', status: 'published' },
]

function Heading({ editing }) {
  return (
    <PageTitle
      eyebrow={editing ? 'Refine your role' : 'Build your next team'}
      title={editing ? 'Make the brief even clearer.' : 'Great hiring starts with clarity.'}
      description="Turn your role into structured requirements. AI assists; you set the direction."
    />
  )
}

function NewJob() {
  const navigate = useNavigate()
  const { addJob } = useJobs()
  // The wizard's in-progress values persist ("New job drafts are automatically saved in this browser").
  const [draft, setDraft] = useLocalStorage(DRAFT_KEY, INITIAL_DRAFT)

  function finish(values, action) {
    const id = addJob({ ...valuesToJob(values), status: action.status })
    setDraft(INITIAL_DRAFT)
    navigate(`/recruiter/jobs/${id}`, {
      state: {
        notice:
          action.status === 'published'
            ? 'Job published. It now appears in your open roles.'
            : 'Draft saved. Find it under Draft in your jobs.',
      },
    })
  }

  return (
    <>
      <Heading />
      <div className={styles.wizard}>
        <JobWizard
          initialValues={draft.values}
          initialStep={draft.step}
          note="New job drafts are automatically saved in this browser."
          finishActions={NEW_JOB_ACTIONS}
          onProgress={setDraft}
          onCancel={() => navigate('/recruiter/jobs')}
          onFinish={finish}
        />
      </div>
    </>
  )
}

function EditJob({ jobId }) {
  const navigate = useNavigate()
  const { getJob, updateJob } = useJobs()
  const job = getJob(jobId)
  if (!job) return <JobNotFound />

  const finishActions =
    job.status === 'draft' ? NEW_JOB_ACTIONS : [{ id: 'save', label: 'Save changes', status: job.status }]

  function finish(values, action) {
    updateJob(jobId, { ...valuesToJob(values), status: action.status })
    navigate(`/recruiter/jobs/${jobId}`, { state: { notice: 'Changes saved on this device.' } })
  }

  return (
    <>
      <Heading editing />
      <div className={styles.wizard}>
        <JobWizard
          key={jobId}
          initialValues={jobToValues(job)}
          note="Changes are saved on this device when you finish."
          cancelLabel="Cancel"
          finishActions={finishActions}
          onCancel={() => navigate(`/recruiter/jobs/${jobId}`)}
          onFinish={finish}
        />
      </div>
    </>
  )
}

export default function CreateJobPage() {
  const { jobId } = useParams()
  return jobId ? <EditJob jobId={jobId} /> : <NewJob />
}
