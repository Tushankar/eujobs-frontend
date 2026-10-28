import { LockKeyhole } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { compareSkills } from '../utils/cvVersions.js'
import styles from './ComparePanel.module.css'

function difference(older, newer) {
  const { added, removed } = compareSkills(older, newer)
  const parts = []
  if (added.length) parts.push(`Only in Version ${newer.version}: ${added.join(', ')}.`)
  if (removed.length) parts.push(`Only in Version ${older.version}: ${removed.join(', ')}.`)
  return parts.length
    ? parts.join(' ')
    : `Versions ${older.version} and ${newer.version} record the same role, experience, and skills.`
}

/** Side panel of the CV page: recorded role, experience and skills of the (up to two) selected versions. */
export default function ComparePanel({ selected }) {
  const ordered = [...selected].sort((a, b) => a.version - b.version)
  return (
    <Panel as="aside" padding={20} className={styles.panel} aria-labelledby="compare-heading">
      <h2 className={styles.heading} id="compare-heading">
        Compare snapshots
      </h2>
      <p className={styles.lead}>Select up to two versions. File contents are not retained in this browser demo.</p>

      {ordered.length === 0 ? (
        <p className={styles.empty}>Choose Compare on a version to inspect its recorded role, experience, and skills.</p>
      ) : (
        <div className={styles.snapshots} aria-live="polite">
          {ordered.map((version) => (
            <section key={version.id} className={styles.snapshot}>
              <h3 className={styles.snapshotTitle}>Version {version.version}</h3>
              <dl className={styles.facts}>
                <dt>Role</dt>
                <dd>{version.snapshot.role}</dd>
                <dt>Experience</dt>
                <dd>{version.snapshot.experience}</dd>
                <dt>Skills</dt>
                <dd>
                  <ul className={styles.skills}>
                    {version.snapshot.skills.map((skill) => (
                      <li key={skill}>
                        <PillBadge tone="primary">{skill}</PillBadge>
                      </li>
                    ))}
                  </ul>
                </dd>
              </dl>
            </section>
          ))}
          {ordered.length === 2 && <p className={styles.difference}>{difference(ordered[0], ordered[1])}</p>}
        </div>
      )}

      <div className={styles.notice}>
        <span className={styles.noticeIcon}>
          <Icon as={LockKeyhole} size={16} />
        </span>
        <p>
          Employers never receive historical or original versions automatically. A production request requires
          candidate consent and platform authorization.
        </p>
      </div>
    </Panel>
  )
}
