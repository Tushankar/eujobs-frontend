import { createContext, useContext } from 'react'

/** Locations offered in the Figma profile menu ("Local marketplace preference for this workspace."). */
export const LOCATIONS = ['San Francisco, US', 'London, UK', 'New York, US', 'Berlin, Germany', 'Remote / Global']

/** Languages offered in the profile menu (Admin > Overview popup). Only English copy exists; the choice is just remembered. */
export const LANGUAGES = ['English', 'Español', 'Français']

export const WorkspacePreferencesContext = createContext(null)

export function useWorkspacePreferences() {
  const context = useContext(WorkspacePreferencesContext)
  if (!context) throw new Error('useWorkspacePreferences must be used inside WorkspacePreferencesProvider')
  return context
}
