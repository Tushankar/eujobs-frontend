import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOpenNotificationMutation } from './api.js'

/**
 * Opening a notification (P11b-Q2, Q4): the server marks it read and checks its item; an item that is gone or no
 * longer open shows "no longer available" on the row instead of a broken page. `onOpened` runs before navigating.
 */
export function useOpenNotification(onOpened) {
  const navigate = useNavigate()
  const [open] = useOpenNotificationMutation()
  const [unavailable, setUnavailable] = useState(() => new Set())
  async function openItem(item) {
    const result = await open(item.id)
      .unwrap()
      .catch(() => ({ available: false }))
    if (result.available) {
      onOpened?.()
      navigate(result.path)
    } else {
      setUnavailable((current) => new Set(current).add(item.id))
    }
  }
  return { openItem, isUnavailable: (item) => unavailable.has(item.id) }
}
