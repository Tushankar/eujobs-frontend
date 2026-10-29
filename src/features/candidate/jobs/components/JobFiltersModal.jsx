import { Button, Checkbox, Modal } from '@/components/ui'
import { EMPTY_FILTERS } from '../data/jobUtils.js'
import styles from './JobFiltersModal.module.css'

const GROUPS = [
  { key: 'workModes', label: 'Work model', options: ['Remote', 'Hybrid', 'On-site'] },
  { key: 'levels', label: 'Experience level', options: ['Junior', 'Mid-level', 'Senior', 'Lead'] },
  { key: 'matches', label: 'Match strength', options: ['Strong match', 'Good match'] },
]

/** Filters dialog for Find jobs. Filters apply live; the footer shows how many jobs currently match. */
export default function JobFiltersModal({ open, onClose, filters, onChange, resultCount }) {
  function toggle(key, option) {
    const current = filters[key]
    onChange({ ...filters, [key]: current.includes(option) ? current.filter((item) => item !== option) : [...current, option] })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      description="Narrow the opportunities by how and where you want to work."
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </Button>
          <Button onClick={onClose}>{`Show ${resultCount} ${resultCount === 1 ? 'job' : 'jobs'}`}</Button>
        </>
      }
    >
      <div className={styles.groups}>
        {GROUPS.map((group) => (
          <fieldset key={group.key} className={styles.group}>
            <legend className={styles.legend}>{group.label}</legend>
            <div className={styles.options}>
              {group.options.map((option) => (
                <Checkbox key={option} checked={filters[group.key].includes(option)} onChange={() => toggle(group.key, option)}>
                  {option}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  )
}
