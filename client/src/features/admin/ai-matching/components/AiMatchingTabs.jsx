import { useTranslation } from 'react-i18next'
import { Gauge, SlidersHorizontal } from 'lucide-react'
import QueueTabs from '@/features/admin/moderation/components/QueueTabs.jsx'

/** Admin › AI & matching: the matching policies and the Usage tab (2026-11-17), each a route. */
export default function AiMatchingTabs({ value, policies }) {
  const { t } = useTranslation('aiMatching')
  return (
    <QueueTabs
      value={value}
      tabs={[
        { id: 'policies', label: t('tabs.policies'), icon: SlidersHorizontal, count: policies, loading: value === 'policies' && policies === undefined, to: '/admin/ai-matching' },
        { id: 'usage', label: t('tabs.usage'), icon: Gauge, to: '/admin/ai-matching/usage' },
      ]}
    />
  )
}
