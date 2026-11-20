import { useTranslation } from 'react-i18next'

/* 2026-11-20: the four contract rules, in display order, and a rule's value in words. */
export const RULES = ['exclusivity', 'noticeDays', 'coolingOffDays', 'maxWeeklyHours']
export const NUMBER_RULES = ['noticeDays', 'coolingOffDays', 'maxWeeklyHours']

/** A rule's value in words. */
export function useRuleText() {
  const { t } = useTranslation()
  return (name, value) => {
    if (value == null) return t('agency:rules.notStated')
    if (name === 'exclusivity') return t(`enums:exclusivity.${value}`)
    return t(name === 'maxWeeklyHours' ? 'agency:rules.hours' : 'agency:rules.days', { count: value })
  }
}
