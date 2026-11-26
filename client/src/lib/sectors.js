import { useMemo } from 'react'
import {
  Briefcase,
  Building2,
  ChartLine,
  Code,
  Cog,
  ConciergeBell,
  FlaskConical,
  GraduationCap,
  HandHeart,
  HardHat,
  Landmark,
  Megaphone,
  Palette,
  Scale,
  ShoppingBag,
  Stethoscope,
  Truck,
  Users,
  Wheat,
} from 'lucide-react'
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

/** A grey line icon per starter sector (owner 2026-11-26); sectors an admin adds later get the briefcase. */
const SECTOR_ICONS = {
  agriculture_food: Wheat,
  arts_culture: Palette,
  charity_nonprofit: HandHeart,
  construction_trades: HardHat,
  education: GraduationCap,
  engineering: Cog,
  finance_economics: ChartLine,
  healthcare: Stethoscope,
  hospitality_tourism: ConciergeBell,
  hr_recruitment: Users,
  it_software: Code,
  legal: Scale,
  logistics_transport: Truck,
  marketing_media: Megaphone,
  public_sector: Landmark,
  real_estate: Building2,
  retail_ecommerce: ShoppingBag,
  science_research: FlaskConical,
}

export const sectorIcon = (key) => SECTOR_ICONS[key] ?? Briefcase
