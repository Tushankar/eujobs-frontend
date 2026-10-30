import { useState } from 'react'
import { Button, Panel, Switch } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { HUMAN_REVIEW_SIGNAL, POLICY_SIGNALS } from '../data/matching.js'
import styles from './PolicyEditor.module.css'

/**
 * Review and edit the signals of one matching policy. Changes stay a draft until "Save reviewed policy";
 * the parent keys this component by policy id so switching policies resets the draft.
 */
export default function PolicyEditor({ policy, isActive, onSave, onActivate }) {
  const [signals, setSignals] = useState(policy.signals)
  const [message, setMessage] = useState('')

  function handleSave() {
    onSave(policy.id, signals)
    setMessage('Policy saved on this device.')
  }

  function handleActivate() {
    onActivate(policy.id)
    setMessage('This policy is now the active policy on this device.')
  }

  return (
    <Panel padding={28}>
      <SectionTitle title={policy.name} description={policy.description}>
        {isActive && (
          <PillBadge tone="success" dot>
            Active
          </PillBadge>
        )}
      </SectionTitle>

      <div className={styles.signals}>
        {POLICY_SIGNALS.map((signal) => (
          <div className={styles.row} key={signal.id}>
            <div className={styles.copy}>
              <p className={styles.label}>{signal.label}</p>
              <p className={styles.description}>{signal.description}</p>
            </div>
            <Switch
              size="lg"
              label={signal.label}
              checked={signals[signal.id]}
              onChange={(checked) => setSignals((current) => ({ ...current, [signal.id]: checked }))}
            />
          </div>
        ))}
        <div className={styles.row}>
          <div className={styles.copy}>
            <p className={styles.label}>{HUMAN_REVIEW_SIGNAL.label}</p>
            <p className={styles.description}>{HUMAN_REVIEW_SIGNAL.description}</p>
          </div>
          <Switch size="lg" label={HUMAN_REVIEW_SIGNAL.label} checked disabled onChange={() => {}} />
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={handleSave}>Save reviewed policy</Button>
        {!isActive && (
          <Button variant="outline" onClick={handleActivate}>
            Make active
          </Button>
        )}
      </div>
      <p className={styles.note}>
        Policy settings are stored locally. A connected backend would apply them to semantic ranking and record versioned
        explanations.
      </p>
      <p className={styles.message} role="status">
        {message}
      </p>
    </Panel>
  )
}
