import { interpolate, t } from '../i18n.js'

/*
 * Renders an email from the recipient's dictionary through one shared layout (§2.8).
 * A template has subject, heading, body[], and optionally action (button to params.link),
 * secondary (a second link to params.secondaryLink) and note. params.code shows a code box.
 * Colours are DESIGN_SYSTEM tokens; the button uses #0066C4 for AA contrast.
 */
// The brand and its English tagline stay the same in every language (M-193).
const BRAND = 'Local WorkMan'
const TAGLINE = 'AI Job Portal'

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function renderEmail(type, language, params) {
  const template = t(language, `email.${type}`)
  const layout = t(language, 'email.layout')
  const fill = (text) => interpolate(text, params)
  const fillHtml = (text) => interpolate(escapeHtml(text), Object.fromEntries(Object.entries(params).map(([k, v]) => [k, escapeHtml(v)])))

  const text = [
    fill(template.heading),
    '',
    ...template.body.map(fill),
    params.code ? `\n${params.code}\n` : null,
    template.action ? `${template.action}: ${params.link}` : null,
    template.secondary ? `${template.secondary} ${params.secondaryLink}` : null,
    template.note ? `\n${template.note}` : null,
    `\n${BRAND} · ${TAGLINE}\n${layout.footer}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const paragraph = (content, style = '') =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#202534;${style}">${content}</p>`
  const link = (href) => `<a href="${escapeHtml(href)}" style="color:#0066C4;word-break:break-all">${escapeHtml(href)}</a>`

  const html = `<!doctype html>
<html lang="${language}">
<body style="margin:0;padding:0;background:#F8F9FB;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E8EAF0;border-radius:12px">
<tr><td style="padding:28px 32px 0">
<div style="font-family:Manrope,Arial,sans-serif;font-size:18px;font-weight:800;color:#202534">${BRAND}</div>
<div style="font-size:12px;color:#687184">${TAGLINE}</div>
</td></tr>
<tr><td style="padding:24px 32px 8px">
<h1 style="margin:0 0 16px;font-family:Manrope,Arial,sans-serif;font-size:22px;font-weight:800;color:#202534">${fillHtml(template.heading)}</h1>
${template.body.map((line) => paragraph(fillHtml(line))).join('\n')}
${params.code ? `<p style="margin:8px 0 24px;font-family:Manrope,Arial,sans-serif;font-size:32px;font-weight:800;letter-spacing:6px;color:#202534">${escapeHtml(params.code)}</p>` : ''}
${
  template.action
    ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(params.link)}" style="display:inline-block;background:#0066C4;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px">${escapeHtml(template.action)}</a></p>
${paragraph(`${escapeHtml(layout.linkHint)}<br>${link(params.link)}`, 'font-size:13px;color:#687184')}`
    : ''
}
${template.secondary ? paragraph(`${escapeHtml(template.secondary)}<br>${link(params.secondaryLink)}`, 'font-size:14px') : ''}
${template.note ? paragraph(escapeHtml(template.note), 'font-size:13px;color:#687184') : ''}
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #E8EAF0;font-size:12px;color:#737B8C">${escapeHtml(layout.footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject: fill(template.subject), text, html }
}
