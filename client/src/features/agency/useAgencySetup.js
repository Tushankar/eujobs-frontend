import { hiringPath } from '@/app/roles.js'
import { useGetRecruiterJobsQuery } from '@/features/recruiter/jobs/api.js'
import { useGetAgreementQuery, useGetClientsQuery, useGetPlacementsQuery, useGetTalentQuery } from './api.js'

/** The agency's setup, live: each step done or not, what it waits for, and where to do it. */
export function useAgencySetup() {
  const clients = useGetClientsQuery()
  const agreement = useGetAgreementQuery()
  const jobs = useGetRecruiterJobsQuery()
  const talent = useGetTalentQuery()
  const placements = useGetPlacementsQuery()
  const loading = [clients, agreement, jobs, talent, placements].some((query) => query.isLoading)
  const hasClient = (clients.data?.items ?? []).length > 0
  const hasAgreement = Boolean(agreement.data?.current)
  const hasJob = (jobs.data?.items ?? []).some((job) => job.agency && job.status === 'published')
  const hasBooks = (talent.data?.items ?? []).some((member) => member.status === 'active')
  const hasPlacement = (placements.data?.items ?? []).some((placement) => placement.status === 'confirmed')
  const steps = [
    { key: 'client', done: hasClient, to: hiringPath('clients') },
    { key: 'agreement', done: hasAgreement, to: hiringPath('talent?tab=agreement') },
    { key: 'job', done: hasJob, locked: !hasClient, to: hiringPath('jobs/new') },
    { key: 'books', done: hasBooks, locked: !hasAgreement, to: hiringPath('talent') },
    { key: 'placement', done: hasPlacement, locked: !hasJob || !hasBooks, to: hiringPath('hiring-pipeline') },
  ]
  const next = steps.find((step) => !step.done && !step.locked)
  return { loading, steps, next, hasClient, doneCount: steps.filter((step) => step.done).length, complete: steps.every((step) => step.done) }
}
