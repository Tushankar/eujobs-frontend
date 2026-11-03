import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import styles from './LevelTabs.module.css'

/** Course level filter: "All levels" ('all') plus one button per level key. Controlled; the parent filters the grid. */
export default function LevelTabs({ levels, value, onChange }) {
  const { t } = useTranslation('learning')
  const options = [{ value: 'all', label: t('catalogue.allLevels') }, ...levels.map((level) => ({ value: level, label: t(`enums:courseLevel.${level}`) }))]
  return (
    <div className={styles.tray} role="group" aria-label={t('catalogue.levelLabel')}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button key={option.value} type="button" aria-pressed={active} className={cx(styles.tab, active && styles.active)} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
