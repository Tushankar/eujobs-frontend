/** Rounds `max` up to a tidy axis ceiling that splits into five equal steps (e.g. 21 -> 25, 104 -> 120). */
export function niceCeiling(max) {
  const raw = Math.max(max, 1) / 5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw)
  return step * 5
}
