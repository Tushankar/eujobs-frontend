import { useEffect, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { useGetLandingQuery } from '../../api.js'
import styles from './Landing.module.css'

const REDUCE = '(prefers-reduced-motion: reduce)'
const unique = (list) => [...new Set(list.filter(Boolean))]

/**
 * Types each example, holds it, erases it and moves on (owner 2026-11-16); still while `paused`. With reduce motion the
 * examples swap whole. `examples` is a newline-joined list so the effect restarts only when the list really changes.
 */
function useTypedText(examples, paused, delay) {
  const [text, setText] = useState('')
  useEffect(() => {
    const list = examples ? examples.split('\n') : []
    if (!list.length || paused) return undefined
    const reduce = window.matchMedia(REDUCE).matches
    let index = 0
    let length = 0
    let erasing = false
    let timer
    const tick = () => {
      const word = list[index % list.length]
      if (reduce) {
        setText(word)
        index += 1
        timer = setTimeout(tick, 3200)
      } else if (!erasing) {
        length += 1
        setText(word.slice(0, length))
        erasing = length === word.length
        timer = setTimeout(tick, erasing ? 1800 : 65)
      } else {
        length -= 1
        setText(word.slice(0, length))
        if (length === 0) {
          erasing = false
          index += 1
        }
        timer = setTimeout(tick, length === 0 ? 400 : 28)
      }
    }
    timer = setTimeout(tick, delay)
    return () => clearTimeout(timer)
  }, [examples, paused, delay])
  return paused ? '' : text
}

/** One search field whose placeholder types live examples until it is focused or filled. */
function Field({ icon, label, value, onChange, examples, delay }) {
  const { t } = useTranslation()
  const [focused, setFocused] = useState(false)
  const typed = useTypedText(examples, focused || Boolean(value), delay)
  return (
    <label className={styles.searchField}>
      <Icon as={icon} size={16} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={typed ? t('landing:hero.try', { example: typed }) : label}
        aria-label={label}
      />
    </label>
  )
}

/**
 * The landing search pill (Figma 396:549), shared by the hero and /jobs: keywords and place. The placeholders cycle
 * through the newest live jobs' titles and places (GET /landing), never fixed examples.
 */
export default function JobSearchForm({ q = '', location = '', onSearch, className = '', ...attributes }) {
  const { t, i18n } = useTranslation()
  const { data } = useGetLandingQuery(i18n.language)
  const [what, setWhat] = useState(q)
  const [where, setWhere] = useState(location)
  const jobs = data?.jobs ?? []
  const titles = unique(jobs.map((job) => job.title)).join('\n')
  const places = unique(jobs.map((job) => (job.location ? job.location.city : t('common:remote')))).join('\n')

  function submit(event) {
    event.preventDefault()
    onSearch({ q: what.trim(), location: where.trim() })
  }
  return (
    <form className={`${styles.search} ${className}`} role="search" aria-label={t('landing:hero.searchLabel')} onSubmit={submit} {...attributes}>
      <Field icon={Search} label={t('landing:hero.what')} value={what} onChange={setWhat} examples={titles} delay={700} />
      <Field icon={MapPin} label={t('landing:hero.where')} value={where} onChange={setWhere} examples={places} delay={1900} />
      <button type="submit" className={styles.searchButton}>
        <Icon as={Search} size={16} />
        <span className={styles.searchLabel}>{t('landing:hero.search')}</span>
      </button>
    </form>
  )
}
