import { ShieldCheck } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { formatDate } from '@/features/admin/audit-logs/utils/formatDate.js'
import { cx } from '@/utils/cx.js'
import styles from './PolicySidebar.module.css'

/** Right column: policy library (select a policy), guidance card and service status. */
export default function PolicySidebar({ policies, activeId, selectedId, onSelect }) {
  return (
    <div className={styles.column}>
      <Panel padding={24}>
        <SectionTitle title="Policy library" description="Select a policy to review or activate." />
        <ul className={styles.list}>
          {policies.map((policy) => (
            <li key={policy.id}>
              <button
                type="button"
                className={cx(styles.policy, policy.id === selectedId && styles.selected)}
                aria-pressed={policy.id === selectedId}
                onClick={() => onSelect(policy.id)}
              >
                <span className={styles.policyText}>
                  <span className={styles.policyName}>{policy.name}</span>
                  <span className={styles.policyMeta}>Updated {formatDate(policy.updatedAt)}</span>
                </span>
                {policy.id === activeId ? (
                  <PillBadge tone="success">Active</PillBadge>
                ) : (
                  <PillBadge tone="neutral">Draft</PillBadge>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel padding={24} selected>
        <span className={styles.shield}>
          <Icon as={ShieldCheck} size={25} strokeWidth={2} />
        </span>
        <h3 className={styles.guidanceTitle}>Evidence. Not absolutes.</h3>
        <p className={styles.guidanceText}>
          Never use protected characteristics as matching inputs. Show potential gaps alongside strengths, and make every
          recommendation reviewable.
        </p>
      </Panel>

      <Panel padding={24}>
        <h3 className={styles.statusTitle}>Service status</h3>
        <PillBadge tone="warning" dot>
          AI backend not connected
        </PillBadge>
        <p className={styles.statusText}>
          Local skill comparisons and editable previews are available. Model performance, confidence, and semantic
          quality require a connected service and evaluation data.
        </p>
      </Panel>
    </div>
  )
}
