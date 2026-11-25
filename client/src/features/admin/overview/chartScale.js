/**
 * A count axis: a tidy whole-number step and the ticks from 0 up to the first one at or above `max` (2026-11-25: counts
 * never get 0.2 steps). At most five steps; a quiet week of 0–1 sign-ups reads 0, 1, 2 rather than 0 … 1 in fifths.
 */
export function countScale(max) {
  const raw = Math.max(max, 1) / 5
  const magnitude = Math.max(1, 10 ** Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw && Number.isInteger(candidate))
  const steps = Math.max(2, Math.ceil(Math.max(max, 1) / step))
  return { ceiling: step * steps, ticks: Array.from({ length: steps + 1 }, (_, index) => step * index) }
}
