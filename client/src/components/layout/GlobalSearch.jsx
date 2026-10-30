import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CircleHelp, Search, Settings2 } from 'lucide-react'
import { Icon, Modal } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import { foldText } from '@/lib/text.js'
import styles from './GlobalSearch.module.css'

/** "Search anything" (Ctrl/⌘+K): a quick jump between this workspace's pages, by their translated labels (M-194). */
export default function GlobalSearch({ workspace, open, onClose }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const destinations = useMemo(
    () => [
      ...workspace.nav.map((item) => ({ label: t(`shell:nav.${item.key}`), to: workspacePath(workspace, item.to), icon: item.icon })),
      { label: t('shell:sidebar.settings'), to: workspacePath(workspace, 'settings'), icon: Settings2 },
      { label: t('shell:sidebar.help'), to: workspacePath(workspace, 'help'), icon: CircleHelp },
    ],
    [workspace, t],
  )
  const results = destinations.filter((item) => foldText(item.label).includes(foldText(query.trim())))

  function close() {
    setQuery('')
    onClose()
  }

  function go(destination) {
    close()
    navigate(destination.to)
  }

  return (
    <Modal open={open} onClose={close} title={t('shell:search.title')} description={t('shell:search.description')} width={520} className={styles.palette}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (results[0]) go(results[0])
        }}
      >
        <label className="sr-only" htmlFor="global-search-input">
          {t('shell:search.inputLabel')}
        </label>
        <div className={styles.inputWrap}>
          <Icon as={Search} size={16} />
          <input
            id="global-search-input"
            data-autofocus
            className={styles.input}
            placeholder={t('shell:search.trigger')}
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
        <p className={styles.empty}>{t('shell:search.empty', { query })}</p>
      )}
    </Modal>
  )
}
