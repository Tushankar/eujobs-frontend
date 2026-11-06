import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarX } from 'lucide-react'
import { SkeletonRegion, Skeleton } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { usePreferences } from '@/lib/preferences.js'
import { useGetDocumentRequestQuery, useGetInterviewQuery } from '../api.js'

/**
 * /{role}/interviews/:itemId and /{role}/document-requests/:itemId (notifications and emails, §3.21, §3.23): the item
 * lives as a card in its thread, so this opens the thread at the card; a missing item says it is no longer available.
 */
export default function ItemRedirect({ kind }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const { itemId } = useParams()
  const interview = useGetInterviewQuery(itemId, { skip: kind !== 'interview' })
  const request = useGetDocumentRequestQuery(itemId, { skip: kind !== 'document_request' })
  const { data, isError } = kind === 'interview' ? interview : request
  const conversationId = data?.conversationId
  useEffect(() => {
    if (conversationId) navigate(`/${me.role}/messages/${conversationId}?card=${itemId}`, { replace: true })
  }, [conversationId, itemId, me.role, navigate])
  if (isError) return <EmptyState icon={CalendarX} title={t('notifications:unavailable')} />
  return (
    <SkeletonRegion>
      <Skeleton shape="block" height={240} />
    </SkeletonRegion>
  )
}
