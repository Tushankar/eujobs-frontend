/** Validation for the Create custom role form. Returns { field: message } (empty when valid). */
export function validateRole({ name, description }, existingNames) {
  const errors = {}
  const trimmed = name.trim()
  if (!trimmed) errors.name = 'Enter a role name.'
  else if (trimmed.length < 2) errors.name = 'Role name needs at least 2 characters.'
  else if (existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
    errors.name = `A role named "${trimmed}" already exists. Choose a different name.`
  }
  if (description.length > 240) errors.description = 'Keep the description under 240 characters.'
  return errors
}
