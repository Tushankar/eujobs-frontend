import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus } from 'lucide-react'
import { Icon } from '@/components/ui'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import OfferDialog from './OfferDialog.jsx'

const CLOSED = ['withdrawn', 'not_selected']

/**
 * "Schedule interview" from the pipeline's candidate panel and the Applications rows (owner answer P11d-A6): the same
 * 2–3 slot dialog as the thread, for an active application without an interview under way (Recruiter Plus).
 */
export default function ScheduleInterviewButton({ application, compact = false }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (CLOSED.includes(application.status) || application.interview?.active) return null
  return (
    <>
      <PlanButton
        entitlement="interviews"
        roles={['recruiter']}
        variant={compact ? 'ghost' : 'outline'}
        size="sm"
        leftIcon={<Icon as={CalendarPlus} size={14} />}
        onClick={() => setOpen(true)}
        data-schedule-application={application.id}
      >
        {t('interviews:thread.schedule')}
      </PlanButton>
      {open && <OfferDialog applicationId={application.id} onClose={() => setOpen(false)} />}
    </>
  )
}
