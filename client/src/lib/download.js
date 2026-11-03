import { getToken } from '@/app/token.js'

/**
 * Saves a file the server builds (the admin CSV exports, OQ-6d) under the name the server gives it. The request
 * carries the session, so it cannot be a plain link. Throws the API error body when the server refuses.
 */
export async function downloadFromApi(path, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/v1${path}?${query}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!response.ok) throw { status: response.status, data: await response.json().catch(() => null) }
  const name = /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'export.csv'
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
