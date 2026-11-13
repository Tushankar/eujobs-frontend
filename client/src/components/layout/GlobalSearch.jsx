import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Icon, Modal } from '@/components/ui'
import { can } from '@/app/permissions.js'
import { workspacePath } from '@/app/workspaces.js'
import PlanChip from '@/features/candidate/billing/components/PlanChip.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePreferences } from '@/lib/preferences.js'
import { foldText } from '@/lib/text.js'
import NavIcon from './NavIcon.jsx'
import styles from './GlobalSearch.module.css'

/** "Search anything" (Ctrl/⌘+K): a quick jump between this workspace's pages, by their translated labels (M-194). */
export default function GlobalSearch({ workspace, open, onClose }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const [query, setQuery] = useState('')

  const destinations = useMemo(
    () => [
      ...workspace.nav.filter((item) => can(me, item.permission)).map((item) => ({
        label: t(`shell:nav.${item.key}`),
        to: workspacePath(workspace, item.to),
        vuesax: item.vuesax,
        iconSrc: item.iconSrc,
        locked: Boolean(item.entitlement) && lacksEntitlement(me, item.entitlement, [workspace.id]),
      })),
      { label: t('shell:sidebar.settings'), to: workspacePath(workspace, 'settings'), vuesax: 'setting-2' },
      { label: t('shell:sidebar.help'), to: workspacePath(workspace, 'help'), vuesax: 'message-question' },
    ],
    [workspace, t, me],
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
                {item.vuesax ? (
                  <NavIcon name={item.vuesax} />
                ) : item.iconSrc ? (
                  <img src={item.iconSrc} alt="" className={styles.customIcon} />
                ) : (
                  <span className={styles.iconSpacer} />
                )}
                {item.label}
                {item.locked && <PlanChip className={styles.chip} />}
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
