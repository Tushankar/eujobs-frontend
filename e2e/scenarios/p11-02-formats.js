import { signInWithForm, waitForSettled } from '../lib/flows.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

// Language + header country → the format locale (M-133, M-132, OQ-6b).
const CASES = [
  { language: 'en', country: 'DE', locale: 'en-DE' },
  { language: 'fr', country: 'BE', locale: 'fr-BE' },
  { language: 'es', country: 'ES', locale: 'es-ES' },
  { language: 'en', country: 'REMOTE', locale: 'en-IE' },
]
const ADMIN_LOCALES = { fr: 'fr-FR', es: 'es-ES', en: 'en-IE' }

/** Page text with every kind of space as a plain space (Intl uses no-break and narrow no-break spaces). */
const pageText = (page) => page.evaluate(() => document.body.innerText.replace(/[\s  ]+/g, ' '))
const spaces = (text) => text.replace(/[\s  ]+/g, ' ')

/** Formats in the browser with Intl directly (not the app's format.js), so the expectation is independent. */
const intl = (page, fn, ...args) => page.evaluate(fn, ...args)
const money = (minor, currency, locale) => {
  const amount = minor / 100
  const digits = Number.isInteger(amount) ? 0 : 2
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
}
const salary = (min, max, currency, locale) => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).formatRange(min, max)

/**
 * P11-02: money, salaries and counts in the user's format locale. Billing (the Plus price in the header country's
 * currency) and a job's salary (in the job's currency) for a candidate in en-DE, fr-BE, es-ES and en-IE (Remote);
 * admin Payments in fr and es with a paid HUF 12 345 row: the Collected card and the table show it with no decimals
 * and the language's grouping ("12 345 HUF" in French).
 */
export default {
  name: 'P11-02 Formats',
  viewports: ['D'],
  async run(ctx) {
    const alexEmail = ctx.seedCredentials.email('alex')
    const [alex] = await db('users', 'find', { filter: { email: alexEmail } })
    const countries = (await api('/meta/countries')).body.items
    const [acme] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
    const [job] = await db('jobs', 'find', { filter: { companyId: acme._id, title: 'Product Designer, Growth' } })
    const jobId = job._id.$oid ?? job._id
    try {
      for (const { language, country, locale } of CASES) {
        await db('users', 'updateMany', { filter: { email: alexEmail }, update: { $set: { language, languageExplicit: true, pickerCountry: country } } })
        const handle = await ctx.newPage()
        const { page } = handle
        await signInWithForm(page, ctx.webUrl, '/sign-in', alexEmail, ctx.seedCredentials.password)
        const token = await login(alexEmail, 'candidate', ctx.seedCredentials.password)
        const currency = countries.find((row) => row.code === country).currency
        const plus = (await api(`/plans?currency=${currency}`, { token })).body.items.find((plan) => plan.key === 'plus')

        await page.goto(`${ctx.webUrl}/candidate/settings/billing`, { waitUntil: 'networkidle0' })
        await waitForSettled(page)
        const price = spaces(await intl(page, money, plus.price.amountMinor, plus.price.currency, locale))
        ctx.check((await pageText(page)).includes(price), `${locale} Billing shows the Plus price as "${price}"`)
        ctx.check((await page.evaluate(() => document.documentElement.lang)) === language, `${locale}: the page is in ${language}`)
        await ctx.screenshot(page, `billing-${locale}`)

        const body = (await api(`/jobs/${jobId}`, { token })).body
        const { min, max, currency: jobCurrency } = (body.job ?? body).salary
        await page.goto(`${ctx.webUrl}/candidate/jobs/${jobId}`, { waitUntil: 'networkidle0' })
        await waitForSettled(page)
        const range = spaces(await intl(page, salary, min, max, jobCurrency, locale))
        ctx.check((await pageText(page)).includes(range), `${locale} job details show the salary as "${range}"`)
        await ctx.screenshot(page, `job-${locale}`)
        ctx.note(`${locale}: Plus ${price}; salary ${range}`)
        ctx.assertClean(handle.issues, `${locale} candidate pages`)
      }

      // Admin Payments: a paid HUF 12 345 row (whole amount) read by an fr and an es admin.
      const ownerEmail = ctx.seedCredentials.email()
      const [owner] = await db('users', 'find', { filter: { email: ownerEmail } })
      const now = { $date: new Date().toISOString() }
      await db('payments', 'insertOne', {
        doc: { reference: 'LWM-FMT-HUF', payerName: 'Format check', kind: 'course', itemName: 'Format check', amountMinor: 1_234_500, currency: 'HUF', status: 'paid', source: 'seed', paidAt: now, createdAt: now, updatedAt: now },
      })
      try {
        for (const language of ['fr', 'es']) {
          await db('users', 'updateMany', { filter: { email: ownerEmail }, update: { $set: { language, languageExplicit: true } } })
          const admin = await ctx.newPage()
          await signInWithForm(admin.page, ctx.webUrl, '/admin/sign-in', ownerEmail, ctx.seedCredentials.password)
          await admin.page.goto(`${ctx.webUrl}/admin/payments`, { waitUntil: 'networkidle0' })
          await waitForSettled(admin.page)
          const huf = spaces(await intl(admin.page, money, 1_234_500, 'HUF', ADMIN_LOCALES[language]))
          ctx.check(/^12\D345\D/.test(huf) || /\D12\D345$/.test(huf), `${language}: Intl gives grouped digits (${huf})`)
          const cards = await admin.page.$$eval('section', (sections) => sections.map((section) => section.innerText.replace(/[\s  ]+/g, ' ')))
          ctx.check(cards.some((text) => text.includes(huf)), `${language}: the Collected card shows "${huf}" (no decimals)`)
          ctx.check((await pageText(admin.page)).includes(huf), `${language}: the payments table shows "${huf}"`)
          await ctx.screenshot(admin.page, `admin-payments-${language}`)
          ctx.note(`admin ${language}: ${huf}`)
          ctx.assertClean(admin.issues, `admin Payments ${language}`)
        }
      } finally {
        await db('payments', 'deleteMany', { filter: { reference: 'LWM-FMT-HUF' } })
        await db('users', 'updateMany', { filter: { email: ownerEmail }, update: { $set: { language: owner.language, languageExplicit: owner.languageExplicit ?? false } } })
      }
    } finally {
      await db('users', 'updateMany', {
        filter: { email: alexEmail },
        update: { $set: { language: alex.language, languageExplicit: alex.languageExplicit ?? false, pickerCountry: alex.pickerCountry ?? null } },
      })
    }
  },
}
