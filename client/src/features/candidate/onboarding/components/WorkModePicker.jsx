import { useTranslation } from 'react-i18next'
import { Building2, Check, House, Repeat } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './WorkModePicker.module.css'

const ICONS = { remote: House, hybrid: Repeat, on_site: Building2 }

/**
 * Radio group drawn as three selectable cards (icon, name, one line on what it means, a radio mark); `options` are
 * workPreference keys (M-142). Native radios keep arrow-key and screen-reader behaviour.
 */
export default function WorkModePicker({ legend, name, options, value, onChange, error }) {
  const { t } = useTranslation()
  return (
    <fieldset className={styles.group} aria-invalid={Boolean(error) || undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option} className={styles.option}>
            <input type="radio" className="sr-only" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            <span className={styles.tile}>
              <span className={styles.head}>
                <Icon as={ICONS[option]} size={20} className={styles.icon} />
                <span className={styles.radio} aria-hidden="true">
                  <Icon as={Check} size={11} strokeWidth={3.5} />
                </span>
              </span>
              <span className={styles.name}>{t(`enums:workPreference.${option}`)}</span>
              <span className={styles.text}>{t(`onboarding:preferences.modes.${option}`)}</span>
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
