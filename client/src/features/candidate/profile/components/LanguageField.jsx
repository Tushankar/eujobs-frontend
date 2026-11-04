import { useId, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Icon } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import fieldStyles from '@/components/ui/Field.module.css'
import { cx } from '@/utils/cx.js'
import styles from './LanguageField.module.css'

/**
 * A searchable language picker (M-020): type to filter the named languages, pick with the mouse or the arrows +
 * Enter. `options` = [{ value, label }]; `value` is the picked code. The list opens in the flow of the form, so a
 * dialog grows (and scrolls) instead of the list spilling off the screen.
 */
export default function LanguageField({ label, name, placeholder, noResults, options, value, error, onChange }) {
  const id = useId()
  const selected = options.find((option) => option.value === value)
  const [text, setText] = useState(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const query = (text ?? '').trim().toLowerCase()
  const matches = query
    ? [...options.filter((option) => option.label.toLowerCase().startsWith(query)), ...options.filter((option) => !option.label.toLowerCase().startsWith(query) && option.label.toLowerCase().includes(query))]
    : options

  function pick(option) {
    onChange(option.value)
    setText(null)
    setOpen(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (matches.length) setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault()
      pick(matches[active])
    } else if (event.key === 'Escape' && open) {
      // Close the list only; the dialog's own Escape handler runs on document, so stop it here.
      event.nativeEvent.stopImmediatePropagation()
      setOpen(false)
      setText(null)
    }
  }

  const optionId = (index) => `${id}-option-${index}`
  return (
    <Field id={id} label={label} error={error}>
      {({ describedBy, invalid }) => (
        <div>
          <div className={cx(fieldStyles.control, invalid && fieldStyles.invalid)}>
            <span className={fieldStyles.leading}>
              <Icon as={Search} size={16} />
            </span>
            <input
              id={id}
              name={name}
              className={fieldStyles.input}
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-activedescendant={open && matches[active] ? optionId(active) : undefined}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              placeholder={placeholder}
              value={text ?? selected?.label ?? ''}
              onChange={(event) => {
                setText(event.target.value)
                setActive(0)
                setOpen(true)
              }}
              onKeyDown={handleKeyDown}
              onFocus={(event) => {
                event.target.select()
                setOpen(true)
              }}
              onBlur={() => {
                setOpen(false)
                setText(null)
              }}
            />
          </div>
          {open && (
            <ul id={`${id}-list`} role="listbox" className={styles.list}>
              {matches.length === 0 && (
                <li role="presentation" className={styles.empty}>
                  {noResults(text.trim())}
                </li>
              )}
              {matches.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.value === value}
                  data-value={option.value}
                  className={cx(styles.option, index === active && styles.active)}
                  // Keep the focus in the input so the click lands before blur closes the list.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(option)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Icon as={Check} size={14} className={styles.check} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  )
}
