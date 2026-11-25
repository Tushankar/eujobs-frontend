import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CircleCheck, Clock, FileText, Info, Users, UserPlus } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { hiringPath } from '@/app/roles.js'
import { Avatar, Button, Icon, Modal, Skeleton } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useGetAgreementQuery, useGetBooksQuery, useInviteTalentMutation, useTalentActionMutation } from '../api.js'
import styles from './InviteToBooks.module.css'

const TONE = { active: 'success', awaiting_agreement: 'info', requested: 'warning' }
const STATE_ICON = { active: CircleCheck, awaiting_agreement: Clock, requested: Clock }

/**
 * 2026-11-25: asked before an invitation goes out. Shows who is invited, what happens next (they are notified, agree
 * to the current agreement version, then can be placed) and how to take it back. Without a published agreement the
 * server refuses invites, so the dialog sends the agency to publish it instead.
 */
function ConfirmInvite({ open, candidate, sending, failure, onConfirm, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: agreement, isLoading } = useGetAgreementQuery(undefined, { skip: !open })
  const current = agreement?.current ?? null
  const missing = !isLoading && agreement && !current
  const name = candidate.fullName

  const footer = missing ? (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t('common:cancel')}
      </Button>
      <Button as={Link} to={hiringPath('talent?tab=agreement')} leftIcon={<Icon as={FileText} size={14} />}>
        {t('agency:invite.confirm.openAgreement')}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t('common:cancel')}
      </Button>
      <Button leftIcon={<Icon as={UserPlus} size={14} />} loading={sending} disabled={isLoading} onClick={onConfirm} data-invite-confirm>
        {t('agency:invite.confirm.send')}
      </Button>
    </>
  )

  return (
    <Modal open={open} onClose={onClose} width={480} title={t('agency:invite.confirm.title', { name })} description={t('agency:invite.confirm.description')} footer={footer}>
      <div className={styles.person}>
        <Avatar name={name} src={candidate.photoUrl ?? undefined} size={48} />
        <div className={styles.personText}>
          <p className={styles.personName}>{name}</p>
          <p className={styles.personHeadline}>{candidate.headline || t('agency:talent.noDetails')}</p>
        </div>
      </div>

      {missing ? (
        <p className={styles.notice} role="status">
          <Icon as={Info} size={16} />
          <span>{t('agency:invite.confirm.noAgreement')}</span>
        </p>
      ) : (
        <>
          <h3 className={styles.stepsTitle}>{t('agency:invite.confirm.nextTitle')}</h3>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                1
              </span>
              <div>
                <p className={styles.stepTitle}>{t('agency:invite.confirm.step1Title')}</p>
                <p className={styles.stepText}>{t('agency:invite.confirm.step1Text', { name })}</p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                2
              </span>
              <div>
                <p className={styles.stepTitle}>{t('agency:invite.confirm.step2Title')}</p>
                {isLoading ? (
                  <Skeleton width="80%" />
                ) : (
                  <p className={styles.stepText}>
                    {t('agency:invite.confirm.step2Text', { name, version: current?.version })}{' '}
                    {current?.file?.url && (
                      <a className={styles.link} href={current.file.url} target="_blank" rel="noreferrer">
                        {t('agency:invite.confirm.viewAgreement')}
                      </a>
                    )}
                  </p>
                )}
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                3
              </span>
              <div>
                <p className={styles.stepTitle}>{t('agency:invite.confirm.step3Title')}</p>
                <p className={styles.stepText}>{t('agency:invite.confirm.step3Text')}</p>
              </div>
            </li>
          </ol>
          <p className={styles.note}>
            <Icon as={Info} size={14} />
            <span>{t('agency:invite.confirm.withdrawNote')}</span>
          </p>
        </>
      )}

      {failure && (
        <p className={`${styles.failure} ${styles.dialogFailure}`} role="alert">
          {errorText.code(failure)}
        </p>
      )}
    </Modal>
  )
}

/**
 * 2026-11-20: on a candidate's profile, for agencies: where they stand with the agency's books, and the action that
 * moves them on (invite, accept their request). Invites follow the messaging rule (the server answers 402 otherwise).
 */
export default function InviteToBooks({ candidate }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { me } = usePreferences()
  const { data } = useGetBooksQuery(undefined, { skip: me?.role !== 'agency' })
  const [invite, { isLoading: inviting }] = useInviteTalentMutation()
  const [act, { isLoading: accepting }] = useTalentActionMutation()
  const [failure, setFailure] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [inviteFailure, setInviteFailure] = useState(null)
  if (me?.role !== 'agency' || !data) return null
  const member = data.items.find((item) => item.candidate.id === candidate.id)
  const open = member && ['requested', 'awaiting_agreement', 'active'].includes(member.status)

  async function run(work) {
    setFailure(null)
    try {
      await work().unwrap()
    } catch (error) {
      if (errorCode(error) !== 'PLAN_REQUIRED') setFailure(error)
    }
  }

  function startInvite() {
    setInviteFailure(null)
    setConfirming(true)
  }

  // Sent: the dialog closes and the success modal takes over. A plan wall closes it too, for the upgrade dialog.
  async function sendInvite() {
    setInviteFailure(null)
    try {
      await invite(candidate.id).unwrap()
      setConfirming(false)
    } catch (error) {
      if (errorCode(error) === 'PLAN_REQUIRED') setConfirming(false)
      else setInviteFailure(error)
    }
  }

  return (
    <div className={styles.root} data-books-state={member?.status ?? 'none'}>
      {/* 2026-11-23 (owner: align it): the place on the books as a line, then a full-width button like the others. */}
      {open && (
        <>
          <p className={`${styles.state} ${styles[TONE[member.status]]}`}>
            <Icon as={STATE_ICON[member.status]} size={14} />
            {t(`enums:membershipStatus.${member.status}`)}
          </p>
          <Button as={Link} to={hiringPath(member.status === 'active' ? 'talent' : 'talent?tab=requests')} variant="outline" fullWidth leftIcon={<Icon as={Users} size={14} />}>
            {t('agency:invite.openTalent')}
          </Button>
        </>
      )}
      {!open && (
        <Button variant="outline" fullWidth leftIcon={<Icon as={UserPlus} size={14} />} onClick={startInvite} data-invite-books>
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
      <ConfirmInvite
        open={confirming}
        candidate={candidate}
        sending={inviting}
        failure={inviteFailure}
        onConfirm={sendInvite}
        onClose={() => !inviting && setConfirming(false)}
      />
    </div>
  )
}
