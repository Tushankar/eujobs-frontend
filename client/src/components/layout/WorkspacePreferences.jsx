import { useMemo } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { LANGUAGES, LOCATIONS, WorkspacePreferencesContext } from './preferencesContext.js'

/** Header and profile menu share the selected location and language; both are persisted on this device. */
export function WorkspacePreferencesProvider({ children }) {
  const [location, setLocation] = useLocalStorage('lwm.location', LOCATIONS[0])
  const [language, setLanguage] = useLocalStorage('lwm.language', LANGUAGES[0])
  const value = useMemo(
    () => ({ location, setLocation, language, setLanguage }),
    [location, setLocation, language, setLanguage],
  )
  return <WorkspacePreferencesContext.Provider value={value}>{children}</WorkspacePreferencesContext.Provider>
}
