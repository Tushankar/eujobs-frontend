/*
 * Phase 2 tasks 3 and 4: the formatters with the locale rule (§3.11, OQ-6b: en-DE, fr-BE, en-IE
 * samples), and the translation catalogue — every enum key of GET /meta/config has a label in
 * en/es/fr, and every namespace that has a Spanish or French file has every English key (plural forms
 * aside). Namespaces of screens migrated after Phase 2 are English until Phase 11 and are listed.
 */
export default {
  name: 'P2-19 Formats and catalogue',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    // A namespace without a Spanish or French file answers 404 (it is English-only until Phase 11).
    handle.allow(404, '/src/i18n/locales/')
    const { page } = handle
    await page.goto(`${ctx.webUrl}/sign-in`, { waitUntil: 'networkidle0' })

    const formats = await page.evaluate(async () => {
      const f = await import('/src/lib/format.js')
      return {
        locales: [f.formatLocale('en', 'DE'), f.formatLocale('fr', 'BE'), f.formatLocale('en', 'REMOTE'), f.formatLocale('es', null)],
        moneyEnDe: f.formatMoney(123456, 'EUR', 'en-DE'),
        moneyFrBe: f.formatMoney(123456, 'EUR', 'fr-BE'),
        wholeEnIe: f.formatMoney(900, 'GBP', 'en-IE'),
        hufEnIe: f.formatMoney(399000, 'HUF', 'en-IE'),
        numberFrBe: f.formatNumber(1234.5, 'fr-BE'),
        dateFrBe: f.formatDate('2026-03-05', 'fr-BE'),
        monthEnIe: f.formatMonth('2024-03', 'en-IE'),
        mondayFrBe: f.weekdayLabels('fr-BE')[0],
      }
    })
    ctx.check(JSON.stringify(formats.locales) === '["en-DE","fr-BE","en-IE","es-ES"]', `locales ${formats.locales}`)
    ctx.check(formats.moneyEnDe.includes('€') && formats.moneyEnDe.includes('1,234.56'), `en-DE money ${formats.moneyEnDe}`)
    ctx.check(/^1\s234,56\s€$/.test(formats.moneyFrBe), `fr-BE money ${formats.moneyFrBe}`)
    ctx.check(formats.wholeEnIe === '£9', `whole amounts have no decimals: ${formats.wholeEnIe}`)
    ctx.check(formats.hufEnIe.includes('3,990') && !formats.hufEnIe.includes('.'), `HUF ${formats.hufEnIe}`)
    ctx.check(/^1\s234,5$/.test(formats.numberFrBe), `fr-BE number ${formats.numberFrBe}`)
    ctx.check(formats.dateFrBe === '5 mars 2026', `fr-BE date-only value ${formats.dateFrBe}`)
    ctx.check(formats.monthEnIe === 'Mar 2024', `en-IE month ${formats.monthEnIe}`)
    ctx.check(formats.mondayFrBe.startsWith('lun'), `fr-BE week starts ${formats.mondayFrBe}`)
    ctx.note(`formats: ${JSON.stringify(formats)}`)

    const catalogue = await page.evaluate(async () => {
      const { LANGUAGES, NAMESPACES } = await import('/src/i18n/index.js')
      const { enums } = await (await fetch('/api/v1/meta/config')).json()
      const load = async (language, namespace) => (await import(`/src/i18n/locales/${language}/${namespace}.json`)).default
      const loadIfAny = (language, namespace) => load(language, namespace).catch(() => null)
      const englishOnly = new Set()
      const flatten = (node, prefix = '') =>
        Object.entries(node).flatMap(([key, value]) => (typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`]))
      const base = (key) => key.replace(/_(zero|one|two|few|many|other)$/, '')
      const problems = []
      for (const language of LANGUAGES) {
        const labels = await load(language, 'enums')
        for (const [name, keys] of Object.entries(enums)) {
          for (const key of keys) {
            const label = key.split('.').reduce((node, part) => node?.[part], labels[name])
            if (typeof label !== 'string') problems.push(`${language} enums:${name}.${key}`)
          }
        }
        if (language === 'en') continue
        for (const namespace of NAMESPACES) {
          const translated = await loadIfAny(language, namespace)
          if (!translated) {
            englishOnly.add(namespace)
            continue
          }
          const have = new Set(flatten(translated).map(base))
          for (const key of new Set(flatten(await load('en', namespace)).map(base))) {
            if (!have.has(key)) problems.push(`${language} ${namespace}:${key}`)
          }
        }
      }
      return { languages: LANGUAGES, namespaces: NAMESPACES, enumCount: Object.values(enums).flat().length, problems, englishOnly: [...englishOnly] }
    })
    ctx.note(`catalogue: ${catalogue.languages.join('/')} × ${catalogue.namespaces.length} namespaces, ${catalogue.enumCount} enum keys`)
    ctx.note(`English only until Phase 11: ${catalogue.englishOnly.join(', ') || 'none'}`)
    ctx.check(!catalogue.problems.length, `missing translations:\n  ${catalogue.problems.join('\n  ')}`)
    ctx.assertClean(handle.issues, 'formats and catalogue')
  },
}
