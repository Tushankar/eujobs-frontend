import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { readZip } from '../../server/test/helpers/zip.js'
import { API_URL, TEST_UPLOAD_ROOT } from './env.js'
import { clickText, fill, responseTo, waitForPath, waitForText } from './flows.js'
import { db, TEST_PASSWORD } from './testApi.js'

/* Phase 12 helpers: the export ZIP, the delete dialog, files on disk. */

/** GET /me/export from Node, unzipped: { name: Buffer } (the browser's download is checked by its response). */
export async function exportOf(token) {
  const response = await fetch(`${API_URL}/api/v1/me/export`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`export answered ${response.status}`)
  return readZip(Buffer.from(await response.arrayBuffer()))
}

export const zipJson = (zip, name) => JSON.parse(zip[name].toString('utf8'))

/** Whether a stored file (a `files` row from /_test/db) is still on disk. */
export const onDisk = (file) => access(join(TEST_UPLOAD_ROOT, file.path)).then(() => true, () => false)

export const filesOf = (ownerId, purpose) => db('files', 'find', { filter: { ownerId: { $oid: ownerId }, ...(purpose && { purpose }) } })

/** Data & account → the delete button → a wrong password is refused, then the right one deletes and signs out. */
export async function deleteThroughUi(ctx, handle, { button, signInPath }) {
  const { page } = handle
  handle.allow(422, '/api/v1/me')
  await clickText(page, button, 'main button')
  await page.waitForSelector('[role="dialog"] input[name="currentPassword"]', { visible: true })
  await handle.checkOverflow()
  await ctx.screenshot(page, 'delete-dialog')
  await fill(page, '[role="dialog"] input[name="currentPassword"]', 'Not-My-Password-7')
  const refused = responseTo(page, ['/api/v1/me'], 'DELETE')
  await clickText(page, button, '[role="dialog"] button')
  ctx.check((await refused).status() === 422, 'a wrong password is refused')
  await waitForText(page, "This isn't your current password.")
  await fill(page, '[role="dialog"] input[name="currentPassword"]', TEST_PASSWORD)
  const deleted = responseTo(page, ['/api/v1/me'], 'DELETE')
  await clickText(page, button, '[role="dialog"] button')
  ctx.check((await deleted).status() === 204, 'DELETE /me answered 204')
  await waitForPath(page, signInPath)
}
