import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import { SKILL_SUGGESTIONS } from '../data/jobFields.js'
import styles from './SkillPicker.module.css'

/** Add skills by typing (Enter or Add) or from suggestions; chosen skills are removable chips. */
export default function SkillPicker({ label, hint, error, value, onChange, excluded = [] }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const suggestions = SKILL_SUGGESTIONS.filter((skill) => !value.includes(skill) && !excluded.includes(skill))

  function add(rawSkill) {
    const skill = rawSkill.trim()
    if (!skill) return
    if (value.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
      setDuplicate(true)
      return
    }
    setDuplicate(false)
    onChange([...value, skill])
    setDraft('')
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add(draft)
  }

  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error || (duplicate ? `${draft.trim()} is already in the list.` : undefined)}
    >
      {({ describedBy, invalid }) => (
        <>
          <div className={styles.inputRow}>
            <input
              id={id}
              className={styles.input}
              value={draft}
              placeholder="Type a skill and press Enter"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onChange={(event) => {
                setDraft(event.target.value)
                setDuplicate(false)
              }}
              onKeyDown={onKeyDown}
            />
            <Button variant="secondary" onClick={() => add(draft)} leftIcon={<Icon as={Plus} size={13} />}>
              Add
            </Button>
          </div>

          {value.length > 0 && (
            <ul className={styles.chips} aria-label={`${label} added`}>
              {value.map((skill) => (
                <li key={skill} className={styles.chip}>
                  {skill}
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${skill}`}
                    onClick={() => onChange(value.filter((item) => item !== skill))}
                  >
                    <Icon as={X} size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {suggestions.length > 0 && (
            <div className={styles.suggestions}>
              <p className={styles.suggestionsLabel}>Suggestions</p>
              <ul className={styles.suggestionList}>
                {suggestions.map((skill) => (
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
