import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, SearchX, Settings2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import GetStartedCard from '@/components/common/GetStartedCard.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, CompanyLogo, Dropdown, Icon, IconButton, Skeleton, SkeletonRegion, TextField } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useSectors } from '@/lib/sectors.js'
import { useDeleteClientMutation, useGetClientsQuery } from '../../api.js'
import ClientDialog from '../components/ClientDialog.jsx'
import styles from './ClientsPage.module.css'

function RowsSkeleton() {
  return (
    <SkeletonRegion className={styles.card}>
      {[0, 1, 2].map((key) => (
        <div key={key} className={styles.row}>
          <Skeleton shape="block" width={40} height={40} />
          <div className={styles.text}>
            <Skeleton width={160} height={14} />
            <Skeleton width={220} height={12} />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/** 2026-11-20: Agency › Clients, the companies the agency's jobs are for. */
export default function ClientsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { language } = usePreferences()
  const sectors = useSectors()
  const errorText = useErrorText()
  const { data, isLoading } = useGetClientsQuery()
  const [query, setQuery] = useState('')
  // null: closed; {}: a new client; a client: editing it.
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteFailure, setDeleteFailure] = useState(null)
  const [deleteClient] = useDeleteClientMutation()
  const clients = data?.items ?? []
  const needle = query.trim().toLocaleLowerCase(language)
  const visible = clients.filter((client) => !needle || [client.name, sectors.industry(client), client.location?.city, client.linkedCompany?.displayName].filter(Boolean).some((text) => text.toLocaleLowerCase(language).includes(needle)))
  const noClients = Boolean(data) && clients.length === 0

  const addButton = (
    <Button leftIcon={<Icon as={Plus} size={14} />} onClick={() => setEditing({})} data-add-client>
      {t('agency:clients.add')}
    </Button>
  )

  async function confirmDelete() {
    try {
      await deleteClient(deleting.id).unwrap()
      setDeleting(null)
    } catch (error) {
      setDeleteFailure(error)
    }
  }

  const meta = (client) =>
    [sectors.industry(client), client.location && t('common:city.value', { city: client.location.city, country: format.country(client.location.countryCode) })].filter(Boolean).join(' · ')

  return (
    <>
      <PageTitle title={t('agency:clients.title')} description={t('agency:clients.description')} actions={!noClients && addButton} />

      {noClients ? (
        <GetStartedCard
          id="clients-start-title"
          title={t('agency:clients.start.title')}
          text={t('agency:clients.start.text')}
          steps={t('agency:clients.start.steps', { returnObjects: true })}
          action={addButton}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <TextField
              variant="filter"
              className={styles.search}
              aria-label={t('agency:clients.search')}
              type="search"
              placeholder={t('agency:clients.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {isLoading ? (
            <RowsSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState icon={SearchX} title={t('agency:clients.emptyFiltered')} description={t('agency:clients.emptyFilteredText')} />
          ) : (
            <section className={styles.card} aria-label={t('agency:clients.title')}>
              <ul className={styles.list}>
                {visible.map((client) => (
                  <li key={client.id} className={styles.row} data-client={client.name}>
                    <CompanyLogo name={client.name} src={client.logoUrl ?? undefined} size={40} />
                    <button type="button" className={styles.text} onClick={() => setEditing(client)}>
                      <span className={styles.name}>{client.name}</span>
                      <span className={styles.meta}>{meta(client) || t('agency:clients.noDetails')}</span>
                      {client.linkedCompany && <span className={styles.linked}>{t('agency:clients.linkedTo', { company: client.linkedCompany.displayName })}</span>}
                    </button>
                    <PillBadge tone={client.jobs ? 'accent' : 'neutral'}>{t('agency:clients.jobs', { count: client.jobs })}</PillBadge>
                    <Dropdown panelClassName={styles.menuPanel} trigger={(props) => <IconButton icon={Settings2} label={t('agency:clients.manage', { name: client.name })} {...props} />}>
                      {({ close }) => (
                        <div className={styles.menu}>
                          <button
                            type="button"
                            className={styles.menuItem}
                            onClick={() => {
                              close()
                              setEditing(client)
                            }}
                          >
                            {t('agency:clients.edit')}
                          </button>
                          <button
                            type="button"
                            className={`${styles.menuItem} ${styles.menuDanger}`}
                            onClick={() => {
                              close()
                              setDeleteFailure(null)
                              setDeleting(client)
                            }}
                          >
                            {t('agency:clients.delete')}
                          </button>
                        </div>
                      )}
                    </Dropdown>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* 2026-11-23: the client is read from the live list, so a new logo shows in the open dialog at once. */}
      {editing && <ClientDialog open client={editing.id ? (clients.find((client) => client.id === editing.id) ?? editing) : null} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('agency:clients.deleteTitle', { name: deleting?.name })}
        description={t('agency:clients.deleteText')}
        confirmLabel={t('agency:clients.delete')}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        {deleteFailure && (
          <p className={styles.failure} role="alert">
            {errorText.code(deleteFailure)}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
