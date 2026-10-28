import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleHelp, Search, Settings2 } from 'lucide-react'
import { Icon, Modal } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import styles from './GlobalSearch.module.css'

/**
 * "Search anything…" (⌘/Ctrl+K). The design shows only the trigger, so the smallest
 * sensible behaviour is a quick-jump list over this workspace's pages.
 */
export default function GlobalSearch({ workspace, open, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const destinations = useMemo(
    () => [
      ...workspace.nav.map((item) => ({ label: item.label, to: workspacePath(workspace, item.to), icon: item.icon })),
      { label: 'Settings', to: workspacePath(workspace, 'settings'), icon: Settings2 },
      { label: 'Help & resources', to: workspacePath(workspace, 'help'), icon: CircleHelp },
    ],
    [workspace],
  )
  const results = destinations.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))

  function close() {
    setQuery('')
    onClose()
  }

  function go(destination) {
    close()
    navigate(destination.to)
  }

  return (
    <Modal open={open} onClose={close} title="Search anything" description="Jump to a page in this workspace." width={520}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (results[0]) go(results[0])
        }}
      >
        <label className="sr-only" htmlFor="global-search-input">
          Search pages
        </label>
        <div className={styles.inputWrap}>
          <Icon as={Search} size={16} />
          <input
            id="global-search-input"
            data-autofocus
            className={styles.input}
            placeholder="Search anything..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
      </form>
      {results.length > 0 ? (
        <ul className={styles.results}>
          {results.map((item) => (
            <li key={item.to}>
              <button type="button" className={styles.result} onClick={() => go(item)}>
                {item.icon ? <Icon as={item.icon} size={16} /> : <span className={styles.iconSpacer} />}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No pages match “{query}”.</p>
      )}
    </Modal>
  )
}
