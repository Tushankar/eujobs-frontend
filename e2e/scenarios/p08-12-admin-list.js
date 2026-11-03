import { signInWithForm } from '../lib/flows.js'
import { limitedAdmin } from '../lib/learning.js'
import { db } from '../lib/testApi.js'

const id = (doc) => doc._id.$oid ?? doc._id

/** M-110, M-111 from the test database: per candidate course, enrolled, purchased (paid rows) and completions. */
async function expectedRows() {
  const [courses, enrollments, payments] = await Promise.all([
    db('courses', 'find', { filter: { audience: 'candidate' } }),
    db('enrollments', 'find', {}),
    db('payments', 'find', { filter: { kind: 'course', status: 'paid' } }),
  ])
  return courses.map((course) => {
    const mine = enrollments.filter((enrollment) => id({ _id: enrollment.courseId }) === id(course))
    return {
      id: id(course),
      title: course.title,
      enrolled: mine.length,
      completions: mine.filter((enrollment) => enrollment.completedAt).length,
      purchased: payments.filter((payment) => payment.itemId === id(course)).length,
    }
  })
}

const rowTexts = (page) => page.$$eval('main tbody tr', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ')))

/**
 * P8-12 (M-110, M-111): each row reads "{enrolled} enrolled, {purchased} purchased, {completions} completed" as the
 * database says; Revenue per currency shows only for an admin with finance.view; the page totals add up; the learners
 * list has one row per enrollment.
 */
export default {
  name: 'P8-12 Admin list',
  viewports: ['D'],
  async run(ctx) {
    const expected = await expectedRows()
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/courses`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('main tbody tr')
    const rows = await rowTexts(page)
    for (const course of expected) {
      const text = `${course.enrolled} enrolled, ${course.purchased} purchased, ${course.completions} completed`
      ctx.check(rows.some((row) => row.includes(course.title) && row.includes(text)), `${course.title}: ${text}`)
    }
    ctx.check((await page.$$('main [data-revenue]')).length === expected.length, 'the Owner (finance.view) sees Revenue on every row')
    const sum = (field) => expected.reduce((total, course) => total + course[field], 0)
    const totals = await page.$eval('[data-course-totals]', (element) => element.textContent)
    ctx.check(totals.includes(`${sum('enrolled')} enrolled, ${sum('purchased')} purchased, ${sum('completions')} completed`) && totals.includes('revenue'), `page totals: ${totals}`)
    await ctx.screenshot(page, '1-owner')

    const busiest = [...expected].sort((a, b) => b.enrolled - a.enrolled)[0]
    await page.goto(`${ctx.webUrl}/admin/courses/${busiest.id}/learners`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('main tbody tr')
    ctx.check((await page.$$('main tbody tr')).length === busiest.enrolled, `the learners list of "${busiest.title}" has ${busiest.enrolled} rows`)
    await ctx.screenshot(page, '2-learners')
    ctx.assertClean(handle.issues, 'owner')

    // Without finance.view: no Revenue, no revenue total.
    const reader = await limitedAdmin(ctx.seedCredentials.email(), 'learning-view', ['learning.view'])
    const limited = await ctx.newPage()
    try {
      await signInWithForm(limited.page, ctx.webUrl, '/admin/sign-in', reader.email, ctx.seedCredentials.password)
      await limited.page.goto(`${ctx.webUrl}/admin/courses`, { waitUntil: 'networkidle0' })
      await limited.page.waitForSelector('main tbody tr')
      ctx.check(!(await limited.page.$('main [data-revenue]')), 'no Revenue column without finance.view')
      ctx.check(!(await limited.page.$eval('[data-course-totals]', (element) => element.textContent)).includes('revenue'), 'no revenue total without finance.view')
      await ctx.screenshot(limited.page, '3-learning-view-only')
      ctx.assertClean(limited.issues, 'learning.view admin')
    } finally {
      await db('adminroles', 'deleteMany', { filter: { _id: reader.roleId } })
    }
  },
}
