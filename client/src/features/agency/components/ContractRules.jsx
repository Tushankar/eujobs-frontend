import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, SelectField, TextareaField, TextField } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { NUMBER_RULES, RULES, useRuleText } from '../rules.js'
import styles from './ContractRules.module.css'

/*
 * 2026-11-20: the four rules of an agency contract (the agreement or a job's contract): what a candidate on an
 * assignment may do, the notice, the cooling-off and the weekly hours. Each has a value (null: not stated) and the
 * clause it comes from.
 */
const same = (a, b) => (a?.value ?? null) === (b?.value ?? null)

/** The rules as rows: label, value, the quoted clause, where it came from and whether the agency changed AI's reading. */
export function RulesList({ rules, sources, aiRules, className }) {
  const { t } = useTranslation()
  const ruleText = useRuleText()
  return (
    <dl className={`${styles.list} ${className ?? ''}`} data-rules>
      {RULES.map((name) => (
        <div key={name} className={styles.row} data-rule={name}>
          <dt className={styles.label}>{t(`agency:rules.labels.${name}`)}</dt>
          <dd className={styles.value}>
            <span className={styles.valueLine}>
              <span className={rules?.[name]?.value == null ? styles.muted : undefined}>{ruleText(name, rules?.[name]?.value)}</span>
              {sources?.[name] && <PillBadge tone="neutral">{t(`enums:ruleSource.${sources[name]}`)}</PillBadge>}
              {aiRules && !same(rules?.[name], aiRules[name]) && <PillBadge tone="info">{t('agency:rules.changedFromAi')}</PillBadge>}
            </span>
            {rules?.[name]?.clause && <blockquote className={styles.clause}>“{rules[name].clause}”</blockquote>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const toForm = (rules) => Object.fromEntries(RULES.map((name) => [name, { value: rules?.[name]?.value == null ? '' : String(rules[name].value), clause: rules?.[name]?.clause ?? '' }]))

/** Form values -> the PUT body ({ rule: { value, clause } }, null when empty). */
function toBody(values) {
  return Object.fromEntries(
    RULES.map((name) => {
      const raw = values[name].value.trim()
      const value = raw === '' ? null : name === 'exclusivity' ? raw : Number(raw)
      return [name, { value, clause: values[name].clause.trim() || null }]
    }),
  )
}

/**
 * The rules as a form: each value and the clause it comes from (quoted from the PDF; checked by the server when the
 * PDF has text). `errors` are the server's fields ("noticeDays.clause"). `actions` = [{ intent, label }] buttons (the
 * last is the primary one); `onSubmit(body, intent)` runs with the one pressed.
 */
export function RulesEditor({ rules, errors = {}, onSubmit, actions, busy }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const limits = config?.limits.contractRules
  const [values, setValues] = useState(() => toForm(rules))
  const [checks, setChecks] = useState({})
  const set = (name, part) => (event) => setValues((current) => ({ ...current, [name]: { ...current[name], [part]: event.target.value } }))
  const errorOf = (field) => errorText.field(field.split('.').at(-1), checks[field] ?? errors[field])

  function validate() {
    const found = {}
    for (const name of NUMBER_RULES) {
      const raw = values[name].value.trim()
      if (raw === '') continue
      const { min = 0, max } = limits[name]
      if (!/^\d+$/.test(raw)) found[`${name}.value`] = { key: 'invalid' }
      else if (Number(raw) < min) found[`${name}.value`] = { key: 'too_small', params: { min } }
      else if (Number(raw) > max) found[`${name}.value`] = { key: 'too_big', params: { max } }
    }
    for (const name of RULES) if (values[name].clause.trim().length > limits.clause.max) found[`${name}.clause`] = { key: 'too_long', params: { max: limits.clause.max } }
    setChecks(found)
    return Object.keys(found).length === 0
  }

  // Not a <form>: the editor also sits inside the job wizard's form (forms cannot nest).
  function submit(intent) {
    if (validate()) onSubmit(toBody(values), intent)
  }

  return (
    <div className={styles.editor} role="group" aria-label={t('agency:rules.title')} data-rules-editor>
      {RULES.map((name) => (
        <fieldset key={name} className={styles.fieldset}>
          <legend className={styles.legend}>{t(`agency:rules.labels.${name}`)}</legend>
          <p className={styles.help}>{t(`agency:rules.help.${name}`)}</p>
          <div className={styles.fields}>
            {name === 'exclusivity' ? (
              <SelectField
                label={t('agency:rules.value')}
                name={`${name}.value`}
                value={values[name].value}
                onChange={set(name, 'value')}
                options={[{ value: '', label: t('agency:rules.notStated') }, ...(config?.enums.exclusivity ?? []).map((key) => ({ value: key, label: t(`enums:exclusivity.${key}`) }))]}
              />
            ) : (
              <TextField
                label={t(name === 'maxWeeklyHours' ? 'agency:rules.valueHours' : 'agency:rules.valueDays')}
                name={`${name}.value`}
                inputMode="numeric"
                placeholder={t('agency:rules.notStated')}
                value={values[name].value}
                onChange={set(name, 'value')}
                error={errorOf(`${name}.value`)}
              />
            )}
            <TextareaField
              label={t('agency:rules.clause')}
              hint={t('agency:rules.clauseHint')}
              name={`${name}.clause`}
              rows={2}
              value={values[name].clause}
              onChange={set(name, 'clause')}
              error={errorOf(`${name}.clause`)}
            />
          </div>
        </fieldset>
      ))}
      <div className={styles.actions}>
        {actions.map((action, index) => (
          <Button
            key={action.intent}
            variant={index === actions.length - 1 ? 'primary' : 'outline'}
            loading={busy === action.intent}
            disabled={Boolean(busy)}
            onClick={() => submit(action.intent)}
            data-rules-action={action.intent}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
