import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button, Icon, Panel, TextField } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import FaqItem from '../components/FaqItem.jsx'
import HelpLinkCard from '../components/HelpLinkCard.jsx'
import { FAQS, HELP_LINKS } from '../data/help.js'
import styles from './HelpPage.module.css'

/** Shared Help page (candidate, recruiter and admin): searchable FAQ plus two resource shortcuts. */
export default function HelpPage() {
  const { workspace } = useOutletContext()
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState([FAQS[0].id])

  const needle = query.trim().toLowerCase()
  const faqs = FAQS.filter((faq) => !needle || `${faq.question} ${faq.answer}`.toLowerCase().includes(needle))
  const links = HELP_LINKS.filter((link) => !needle || link.label.toLowerCase().includes(needle))
  const hasResults = faqs.length + links.length > 0

  function toggle(id) {
    setOpenIds((current) => (current.includes(id) ? current.filter((openId) => openId !== id) : [...current, id]))
  }

  return (
    <>
      <header>
        <h1 className={styles.title}>A little clarity goes a long way.</h1>
        <p className={styles.lead}>Practical answers, clear guidance, and room to take your next step with confidence.</p>
      </header>

      <div className={styles.search}>
        <TextField
          type="search"
          aria-label="Search help resources"
          placeholder="Search help resources"
          leftIcon={<Icon as={Search} size={16} strokeWidth={2} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <p className="sr-only" role="status">
        {needle ? `${faqs.length} help topics found` : ''}
      </p>

      {faqs.length > 0 && (
        <Panel padding="0 24px" className={styles.faqs}>
          {faqs.map((faq) => (
            <FaqItem
              key={faq.id}
              question={faq.question}
              answer={faq.answer}
              open={openIds.includes(faq.id)}
              onToggle={() => toggle(faq.id)}
            />
          ))}
        </Panel>
      )}

      {links.length > 0 && (
        <div className={styles.links}>
          {links.map((link) => (
            <HelpLinkCard
              key={link.id}
              icon={link.icon}
              label={link.label}
              to={workspacePath(workspace, link.to[workspace.id])}
            />
          ))}
        </div>
      )}

      {!hasResults && (
        <Panel padding="48px 24px" className={styles.empty}>
          <p className={styles.emptyTitle}>No help topics match “{query.trim()}”</p>
          <p className={styles.emptyText}>Try a different keyword, or clear the search to see every topic.</p>
          <Button variant="outline" onClick={() => setQuery('')}>
            Clear search
          </Button>
        </Panel>
      )}
    </>
  )
}
