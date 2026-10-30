import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useAuditLog } from '@/features/admin/audit-logs/hooks/useAuditLog.js'
import CreatePolicyModal from '../components/CreatePolicyModal.jsx'
import { EvidenceExplanation, MatchSummaryOversight } from '../components/OversightSection.jsx'
import PolicyEditor from '../components/PolicyEditor.jsx'
import PolicySidebar from '../components/PolicySidebar.jsx'
import { useMatchingPolicies } from '../hooks/useMatchingPolicies.js'
import styles from './AiMatchingPage.module.css'

const LIST_PATH = '/admin/ai-matching'

/**
 * AI & matching. Also serves /admin/ai-matching/policies/new, which is this page with the
 * "Create matching policy" dialog open (the Figma frame is that dialog over this page).
 */
export default function AiMatchingPage() {
  const navigate = useNavigate()
  const isCreating = useParams()['*'] === 'policies/new'
  const { policies, activeId, addPolicy, saveSignals, activate } = useMatchingPolicies()
  const { record } = useAuditLog()
  const [selectedId, setSelectedId] = useState(activeId)
  const [notice, setNotice] = useState('')
  const selected = policies.find((policy) => policy.id === selectedId) ?? policies[0]

  function handleCreate({ name, description }) {
    const id = addPolicy({ name, description })
    record({
      title: 'Matching policy draft created',
      category: 'Policy',
      detail: `Draft policy “${name}” was created with every approved signal on. Human review stays required.`,
    })
    setSelectedId(id)
    setNotice(`Draft policy “${name}” was created on this device. Review its signals, then make it active.`)
    navigate(LIST_PATH)
  }

  function handleSave(id, signals) {
    saveSignals(id, signals)
    record({
      title: 'Matching policy saved',
      category: 'Policy',
      detail: `Signals for “${selected.name}” were reviewed and saved. Human review stays required.`,
    })
  }

  function handleActivate(id) {
    activate(id)
    record({
      title: 'Matching policy activated',
      category: 'Policy',
      detail: `“${selected.name}” is now the active matching policy on this device.`,
    })
  }

  return (
    <>
      <PageTitle
        eyebrow="Responsible AI"
        title="Make the reasoning visible."
        description="Role-relevant signals. Clear evidence. Human decisions, always."
        actions={
          <Button leftIcon={<Icon as={Plus} size={14} />} onClick={() => navigate(`${LIST_PATH}/policies/new`)}>
            Create policy
          </Button>
        }
      />

      <div role="status">{notice && <p className={styles.notice}>{notice}</p>}</div>

      <div className={styles.grid}>
        <PolicyEditor
          key={selected.id}
          policy={selected}
          isActive={selected.id === activeId}
          onSave={handleSave}
          onActivate={handleActivate}
        />
        <PolicySidebar policies={policies} activeId={activeId} selectedId={selected.id} onSelect={setSelectedId} />
      </div>

      <MatchSummaryOversight />
      <EvidenceExplanation />

      {isCreating && (
        <CreatePolicyModal
          existingNames={policies.map((policy) => policy.name.toLowerCase())}
          onClose={() => navigate(LIST_PATH)}
          onCreate={handleCreate}
        />
      )}
    </>
  )
}
