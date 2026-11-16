import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/ui'
import { useTheme } from '@/lib/theme.js'

/** The sun/moon button of the app header and the public nav (owner 2026-11-16). */
export default function ThemeToggle({ className }) {
  const { t } = useTranslation()
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return <IconButton icon={dark ? Sun : Moon} label={t(dark ? 'common:theme.toLight' : 'common:theme.toDark')} className={className} onClick={toggle} />
}
