import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import StageSelect from '@/features/recruiter/hiring-pipeline/components/StageSelect.jsx'
import { useMoveApplicationMutation, useRejectApplicationMutation } from '../api.js'
import styles from './ApplicationStageSelect.module.css'

const NOT_SELECTED = 'not_selected'

/**
 * One stage select per application (M-071): the company's stages plus "Not selected", which asks first and offers
 * "Email the candidate" (M-090, checked by default). Choosing a stage again undoes a rejection (OQ-6e). A withdrawn
 * application has no select (M-076).
 */
export default function ApplicationStageSelect({ application, candidateName, jobTitle, stages, variant, label }) {
  const { t } = useTranslation()
  const [move] = useMoveApplicationMutation()
  const [reject] = useRejectApplicationMutation()
  const [rejecting, setRejecting] = useState(false)
  const [notify, setNotify] = useState(true)

  if (application.status === 'withdrawn') return <PillBadge tone="neutral">{t('applications:recruiter.withdrawn')}</PillBadge>

  // Table and board rows carry `stage`, the profile's application list `stageId`.
  const value = application.status === NOT_SELECTED ? NOT_SELECTED : (application.stageId ?? application.stage.id)
  const options = [...stages.map((stage) => ({ id: stage.id, name: stage.name })), { id: NOT_SELECTED, name: t('applications:recruiter.notSelected') }]

  return (
    <>
      <span data-stage-select={application.id}>
        <StageSelect
          variant={variant}
          options={options}
          value={value}
          label={label}
          onChange={(next) => {
            if (next === NOT_SELECTED) {
              setNotify(true)
              setRejecting(true)
            } else move({ id: application.id, stageId: next })
          }}
        />
      </span>
      <ConfirmDialog
        open={rejecting}
        title={t('applications:reject.title')}
        description={t('applications:reject.description', { name: candidateName, job: jobTitle })}
        confirmLabel={t('applications:reject.confirm')}
        tone="danger"
        onClose={() => setRejecting(false)}
        onConfirm={() => {
          reject({ id: application.id, notify })
          setRejecting(false)
        }}
      >
        <Checkbox name="notify" checked={notify} onChange={(event) => setNotify(event.target.checked)}>
          {t('applications:reject.notify')}
        </Checkbox>
        <p className={styles.hint}>{t('applications:reject.notifyHint')}</p>
      </ConfirmDialog>
    </>
  )
}
