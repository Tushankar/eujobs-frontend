import { useState } from 'react'

/**
 * Controlled-form state for the auth screens: field values, field errors, and `field(name)`,
 * an onChange handler factory that also clears that field's error as the user edits it.
 */
export function useFormState(initialValues) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})

  function field(name) {
    return (event) => {
      const { type, checked, value } = event.target
      setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
      setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current))
    }
  }

  return { values, setValues, errors, setErrors, field }
}
