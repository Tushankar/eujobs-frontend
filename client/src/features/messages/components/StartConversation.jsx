import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import { usePreferences } from '@/lib/preferences.js'
import { messagesApi, useCompanyMessageStart, useStartConversationMutation } from '../api.js'
import MessageForm from './MessageForm.jsx'

const FORM_ID = 'start-conversation-form'
const messageIcon = <Icon as={MessageSquare} size={14} strokeWidth={2} />

/** The thread with this counterpart (a company for candidates, a candidate for recruiters), if there is one. */
function useExistingConversation(counterpartId) {
  const { data } = messagesApi.useGetConversationsQuery()
  return data?.items.find((conversation) => conversation.counterpart?.id === counterpartId)
}

function OpenConversationLink({ conversation, ...buttonProps }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  return (
    <Button as={Link} to={`/${me.role}/messages/${conversation.id}`} variant="outline" leftIcon={messageIcon} data-open-conversation {...buttonProps}>
      {t('messages:start.open')}
    </Button>
  )
}

/**
 * The first message of a new thread (M-086): `body` is the start request without the text; `initialBody` prefills
 * the message (the recruiter's outreach template, M-088). Sending opens the thread.
 */
function StartConversationDialog({ body, initialBody = '', title, description, onClose }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const [start] = useStartConversationMutation()
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form={FORM_ID}>
            {t('messages:start.send')}
          </Button>
        </>
      }
    >
      <MessageForm
        formId={FORM_ID}
        initialBody={initialBody}
        rows={6}
        autoFocus
        onSubmit={async (text) => {
          const result = await start({ ...body, body: text }).unwrap()
          navigate(`/${me.role}/messages/${result.conversation.id}`)
        }}
      />
    </Modal>
  )
}

/** Recruiter outreach from a candidate profile (M-085, M-088): the template in the recruiter's UI language. */
export function MessageCandidateButton({ candidate, job }) {
  const { t } = useTranslation()
  const existing = useExistingConversation(candidate.id)
  const [open, setOpen] = useState(false)
  const firstName = candidate.fullName.split(' ')[0]
  if (existing) return <OpenConversationLink conversation={existing} fullWidth />
  return (
    <>
      <Button variant="outline" fullWidth leftIcon={messageIcon} data-start-conversation onClick={() => setOpen(true)}>
        {t('messages:outreach.button')}
      </Button>
      {open && (
        <StartConversationDialog
          body={{ candidateId: candidate.id, ...(job && { jobId: job.id }) }}
          initialBody={job ? t('messages:outreach.template', { firstName, job: job.title }) : t('messages:outreach.templateNoJob', { firstName })}
          title={t('messages:outreach.title', { firstName })}
          description={t('messages:outreach.description')}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** A paid candidate's first message to a company they applied to (M-084), about `job`. */
export function CompanyMessageDialog({ job, onClose }) {
  const { t } = useTranslation()
  return (
    <StartConversationDialog
      body={{ jobId: job.id }}
      title={t('messages:start.title', { company: job.company.displayName })}
      description={t('messages:start.description', { job: job.title })}
      onClose={onClose}
    />
  )
}

/**
 * "Message the company": opens the existing thread, or the start dialog (the upgrade without the plan). Inside
 * another dialog, pass `onStart` so the caller closes that one first and then opens CompanyMessageDialog itself.
 */
export function MessageCompanyButton({ job, onStart, ...buttonProps }) {
  const { t } = useTranslation()
  const startWith = useCompanyMessageStart()
  const existing = useExistingConversation(job.company.id)
  const [open, setOpen] = useState(false)
  if (existing) return <OpenConversationLink conversation={existing} {...buttonProps} />

  const handleClick = () => (onStart ? onStart() : startWith(() => setOpen(true)))
  return (
    <>
      <Button variant="outline" leftIcon={messageIcon} data-start-conversation onClick={handleClick} {...buttonProps}>
        {t('messages:start.button')}
      </Button>
      {open && <CompanyMessageDialog job={job} onClose={() => setOpen(false)} />}
    </>
  )
}
