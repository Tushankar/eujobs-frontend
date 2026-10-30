import { fixture } from '../fixtures/make.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { onboardedCandidate, uploadAs } from '../lib/candidates.js'
import { db, uniqueEmail } from '../lib/testApi.js'

/** A test-only admin with `permissions` (M-155), signing in with SEED_PASSWORD; returns its email. */
async function testAdmin(owner, label, permissions) {
  const nameLower = `e2e ${label} ${Date.now()}`
  const { insertedId: roleId } = await db('adminroles', 'insertOne', {
    doc: { name: nameLower, nameLower, permissions, status: 'active', system: false, scope: 'team' },
  })
  const email = uniqueEmail(`admin-${label}`)
  const { _id, isOwner, ...fields } = owner
  await db('users', 'insertOne', { doc: { ...fields, email, fullName: `Test admin ${label}`, isOwner: false, adminAccess: { roleId, granted: [], removed: [] } } })
  return { email, roleId }
}

/**
 * P3-08 (M-155, §2.6): an admin without moderation.manage gets PERMISSION_DENIED and the translated
 * no-permission state; with moderation.manage but no documents.view the evidence preview is refused.
 */
export default {
  name: 'P3-08 Permission denial',
  viewports: ['D'],
  async run(ctx) {
    const [owner] = await db('users', 'find', { filter: { isOwner: true } })
    const reader = await testAdmin(owner, 'reader', ['users.view'])
    const moderator = await testAdmin(owner, 'moderator', ['moderation.manage'])
    try {
      const evidence = await onboardedCandidate('Denied')
      await uploadAs(evidence.token, '/candidate/verification/submissions', fixture('passport.jpg'), 'image/jpeg', { category: 'identity', evidenceType: 'passport' })

      const first = await ctx.newPage()
      first.allow(403, '/api/v1/admin/moderation/verification')
      await signInWithForm(first.page, ctx.webUrl, '/admin/sign-in', reader.email, ctx.seedCredentials.password)
      await first.page.goto(`${ctx.webUrl}/admin/moderation/verification`, { waitUntil: 'networkidle0' })
      await waitForText(first.page, "Your role doesn't include this permission.")
      await waitForText(first.page, 'This queue needs the moderation.manage permission.')
      await ctx.screenshot(first.page, '1-no-moderation')
      ctx.assertClean(first.issues, 'without moderation.manage')

      const second = await ctx.newPage()
      second.allow(403, '/api/v1/admin/files/')
      await signInWithForm(second.page, ctx.webUrl, '/admin/sign-in', moderator.email, ctx.seedCredentials.password)
      await second.page.goto(`${ctx.webUrl}/admin/moderation/verification`, { waitUntil: 'networkidle0' })
      const link = await second.page.waitForFunction(
        (person) => [...document.querySelectorAll('li')].find((row) => row.innerText.includes(person))?.querySelector('a'),
        { timeout: 15_000 },
        evidence.user.fullName,
      )
      await link.asElement().click()
      await waitForText(second.page, 'Previews need the documents.view permission.')
      ctx.check(!(await second.page.$('[role="dialog"] img[alt^="Evidence file"]')), 'no preview without documents.view')
      await ctx.screenshot(second.page, '2-no-documents')
      ctx.assertClean(second.issues, 'without documents.view')
    } finally {
      for (const admin of [reader, moderator]) {
        await db('users', 'deleteMany', { filter: { email: admin.email } })
        await db('adminroles', 'deleteMany', { filter: { _id: admin.roleId } })
      }
    }
  },
}
