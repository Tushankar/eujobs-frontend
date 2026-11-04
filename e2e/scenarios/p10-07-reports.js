import { createHash } from 'node:crypto'
import { exportText, openAsAdmin, systemRole, invitedAdmin } from '../lib/admins.js'
import { API_URL } from '../lib/env.js'
import { chooseFile, clickText, responseTo, waitForText } from '../lib/flows.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'
import { fixture, VOICE_NOTE } from '../fixtures/make.js'

const BRIEF = 'Compare last week with all time and point out where applications stall.'
const hash = (text) => createHash('sha256').update(text).digest('hex')

/**
 * P10-07 (M-181 … M-183, U23, P10-Q3, P10-Q11): "Marketplace summary", last week, with a brief and the voice note →
 * a transcript of the spoken sentence and an executive summary in the admin's language (real OpenAI) → a CSV in the U23
 * layout → a history entry. "Download again" returns identical bytes. Generating and downloading are audited.
 */
export default {
  name: 'P10-07 Reports',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    const token = await ownerToken()
    const auditBefore = await db('auditevents', 'count', { filter: { category: 'reports' } })
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin/reports', ctx.seedCredentials.password)
    await page.waitForSelector('[data-report-create]')

    await page.select('select[name="type"]', 'marketplace_summary')
    await page.select('select[name="period"]', 'last_week')
    await page.type('textarea[name="brief"]', BRIEF)
    await chooseFile(page, 'input[name="voiceNote"]', fixture(VOICE_NOTE))
    await waitForText(page, VOICE_NOTE)
    await ctx.screenshot(page, '1-form')

    const created = responseTo(page, '/api/v1/admin/reports', 'POST')
    const downloaded = responseTo(page, ['/api/v1/admin/reports/', '/download'])
    await clickText(page, 'Generate & download', 'form button[type="submit"]')
    const createdResponse = await created
    ctx.check(createdResponse.status() === 201, `report created (${createdResponse.status()})`)
    const report = await createdResponse.json()
    await downloaded
    ctx.check(/interview/i.test(report.transcript ?? '') && /applications/i.test(report.transcript ?? ''), `the transcript is the spoken sentence (${report.transcript})`)
    ctx.check(report.aiSummary.length > 40, `an executive summary (${report.aiSummary.slice(0, 80)}…)`)
    await page.waitForSelector(`[data-report="${report.id}"] [data-report-transcript]`)
    await waitForText(page, `${report.filename} was generated and downloaded.`)
    await ctx.screenshot(page, '2-history')

    // U23 layout, from the stored snapshot (read from Node: Chrome would drop the BOM).
    const first = await exportText(`${API_URL}/api/v1/admin/reports/${report.id}/download`, token)
    const rows = first.replace(/^﻿/, '').split('\r\n')
    ctx.check(first.startsWith('﻿'), 'UTF-8 BOM')
    ctx.check(rows[0] === 'Executive summary' && rows[1].replace(/^"|"$/g, '').replace(/""/g, '"') === report.aiSummary, 'row 1–2: the executive summary')
    ctx.check(rows[2] === 'Brief' && first.includes(BRIEF) && first.includes(`Voice note transcript: ${report.transcript}`), 'the Brief row holds the brief and the transcript')
    const tableAt = rows.indexOf('Metric,In period,All time')
    ctx.check(tableAt > 4 && rows.slice(4, tableAt).some((row) => row === ''), 'a blank row, then the data table')
    ctx.check(rows.some((row) => row.startsWith('Published jobs,,')), 'a state metric has only the all-time value (P10-Q11)')

    // "Download again" in the browser and from Node: the same bytes.
    const again = responseTo(page, [`/api/v1/admin/reports/${report.id}/download`])
    await clickText(page, 'Download again', `[data-report="${report.id}"] button`)
    const againStatus = (await again).status()
    ctx.check(againStatus === 200, `Download again answered (${againStatus})`)
    const second = await exportText(`${API_URL}/api/v1/admin/reports/${report.id}/download`, token)
    ctx.check(hash(first) === hash(second), 'identical bytes (hash)')

    const events = await db('auditevents', 'find', { filter: { category: 'reports', at: { $gte: { $date: new Date(Date.now() - 10 * 60_000).toISOString() } } } })
    ctx.check(events.some((event) => event.type === 'reports.report_generated' && event.params.filename === report.filename), 'generating is audited')
    ctx.check(events.filter((event) => event.type === 'reports.report_downloaded').length >= 3, 'every download is audited')
    ctx.check((await db('auditevents', 'count', { filter: { category: 'reports' } })) >= auditBefore + 4, 'four new Reports events')

    // The admin's language: a Spanish-speaking admin gets Spanish headers and a Spanish summary.
    const manager = await invitedAdmin('ReportsEs', (await systemRole('Accounts Head')).id)
    await api('/me', { method: 'PATCH', token: manager.token, body: { language: 'es' } })
    const form = new FormData()
    for (const [name, value] of Object.entries({ type: 'platform_activity', period: 'this_week', tz: 'Europe/Madrid' })) form.append(name, value)
    const spanish = await (await fetch(`${API_URL}/api/v1/admin/reports`, { method: 'POST', headers: { Authorization: `Bearer ${manager.token}` }, body: form })).json()
    const csv = await exportText(`${API_URL}/api/v1/admin/reports/${spanish.id}/download`, manager.token)
    ctx.check(csv.includes('Resumen ejecutivo') && csv.includes('Desde,Hasta,Registros,Solicitudes'), 'Spanish headers for a Spanish admin (OQ-6d)')
    ctx.check(/\b(el|la|los|las|de|en|semana)\b/i.test(spanish.aiSummary) && !/\bthe\b/i.test(spanish.aiSummary), `a Spanish summary (${spanish.aiSummary.slice(0, 80)}…)`)
    ctx.assertClean(handle.issues, 'reports')
  },
}
