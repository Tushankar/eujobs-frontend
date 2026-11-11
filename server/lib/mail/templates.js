import { config } from '../../config/env.js'
import { interpolate, t } from '../i18n.js'

/*
 * Renders an email from the recipient's dictionary through one shared layout (§2.8).
 * A template has subject, heading, body[], and optionally action (button to params.link),
 * secondary (a second link to params.secondaryLink) and note. params.code shows a code box; params.items (strings)
 * shows a list after the body, such as the jobs of an alert; with params.moreLink, the template's `more` line and that
 * link follow the list (a shortened list).
 * Layout (full width): a navy band (#012B74, the logo's navy) with the white EU JOBS logo and an "Open EU Jobs" link,
 * a blue accent line, the content in a 680px column, and a light footer band with the reason line and legal links.
 * The logo is a PNG served by the client at CLIENT_ORIGIN/email/logo-white.png (mail apps block SVG and cannot reach
 * localhost). The button is a table cell so Outlook keeps its colour; it uses the logo gradient (blue #0263DC to navy).
 */
// The brand and its English tagline stay the same in every language (M-193).
const BRAND = 'EU Jobs'
const TAGLINE = 'AI Powered Careers'
const NAVY = '#012B74'
const BLUE = '#0263DC'
const GRADIENT = 'linear-gradient(135deg,#0A6CF0 0%,#0247C1 55%,#012B74 100%)'
const INK = '#0B1220'
const BODY = '#344054'
const MUTED = '#667085'
const LINE = '#E4E7EC'
const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

/*
 * Gmail's apps recolour background colours in dark mode but leave background images alone, so brand colours that must
 * stay (navy band, blue line, button) are also painted as a one-colour gradient.
 */
const fixed = (colour) => `background:${colour};background-image:linear-gradient(${colour},${colour})`

/** A full-width band whose content sits in the centred 680px column; `keep` holds its colour in dark mode. */
const band = (background, content, padding, keep = false) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${keep ? fixed(background) : `background:${background}`}">
<tr><td align="center" style="padding:${padding}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px">
${content}
</table>
</td></tr>
</table>`

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
    `\n${BRAND} · ${TAGLINE}\n${layout.footer}\n${layout.reason}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const paragraph = (content, style = '') => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};${style}">${content}</p>`
  const link = (href) => `<a href="${escapeHtml(href)}" style="color:${BLUE};text-decoration:none;word-break:break-all">${escapeHtml(href)}</a>`

  // Items such as "Title · Company · City": the part before the first " · " is the title, the rest the details line.
  const items = params.items?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border:1px solid ${LINE};border-radius:12px;border-collapse:separate">
${params.items
  .map((item, index) => {
    const [title, ...rest] = String(item).split(' · ')
    return `<tr><td style="padding:12px 16px;${index ? `border-top:1px solid ${LINE};` : ''}">
<div style="font-size:15px;line-height:1.4;font-weight:600;color:${INK}">${escapeHtml(title)}</div>
${rest.length ? `<div style="margin-top:2px;font-size:13px;line-height:1.4;color:${MUTED}">${escapeHtml(rest.join(' · '))}</div>` : ''}
</td></tr>`
  })
  .join('\n')}
</table>`
    : ''

  const button = template.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px"><tr>
<td bgcolor="${BLUE}" style="background:${BLUE};background-image:${GRADIENT};border-radius:999px">
<a href="${escapeHtml(params.link)}" style="display:inline-block;padding:8px 8px 8px 22px;background:${BLUE};background-image:${GRADIENT};font-family:${FONT};font-size:15px;line-height:28px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px">${escapeHtml(template.action)}<span style="display:inline-block;width:28px;height:28px;margin-left:12px;border-radius:999px;${fixed('#FFFFFF')};color:${BLUE};font-size:15px;line-height:28px;text-align:center;vertical-align:top">&#8599;</span></a>
</td></tr></table>
${paragraph(`${escapeHtml(layout.linkHint)}<br>${link(params.link)}`, `margin:12px 0 0;font-size:12px;line-height:1.5;color:${MUTED}`)}`
    : ''

  const legal = ['privacy', 'terms', 'imprint']
    .map((doc) => `<a href="${escapeHtml(`${config.clientOrigin}/legal/${doc}`)}" style="color:${MUTED};text-decoration:underline">${escapeHtml(layout[doc])}</a>`)
    .join(' &nbsp;·&nbsp; ')

  const header = band(
    NAVY,
    `<tr>
<td align="left" valign="middle"><img src="${escapeHtml(`${config.clientOrigin}/email/logo-white.png`)}" width="150" alt="${BRAND} · ${TAGLINE}" style="display:block;width:150px;max-width:100%;height:auto;border:0;color:#FFFFFF;font-size:18px;font-weight:700"></td>
<td align="right" valign="middle"><a href="${escapeHtml(config.clientOrigin)}" style="font-size:13px;font-weight:600;color:#FFFFFF;text-decoration:none;white-space:nowrap">${escapeHtml(layout.open)} &#8594;</a></td>
</tr>`,
    '18px 24px',
    true,
  )

  const content = band(
    '#FFFFFF',
    `<tr><td>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.2px;color:${INK}">${fillHtml(template.heading)}</h1>
${body.map((line) => paragraph(fillHtml(line))).join('\n')}
${items}
${params.moreLink ? paragraph(`${fillHtml(template.more)}<br>${link(params.moreLink)}`, 'font-size:14px') : ''}
${params.code ? `<p style="margin:8px 0 16px;padding:16px;background:#F2F5FC;border:1px solid ${LINE};border-radius:12px;text-align:center;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:8px;color:${NAVY}">${escapeHtml(params.code)}</p>` : ''}
${button}
${template.secondary ? paragraph(`${escapeHtml(template.secondary)}<br>${link(params.secondaryLink)}`, 'margin:16px 0 0;font-size:14px') : ''}
${template.note ? paragraph(escapeHtml(template.note), `margin:16px 0 0;font-size:13px;color:${MUTED}`) : ''}
</td></tr>`,
    '28px 24px 32px',
  )

  const footer = band(
    '#F5F7FA',
    `<tr><td style="font-size:12px;line-height:1.6;color:${MUTED}">
<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${NAVY}">${BRAND} <span style="font-weight:500;color:${MUTED}">· ${TAGLINE}</span></p>
<p style="margin:0 0 4px">${escapeHtml(layout.footer)} ${escapeHtml(layout.reason)}</p>
<p style="margin:10px 0 0">${legal}</p>
<p style="margin:10px 0 0">© ${new Date().getFullYear()} ${BRAND}</p>
</td></tr>`,
    '20px 24px 24px',
  )

  const html = `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(fill(template.subject))}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${body.length ? fillHtml(body[0]) : ''}</div>
<div style="font-family:${FONT}">
${header}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:4px;line-height:4px;font-size:0;${fixed(BLUE)}">&nbsp;</td></tr></table>
${content}
${footer}
</div>
</body>
</html>`

  return { subject: fill(template.subject), text, html }
}
