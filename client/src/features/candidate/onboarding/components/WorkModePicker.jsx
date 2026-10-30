import { useTranslation } from 'react-i18next'
import { Earth } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './WorkModePicker.module.css'

/**
 * Radio group drawn as three selectable tiles; `options` are workPreference keys (M-142), labelled from the
 * enums namespace. Native radios keep arrow-key and screen-reader behaviour.
 */
export default function WorkModePicker({ legend, name, options, value, onChange, error }) {
  const { t } = useTranslation()
  return (
    <fieldset className={styles.group} aria-invalid={Boolean(error) || undefined}>
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
              {t(`enums:workPreference.${option}`)}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
