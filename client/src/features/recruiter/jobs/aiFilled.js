import { createContext, useContext } from 'react'

/*
 * 2026-11-23 (owner: "show in which fields, with stars, what AI analysed"): the job form fields the AI draft filled and
 * the recruiter has not changed since. The wizard provides them; a field adds the global `ai-filled` class, which puts
 * a small "✦ AI" pill after its label (styles/utilities.css). Editing a field takes it off the set.
 */
export const AiFieldsContext = createContext(new Set())

/** `aiFilled('brief')` → 'ai-filled' while the AI's value is untouched, else undefined (for a className). */
export function useAiFilled() {
  const fields = useContext(AiFieldsContext)
  return (...names) => (names.some((name) => fields.has(name)) ? 'ai-filled' : undefined)
}
