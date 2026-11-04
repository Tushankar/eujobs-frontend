import { signInWithForm } from './flows.js'
import { ownerToken } from './recruiters.js'
import { api, linkToken, TEST_PASSWORD, uniqueEmail } from './testApi.js'

/* Admin staff for the Phase 10 scenarios (M-154 … M-160): roles and invited admins made through the real API. */

const check = (result, label) => {
  if (result.status >= 300) throw new Error(`${label} failed: ${result.status} ${JSON.stringify(result.body)}`)
  return result.body
}

/** A custom role holding exactly `permissions`; the name is unique per run. */
export async function roleWith(label, permissions, token) {
  const body = { name: `${label} ${Date.now() % 100000}`, scope: 'team', description: `Phase 10 check: ${label}.`, permissions }
  return check(await api('/admin/roles', { method: 'POST', token: token ?? (await ownerToken()), body }), `role ${label}`)
}

/** A system role by name (Manager, Accounts Head, Staff). */
export async function systemRole(name, token) {
  const { items } = check(await api('/admin/roles', { token: token ?? (await ownerToken()) }), 'roles')
  return items.find((role) => role.system && role.name === name)
}

/** An admin invited by the Owner with `roleId` who set a password through the invite link; returns { id, email, fullName, token }. */
export async function invitedAdmin(label, roleId) {
  const owner = await ownerToken()
  const email = uniqueEmail(label.toLowerCase())
  const fullName = `${label} ${Date.now() % 100000}`
  const invited = check(await api('/admin/invitations', { method: 'POST', token: owner, body: { email, fullName, roleId } }), `invite ${label}`)
  const link = await linkToken(email, 'admin_invite')
  check(await api('/auth/invite/accept', { method: 'POST', body: { token: link.searchParams.get('token'), password: TEST_PASSWORD } }), 'accept invite')
  const { token } = check(await api('/auth/login', { method: 'POST', body: { email, password: TEST_PASSWORD, portal: 'admin' } }), 'admin login')
  // U22: a new admin has not accepted the Terms yet; the workspace would ask on the first page, as for any account.
  check(await api('/me/legal/accept', { method: 'POST', token }), 'accept the Terms')
  return { id: invited.id, email, fullName, token }
}

/** Signs an admin in through the admin form and opens `path`. */
export async function openAsAdmin(ctx, handle, email, path, password = TEST_PASSWORD) {
  await signInWithForm(handle.page, ctx.webUrl, '/admin/sign-in', email, password)
  if (path) await handle.page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
}

/** The labels of the admin sidebar's page links (also present while the mobile drawer is closed). */
export const sidebarLabels = (page) => page.$$eval('#workspace-sidebar nav a', (links) => links.map((link) => link.textContent.trim()))

/**
 * A server export fetched again from Node, decoded with its BOM kept: puppeteer reads response bodies through Chrome,
 * which drops the BOM, so the bytes are checked here.
 */
export async function exportText(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer())
}
