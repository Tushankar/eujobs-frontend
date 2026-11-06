import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useOutletContext } from 'react-router-dom'
import { Compass, Search } from 'lucide-react'
import { startTour } from '@/app/tour.js'
import { Button, Icon, Panel, SkeletonRegion, TextField } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import { foldText } from '@/lib/text.js'
import { useGetFaqsQuery } from '../api.js'
import FaqItem, { FaqItemSkeleton } from '../components/FaqItem.jsx'
import HelpLinkCard from '../components/HelpLinkCard.jsx'
import { HELP_LINKS } from '../data/help.js'
import styles from './HelpPage.module.css'

/** Shared Help page: the FAQs for this role in the UI language (M-200), searchable without accents, plus two shortcuts. */
export default function HelpPage() {
  const { t, i18n } = useTranslation()
  const { workspace } = useOutletContext()
  const dispatch = useDispatch()
  const { data: allFaqs = [], isError, isLoading } = useGetFaqsQuery(i18n.language)
  const [query, setQuery] = useState('')
  // null = the default: the first question open.
  const [openIds, setOpenIds] = useState(null)

  const needle = foldText(query.trim())
  const faqs = allFaqs.filter((faq) => !needle || foldText(`${faq.question} ${faq.answer}`).includes(needle))
  const links = HELP_LINKS.filter((link) => !needle || foldText(t(`help:links.${link.id}`)).includes(needle))
  // Candidates and recruiters can replay the product tour from here.
  const showTour = workspace.id !== 'admin' && (!needle || foldText(t('tour:replay')).includes(needle))
  const hasResults = faqs.length + links.length > 0 || showTour
  const open = openIds ?? (allFaqs[0] ? [allFaqs[0].id] : [])

  function toggle(id) {
    setOpenIds(open.includes(id) ? open.filter((openId) => openId !== id) : [...open, id])
  }

  return (
    <>
      <header>
        <h1 className={styles.title}>{t('help:title')}</h1>
        <p className={styles.lead}>{t('help:lead')}</p>
      </header>

      <div className={styles.search}>
        <TextField
          type="search"
          aria-label={t('help:search')}
          placeholder={t('help:search')}
          leftIcon={<Icon as={Search} size={16} strokeWidth={2} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <p className="sr-only" role="status">
        {needle ? t('help:found', { count: faqs.length }) : ''}
      </p>

      {isError && <p role="alert">{t('help:unavailable')}</p>}

      {isLoading && (
        <SkeletonRegion>
          <Panel padding="0 24px" className={styles.faqs}>
            {[0, 1, 2, 3, 4].map((row) => (
              <FaqItemSkeleton key={row} open={row === 0} />
            ))}
          </Panel>
        </SkeletonRegion>
      )}

      {faqs.length > 0 && (
        <Panel padding="0 24px" className={styles.faqs}>
          {faqs.map((faq) => (
            <FaqItem key={faq.id} question={faq.question} answer={faq.answer} open={open.includes(faq.id)} onToggle={() => toggle(faq.id)} />
          ))}
        </Panel>
      )}

      {(links.length > 0 || showTour) && (
        <div className={styles.links}>
          {links.map((link) => (
            <HelpLinkCard key={link.id} icon={link.icon} label={t(`help:links.${link.id}`)} to={workspacePath(workspace, link.to[workspace.id])} />
          ))}
          {showTour && <HelpLinkCard icon={Compass} label={t('tour:replay')} onClick={() => dispatch(startTour())} />}
        </div>
      )}

      {!hasResults && !isLoading && (
        <Panel padding="48px 24px" className={styles.empty}>
          <p className={styles.emptyTitle}>{t('help:empty.title', { query: query.trim() })}</p>
          <p className={styles.emptyText}>{t('help:empty.text')}</p>
          <Button variant="outline" onClick={() => setQuery('')}>
            {t('help:empty.clear')}
          </Button>
        </Panel>
      )}
    </>
  )
}
