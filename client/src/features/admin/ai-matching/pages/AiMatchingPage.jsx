import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useGetPoliciesQuery } from '../api.js'
import CreatePolicyModal from '../components/CreatePolicyModal.jsx'
import OversightSection from '../components/OversightSection.jsx'
import PolicyEditor from '../components/PolicyEditor.jsx'
import PolicySidebar from '../components/PolicySidebar.jsx'
import styles from './AiMatchingPage.module.css'

const LIST_PATH = '/admin/ai-matching'

/**
 * AI & matching (M-048, M-049, M-068). Also serves /admin/ai-matching/policies/new, which is this page with the
 * "Create matching policy" dialog open (the Figma frame is that dialog over this page). The server audits every
 * policy change (category Policy, M-162).
 */
export default function AiMatchingPage() {
  const { t } = useTranslation('aiMatching')
  const navigate = useNavigate()
  const isCreating = useParams()['*'] === 'policies/new'
  // Leaving the create route remounts the page, so the new policy and the notice travel in the navigation state.
  const { state } = useLocation()
  const { data, isError } = useGetPoliciesQuery()
  const [selectedId, setSelectedId] = useState(state?.selectedId ?? null)
  const notice = state?.notice ?? ''
  const policies = data?.items ?? []
  // A chosen policy is never swapped for another one (the editor would edit the wrong policy); without a choice, the active one.
  const selected = selectedId ? policies.find((policy) => policy.id === selectedId) : (policies.find((policy) => policy.status === 'active') ?? policies[0])

  function handleCreated(policy) {
    setSelectedId(policy.id)
    navigate(LIST_PATH, { state: { selectedId: policy.id, notice: t('create.created', { name: policy.name }) } })
  }

  return (
    <>
      <PageTitle
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={t('page.description')}
        actions={
          <Button leftIcon={<Icon as={Plus} size={14} />} onClick={() => navigate(`${LIST_PATH}/policies/new`)}>
            {t('page.create')}
          </Button>
        }
      />

      <div role="status">{notice && <p className={styles.notice}>{notice}</p>}</div>
      {isError && <p className={styles.notice}>{t('page.loadError')}</p>}

      {selected && (
        <div className={styles.grid}>
          <PolicyEditor key={selected.id} policy={selected} />
          <PolicySidebar policies={policies} selectedId={selected.id} onSelect={setSelectedId} />
        </div>
      )}

      <OversightSection />

      {isCreating && <CreatePolicyModal onClose={() => navigate(LIST_PATH)} onCreated={handleCreated} />}
    </>
  )
}
