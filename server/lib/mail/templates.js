import { config } from '../../config/env.js'
import { interpolate, t } from '../i18n.js'

/*
 * Renders an email from the recipient's dictionary through one shared layout (§2.8).
 * A template has subject, heading, body[], and optionally action (button to params.link),
 * secondary (a second link to params.secondaryLink) and note. params.code shows a code box; params.items (strings)
 * shows a list after the body, such as the jobs of an alert; with params.moreLink, the template's `more` line and that
 * link follow the list (a shortened list).
 * Layout: a navy band (#012B74, the logo's navy) with the white EU JOBS logo, a white card and a light footer. The logo
 * is a PNG served by the client at CLIENT_ORIGIN/email/logo-white.png (mail apps block SVG and cannot reach localhost).
 */
// The brand and its English tagline stay the same in every language (M-193).
const BRAND = 'EU Jobs'
const TAGLINE = 'AI Powered Careers'
const NAVY = '#012B74'
const INK = '#101828'
const BODY = '#3D4555'
const MUTED = '#6B7385'
const LINE = '#E4E8F0'

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function renderEmail(type, language, params) {
  const template = t(language, `email.${type}`)
  const layout = t(language, 'email.layout')
  const fill = (text) => interpolate(text, params)
  const fillHtml = (text) => interpolate(escapeHtml(text), Object.fromEntries(Object.entries(params).map(([k, v]) => [k, escapeHtml(v)])))
  // A line that is only an optional parameter (e.g. {{details}}) is left out when that parameter is empty.
  const body = template.body.filter((line) => fill(line).trim())

  const text = [
    fill(template.heading),
    '',
    ...body.map(fill),
    ...(params.items ?? []).map((item) => `- ${item}`),
    params.moreLink ? `${fill(template.more)} ${params.moreLink}` : null,
    params.code ? `\n${params.code}\n` : null,
    template.action ? `${template.action}: ${params.link}` : null,
    template.secondary ? `${template.secondary} ${params.secondaryLink}` : null,
    template.note ? `\n${template.note}` : null,
    `\n${BRAND} · ${TAGLINE}\n${layout.footer}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const paragraph = (content, style = '') =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BODY};${style}">${content}</p>`
  const link = (href) => `<a href="${escapeHtml(href)}" style="color:${NAVY};word-break:break-all">${escapeHtml(href)}</a>`
  const items = params.items?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border:1px solid ${LINE};border-radius:12px;border-collapse:separate">
${params.items.map((item, index) => `<tr><td style="padding:14px 18px;font-size:15px;line-height:1.5;color:${INK};font-weight:600;${index ? `border-top:1px solid ${LINE};` : ''}">${escapeHtml(item)}</td></tr>`).join('\n')}
</table>`
    : ''

  const html = `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(fill(template.subject))}</title>
</head>
<body style="margin:0;padding:0;background:#EEF1F6;font-family:Inter,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${body.length ? fillHtml(body[0]) : ''}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F6;padding:40px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,0.06)">
<tr><td align="center" style="background:${NAVY};padding:32px 40px">
<img src="${escapeHtml(`${config.clientOrigin}/email/logo-white.png`)}" width="180" alt="${BRAND} · ${TAGLINE}" style="display:block;width:180px;max-width:100%;height:auto;border:0;color:#FFFFFF;font-size:20px;font-weight:700">
</td></tr>
<tr><td style="padding:40px 40px 16px">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.2px;color:${INK}">${fillHtml(template.heading)}</h1>
${body.map((line) => paragraph(fillHtml(line))).join('\n')}
${items}
${params.moreLink ? paragraph(`${fillHtml(template.more)}<br>${link(params.moreLink)}`, 'font-size:14px') : ''}
${params.code ? `<p style="margin:8px 0 24px;padding:20px;background:#F3F6FB;border:1px solid ${LINE};border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:${NAVY}">${escapeHtml(params.code)}</p>` : ''}
${
  template.action
    ? `<p style="margin:12px 0 28px"><a href="${escapeHtml(params.link)}" style="display:inline-block;background:${NAVY};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px">${escapeHtml(template.action)}</a></p>
${paragraph(`${escapeHtml(layout.linkHint)}<br>${link(params.link)}`, `font-size:13px;color:${MUTED}`)}`
    : ''
}
${template.secondary ? paragraph(`${escapeHtml(template.secondary)}<br>${link(params.secondaryLink)}`, 'font-size:14px') : ''}
${template.note ? paragraph(escapeHtml(template.note), `font-size:13px;color:${MUTED}`) : ''}
</td></tr>
<tr><td style="padding:24px 40px 32px;background:#F7F9FC;border-top:1px solid ${LINE}">
<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${NAVY}">${BRAND} <span style="font-weight:600;color:${MUTED}">· ${TAGLINE}</span></p>
<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">${escapeHtml(layout.footer)}</p>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;color:#8A93A5">© ${new Date().getFullYear()} ${BRAND}</p>
</td></tr>
</table>
</body>
</html>`

  return { subject: fill(template.subject), text, html }
}
