import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel } from '@/components/ui'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import styles from './OversightSidebar.module.css'

const admin = (to) => workspacePath(WORKSPACES.admin, to)

function ListRow({ title, meta, divided, children }) {
  return (
    <li className={divided ? styles.dividedRow : styles.row}>
      <div className={styles.rowText}>
        <p className={styles.rowTitle}>{title}</p>
        <p className={styles.rowMeta}>{meta}</p>
      </div>
      {children}
    </li>
  )
}

/** Right-hand column: published roles, application coverage and the "oversight, not hiring control" note. */
export default function OversightSidebar({ roles, coverage }) {
  return (
    <aside className={styles.column} aria-label="Recruitment oversight">
      <Panel padding={24} aria-labelledby="role-activity">
        <SectionTitle id="role-activity" title="Role activity" description="Recruiter-managed marketplace status">
          <Link to={admin('jobs')} className={styles.link}>
            Manage
          </Link>
        </SectionTitle>
        <ul className={styles.list}>
          {roles.map((role) => (
            <ListRow key={role.id} title={role.title} meta={role.meta} divided>
              <PillBadge tone="success" dot>
                Published
              </PillBadge>
            </ListRow>
          ))}
        </ul>
      </Panel>

      <Panel padding={24} aria-labelledby="application-coverage">
        <SectionTitle id="application-coverage" title="Application coverage" description="Roles receiving candidate interest" />
        <ul className={styles.list}>
          {coverage.map((item) => (
            <ListRow key={item.id} title={item.title} meta={item.meta}>
              <PillBadge tone={item.tone}>{item.status}</PillBadge>
            </ListRow>
          ))}
        </ul>
      </Panel>

      <Panel padding={24} className={styles.note} aria-labelledby="oversight-note">
        <h2 className={styles.noteTitle} id="oversight-note">
          Oversight, not hiring control
        </h2>
        <p className={styles.noteText}>
          Admins review policy, safety, and marketplace integrity. Recruiters remain responsible for fair, human-reviewed hiring
          decisions.
        </p>
        <Link to={admin('moderation')} className={styles.noteLink}>
          Open moderation
          <Icon as={ArrowRight} size={12} />
        </Link>
      </Panel>
    </aside>
  )
}
