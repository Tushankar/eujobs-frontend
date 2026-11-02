import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import { useGetSkillSuggestionsQuery } from '../api.js'
import styles from './SkillPicker.module.css'

const DEBOUNCE_MS = 250
const sameSkill = (a, b) => a.toLocaleLowerCase() === b.toLocaleLowerCase()

/**
 * Add skills by typing (Enter or Add) or from suggestions; chosen skills are removable chips. Skills are free text
 * (M-034): suggestions are the market's most-used skills from the server (P4-D5). A skill cannot be in both
 * lists (M-033), so `excluded` holds the other list.
 */
export default function SkillPicker({ label, hint, error, value, onChange, excluded = [], max }) {
  const { t } = useTranslation()
  const id = useId()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [problem, setProblem] = useState(null)
  const { data: suggestions = [] } = useGetSkillSuggestionsQuery(query)
  const shown = suggestions.filter((skill) => ![...value, ...excluded].some((chosen) => sameSkill(chosen, skill)))

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(draft.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [draft])

  function add(rawSkill) {
    const skill = rawSkill.trim()
    if (!skill) return
    if (value.some((existing) => sameSkill(existing, skill))) return setProblem(t('jobs:skills.duplicate', { skill }))
    if (excluded.some((existing) => sameSkill(existing, skill))) return setProblem(t('jobs:skills.inOther', { skill }))
    setProblem(null)
    onChange([...value, skill])
    setDraft('')
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add(draft)
  }

  const full = max != null && value.length >= max

  return (
    <Field id={id} label={label} hint={hint} error={error || problem || undefined}>
      {({ describedBy, invalid }) => (
        <>
          <div className={styles.inputRow}>
            <input
              id={id}
              className={styles.input}
              value={draft}
              maxLength={50}
              disabled={full}
              placeholder={t('jobs:skills.placeholder')}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onChange={(event) => {
                setDraft(event.target.value)
                setProblem(null)
              }}
              onKeyDown={onKeyDown}
            />
            <Button variant="secondary" disabled={full} onClick={() => add(draft)} leftIcon={<Icon as={Plus} size={13} />}>
              {t('jobs:skills.add')}
            </Button>
          </div>

          {value.length > 0 && (
            <ul className={styles.chips} aria-label={t('jobs:skills.added', { label })}>
              {value.map((skill) => (
                <li key={skill} className={styles.chip}>
                  {skill}
                  <button type="button" className={styles.remove} aria-label={t('jobs:skills.remove', { skill })} onClick={() => onChange(value.filter((item) => item !== skill))}>
                    <Icon as={X} size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {shown.length > 0 && !full && (
            <div className={styles.suggestions}>
              <p className={styles.suggestionsLabel}>{t('jobs:skills.suggestions')}</p>
              <ul className={styles.suggestionList}>
                {shown.map((skill) => (
                  <li key={skill}>
                    <button type="button" className={styles.suggestion} onClick={() => add(skill)}>
                      <Icon as={Plus} size={11} />
                      {skill}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Field>
  )
}
