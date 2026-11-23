import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { hiringPath } from '@/app/roles.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useGetBooksQuery, useInviteTalentMutation, useTalentActionMutation } from '../api.js'
import styles from './InviteToBooks.module.css'

const TONE = { active: 'success', awaiting_agreement: 'info', requested: 'warning' }

/**
 * 2026-11-20: on a candidate's profile, for agencies: where they stand with the agency's books, and the action that
 * moves them on (invite, accept their request). Invites follow the messaging rule (the server answers 402 otherwise).
 */
export default function InviteToBooks({ candidateId }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { me } = usePreferences()
  const { data } = useGetBooksQuery(undefined, { skip: me?.role !== 'agency' })
  const [invite, { isLoading: inviting }] = useInviteTalentMutation()
  const [act, { isLoading: accepting }] = useTalentActionMutation()
  const [failure, setFailure] = useState(null)
  if (me?.role !== 'agency' || !data) return null
  const member = data.items.find((item) => item.candidate.id === candidateId)
  const open = member && ['requested', 'awaiting_agreement', 'active'].includes(member.status)

  async function run(work) {
    setFailure(null)
    try {
      await work().unwrap()
    } catch (error) {
      if (errorCode(error) !== 'PLAN_REQUIRED') setFailure(error)
    }
  }

  return (
    <div className={styles.root} data-books-state={member?.status ?? 'none'}>
      {open && (
        <p className={styles.state}>
          <PillBadge tone={TONE[member.status]}>{t(`enums:membershipStatus.${member.status}`)}</PillBadge>
          <Link to={hiringPath(member.status === 'active' ? 'talent' : 'talent?tab=requests')}>{t('agency:invite.openTalent')}</Link>
        </p>
      )}
      {!open && (
        <Button variant="outline" fullWidth leftIcon={<Icon as={UserPlus} size={14} />} loading={inviting} onClick={() => run(() => invite(candidateId))} data-invite-books>
          {t('agency:invite.invite')}
        </Button>
      )}
      {member?.status === 'requested' && (
        <Button fullWidth loading={accepting} onClick={() => run(() => act({ id: member.id, action: 'accept' }))}>
          {t('agency:invite.acceptRequest')}
        </Button>
      )}
      {failure && (
        <p className={styles.failure} role="alert">
          {errorText.code(failure)}
        </p>
      )}
    </div>
  )
}
