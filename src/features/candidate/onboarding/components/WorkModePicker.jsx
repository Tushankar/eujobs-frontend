import { Earth } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './WorkModePicker.module.css'

/** Radio group drawn as three selectable tiles (Remote / Hybrid / On-site). Native radios keep arrow-key and screen-reader behaviour. */
export default function WorkModePicker({ legend, name, options, value, onChange }) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className={styles.tile}>
              <Icon as={Earth} size={20} />
              {option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
