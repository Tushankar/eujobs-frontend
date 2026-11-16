import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Globe, MapPin, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CompanyLogo, Icon } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { cx } from '@/utils/cx.js'
import { useGetLandingQuery, useGetPublicJobsQuery } from '../../api.js'
import styles from './Landing.module.css'
import own from './JobSearchForm.module.css'

const REDUCE = '(prefers-reduced-motion: reduce)'
const MAX_JOBS = 5
const MAX_PLACES = 6
const unique = (list) => [...new Set(list.filter(Boolean))]
/** Case- and accent-free text for matching ("Málaga" ~ "malaga"); keeps the length of precomposed text. */
const fold = (text) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/** The typed words in brand blue inside a suggestion. */
function Marked({ text, term }) {
  const at = term ? fold(text).indexOf(fold(term)) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className={own.mark}>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  )
}

/** Follows an element's box on screen while `open`, so the list can live in a portal (the hero card clips). */
function useAnchorRect(anchor, open) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!open || !anchor.current) return undefined
    const measure = () => setRect(anchor.current.getBoundingClientRect())
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [anchor, open])
  return open ? rect : null
}

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

/** One search field whose placeholder types live examples until it is focused or filled; a combobox for its list. */
function Field({ icon, label, value, examples, delay, focused, fieldRef, ...input }) {
  const { t } = useTranslation()
  const typed = useTypedText(examples, focused || Boolean(value), delay)
  return (
    <label ref={fieldRef} className={styles.searchField}>
      <Icon as={icon} size={16} />
      <input value={value} placeholder={typed ? t('landing:hero.try', { example: typed }) : label} aria-label={label} role="combobox" aria-autocomplete="list" autoComplete="off" {...input} />
    </label>
  )
}

/**
 * The landing search pill (Figma 396:549), shared by the hero and /jobs: keywords and place. The placeholders cycle
 * through the newest live jobs' titles and places (GET /landing), never fixed examples.
 */
