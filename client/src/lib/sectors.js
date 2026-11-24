import { useMemo } from 'react'
import { useGetSectorsQuery } from '@/app/api.js'
import { usePreferences } from './preferences.js'

/*
 * Job sectors (2026-11-24): the kind of work. Jobs, companies and agency clients keep a sector key; the names come from
 * GET /meta/sectors in the reader's language. A company or client without a sector still shows the industry it typed.
 */
export function useSectors() {
  const { data: sectors = [], isLoading } = useGetSectorsQuery()
  const { language } = usePreferences()
  return useMemo(() => {
    const byKey = new Map(sectors.map((sector) => [sector.key, sector]))
    const name = (key) => {
      const sector = key && byKey.get(key)
      return sector ? (sector.name[language] ?? sector.name.en) : null
    }
    return {
      isLoading,
      name,
      /** Select options A–Z: the shown sectors, plus `current` when it was hidden since it was picked. */
      options: (current) =>
        sectors
          .filter((sector) => !sector.hidden || sector.key === current)
          .map((sector) => ({ value: sector.key, label: name(sector.key) }))
          .sort((a, b) => a.label.localeCompare(b.label, language)),
      /** A company's or client's industry line: its sector's name, else the industry it typed before sectors. */
      industry: (entity) => name(entity?.sector) ?? entity?.industry ?? null,
    }
  }, [sectors, language, isLoading])
}
