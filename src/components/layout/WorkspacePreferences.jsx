import { createContext, useContext, useMemo } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'

/** Locations offered in the Figma profile menu ("Local marketplace preference for this workspace."). */
export const LOCATIONS = ['San Francisco, US', 'London, UK', 'New York, US', 'Berlin, Germany', 'Remote / Global']

const WorkspacePreferencesContext = createContext(null)

/** Header and profile menu share the selected location; it is persisted on this device. */
export function WorkspacePreferencesProvider({ children }) {
  const [location, setLocation] = useLocalStorage('lwm.location', LOCATIONS[0])
  const value = useMemo(() => ({ location, setLocation, language: 'English' }), [location, setLocation])
  return <WorkspacePreferencesContext.Provider value={value}>{children}</WorkspacePreferencesContext.Provider>
}

export function useWorkspacePreferences() {
  const context = useContext(WorkspacePreferencesContext)
  if (!context) throw new Error('useWorkspacePreferences must be used inside WorkspacePreferencesProvider')
  return context
}
