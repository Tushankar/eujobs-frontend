/*
 * Guilloché line art as SVG path data, for the certificate preview. The same curves as the certificate PDF
 * (server/lib/pdf.js), so the preview matches the document the holder has.
 */
const round = (value) => Math.round(value * 10) / 10

/** `count` sine waves, evenly out of phase, along the line from (x0, y0) to (x1, y1). */
export function waves(x0, y0, x1, y1, amp, period, count) {
  const length = Math.hypot(x1 - x0, y1 - y0)
  const [ux, uy] = [(x1 - x0) / length, (y1 - y0) / length]
  const steps = Math.ceil(length / 3)
  let path = ''
  for (let wave = 0; wave < count; wave++) {
    const phase = (wave * 2 * Math.PI) / count
    for (let step = 0; step <= steps; step++) {
      const along = (step / steps) * length
      const offset = amp * Math.sin((2 * Math.PI * along) / period + phase)
      path += `${step ? 'L' : 'M'}${round(x0 + ux * along - uy * offset)} ${round(y0 + uy * along + ux * offset)}`
    }
  }
  return path
}

/** A band of waves all round a `width` × `height` page, centred `inset` in from the edge. */
export function frame(width, height, inset, amp, period, count) {
  const [left, top, right, bottom] = [inset, inset, width - inset, height - inset]
  return [
    [left, top, right, top],
    [right, top, right, bottom],
    [right, bottom, left, bottom],
    [left, bottom, left, top],
  ]
    .map(([x0, y0, x1, y1]) => waves(x0, y0, x1, y1, amp, period, count))
    .join('')
}

/** A rosette: `count` closed curves r = R + amp·sin(kθ + phase) around (cx, cy). */
export function rosette(cx, cy, radius, amp, k, count) {
  let path = ''
  for (let curve = 0; curve < count; curve++) {
    const phase = (curve * 2 * Math.PI) / count
    for (let step = 0; step <= 720; step++) {
      const angle = (step / 720) * 2 * Math.PI
      const r = radius + amp * Math.sin(k * angle + phase)
      path += `${step ? 'L' : 'M'}${round(cx + r * Math.cos(angle))} ${round(cy + r * Math.sin(angle))}`
    }
    path += 'Z'
  }
  return path
}
