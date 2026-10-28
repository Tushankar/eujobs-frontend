import { Panel, SelectField } from '@/components/ui'
import { ROLES } from '../data/insights.js'
import { roleMeta, roleOptionLabel } from '../utils/matching.js'
import RoleLogo from './RoleLogo.jsx'
import styles from './RolePicker.module.css'

const OPTIONS = ROLES.map((role) => ({ value: role.id, label: roleOptionLabel(role) }))

/** Role summary on the left, "Compare with a role" select on the right. */
export default function RolePicker({ role, onChange }) {
  return (
    <Panel className={styles.picker} padding={20}>
      <div className={styles.summary}>
        <RoleLogo role={role} size={44} picker />
        <div>
          <p className={styles.title}>{role.title}</p>
          <p className={styles.meta}>{roleMeta(role)}</p>
        </div>
      </div>
      <SelectField
        className={styles.field}
        label="Compare with a role"
        value={role.id}
        options={OPTIONS}
        onChange={(event) => onChange(event.target.value)}
      />
    </Panel>
  )
}