export default function JobSearchForm({ q = '', location = '', onSearch, className = '', ...attributes }) {
  const { t, i18n } = useTranslation()
  const text = useJobText()
  const navigate = useNavigate()
  const { data } = useGetLandingQuery(i18n.language)
  const [what, setWhat] = useState(q)
  const [where, setWhere] = useState(location)
  const [focus, setFocus] = useState(null)
  const [closed, setClosed] = useState(false)
  const [active, setActive] = useState(-1)
  const form = useRef(null)
  const placeField = useRef(null)
  const listId = useId()
  const jobs = data?.jobs ?? []
  // A title's trailing "(React, MongoDB, AWS)" would overflow the field; the role name alone reads as an example.
  const titles = unique(jobs.map((job) => job.title.replace(/\s*\(.*\)\s*$/, ''))).join('\n')
  const places = unique(jobs.map((job) => (job.location ? job.location.city : t('common:remote')))).join('\n')

  // While typing keywords: the live matching jobs (owner 2026-11-16). In the place field: the places that have jobs.
  const term = useDebounced(what.trim(), 180)
  const place = useDebounced(where.trim(), 180)
  const jobsOpen = focus === 'what' && !closed && term.length >= 2
  const placesOpen = focus === 'where' && !closed
  const matches = useGetPublicJobsQuery({ language: i18n.language, q: term, location: place }, { skip: !jobsOpen })
  // The same arguments as /jobs on its "All jobs" tab, so that page and this list share one request.
  const { data: everything } = useGetPublicJobsQuery({ language: i18n.language, q: '', location: '' }, { skip: !placesOpen })
  const found = matches.data?.items.slice(0, MAX_JOBS) ?? []
  const placeOptions = placesOpen && everything ? placesOf(everything.items) : []

  function placesOf(items) {
    const byLabel = new Map()
    items.forEach((job) => {
      const remote = job.country === 'REMOTE'
      const label = remote ? t('common:remote') : text.place(job)
      if (!label) return
      const entry = byLabel.get(label) ?? { label, value: remote ? label : job.location.city, remote, count: 0 }
      entry.count += 1
      byLabel.set(label, entry)
    })
    return [...byLabel.values()]
      .filter((entry) => fold(entry.label).includes(fold(where.trim())))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PLACES)
  }

  function search() {
    setClosed(true)
    onSearch({ q: what.trim(), location: where.trim() })
  }
  function submit(event) {
    event.preventDefault()
    search()
  }
  function openJob(job) {
    setClosed(true)
    const params = Object.entries({ q: what.trim(), location: where.trim(), job: job.id }).filter(([, value]) => value)
    navigate(`/jobs?${new URLSearchParams(params)}`)
  }
  function pickPlace(entry) {
    setWhere(entry.value)
    setClosed(true)
    setActive(-1)
  }
  const picks = jobsOpen ? [...found.map((job) => () => openJob(job)), ...(found.length ? [search] : [])] : placeOptions.map((entry) => () => pickPlace(entry))

  function onKeyDown(event) {
    if (event.key === 'Escape') return setClosed(true)
    if (!picks.length) return undefined
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (index + step + picks.length + (index < 0 && step < 0 ? 1 : 0)) % picks.length)
    } else if (event.key === 'Enter' && active >= 0 && active < picks.length) {
      event.preventDefault()
      picks[active]()
    }
    return undefined
  }
  const fieldProps = (name, setValue) => ({
    focused: focus === name,
    onChange: (event) => {
      setValue(event.target.value)
      setClosed(false)
      setActive(-1)
    },
    onFocus: () => {
      setFocus(name)
      setClosed(false)
      setActive(-1)
    },
    onBlur: () => setFocus(null),
    onKeyDown,
    'aria-expanded': focus === name && (jobsOpen || placeOptions.length > 0),
    'aria-controls': listId,
    'aria-activedescendant': focus === name && active >= 0 ? `${listId}-${active}` : undefined,
  })

  const open = jobsOpen || placeOptions.length > 0
  const rect = useAnchorRect(jobsOpen ? form : placeField, open)
  const width = rect && (jobsOpen ? rect.width : Math.max(rect.width, 300))
  const option = (index, onPick) => ({
    id: `${listId}-${index}`,
    role: 'option',
    'aria-selected': index === active,
    className: cx(own.option, index === active && own.active),
    onClick: onPick,
    onMouseEnter: () => setActive(index),
  })

  return (
    <form ref={form} className={`${styles.search} ${own.form} ${className}`} role="search" aria-label={t('landing:hero.searchLabel')} onSubmit={submit} {...attributes}>
      <Field icon={Search} label={t('landing:hero.what')} value={what} examples={titles} delay={700} {...fieldProps('what', setWhat)} />
      <Field icon={MapPin} label={t('landing:hero.where')} value={where} examples={places} delay={1900} fieldRef={placeField} {...fieldProps('where', setWhere)} />
      <button type="submit" className={styles.searchButton}>
        <Icon as={Search} size={16} />
        <span className={styles.searchLabel}>{t('landing:hero.search')}</span>
      </button>
      {rect &&
        createPortal(
          <div
            id={listId}
            role="listbox"
            aria-label={jobsOpen ? t('landing:hero.what') : t('landing:hero.where')}
            className={cx(own.panel, jobsOpen && matches.isFetching && own.busy)}
            style={{ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width }}
            // Keeps the focus in the field while a suggestion is clicked.
            onMouseDown={(event) => event.preventDefault()}
          >
            {jobsOpen && !matches.data && <p className={own.status}>{t('landing:hero.searching')}</p>}
            {jobsOpen && matches.data && !found.length && <p className={own.status}>{t('landing:hero.noMatch', { q: term })}</p>}
            {jobsOpen &&
              found.map((job, index) => (
                <div key={job.id} {...option(index, () => openJob(job))}>
                  <CompanyLogo name={job.company.displayName} id={job.company.id} src={job.company.logoUrl ?? undefined} size={32} />
                  <span className={own.text}>
                    <span className={own.title}>
                      <Marked text={job.title} term={term} />
                    </span>
                    <span className={own.meta}>{[job.company.displayName, text.place(job)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Icon as={ArrowRight} size={14} className={own.go} />
                </div>
              ))}
            {jobsOpen && found.length > 0 && (
              <>
                <div className={own.divider} role="presentation" />
                <div {...option(found.length, search)}>
                  <span className={own.placeIcon}>
                    <Icon as={Search} size={15} />
                  </span>
                  <span className={cx(own.text, own.all)}>{t('landing:hero.seeAll', { count: matches.data.total, q: term })}</span>
                  <Icon as={ArrowRight} size={14} className={own.go} />
                </div>
              </>
            )}
            {!jobsOpen &&
              placeOptions.map((entry, index) => (
                <div key={entry.label} {...option(index, () => pickPlace(entry))}>
                  <span className={own.placeIcon}>
                    <Icon as={entry.remote ? Globe : MapPin} size={15} />
                  </span>
                  <span className={own.text}>
                    <span className={own.title}>
                      <Marked text={entry.label} term={where.trim()} />
                    </span>
                  </span>
                  <span className={own.count}>{t('landing:hero.placeJobs', { count: entry.count })}</span>
                </div>
              ))}
          </div>,
          document.body,
        )}
    </form>
  )
}
