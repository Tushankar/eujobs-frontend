import appliedIcon from '@/assets/icons/recruitment-funnel-applied.svg'
import screeningIcon from '@/assets/icons/recruitment-funnel-screening.svg'
import shortlistedIcon from '@/assets/icons/recruitment-funnel-shortlisted.svg'
import interviewIcon from '@/assets/icons/recruitment-funnel-interview.svg'
import offerIcon from '@/assets/icons/recruitment-funnel-offer.svg'
import hireIcon from '@/assets/icons/recruitment-funnel-hire.svg'

/*
 * The Figma funnel, shared by the admin Recruitment funnel and the recruiter's Hiring pipeline funnel. It is drawn in a
 * 1128 x 477 coordinate space (the Figma panel at 1440px). Each stage is an ellipse (x, y, w, h) joined to the next by
 * a tapered band; the stem, ring and label hang below it. `BANDS` = [x, width, left height, right height, colour].
 */
export const WIDTH = 1128
export const HEIGHT = 477
export const CENTER_Y = 238
export const RING_Y = 389.5

/** One icon per stage category (the six Figma stages). */
export const CATEGORY_ICONS = {
  applied: appliedIcon,
  screening: screeningIcon,
  shortlisted: shortlistedIcon,
  interview: interviewIcon,
  offer: offerIcon,
  hired: hireIcon,
}

export const STAGE_SHAPES = [
  { x: 55.5, y: 101, w: 162.4, h: 274, fill: '#a7a5b2', stemX: 136.7, stemTop: 372, labelX: 146.4, icon: appliedIcon, iconBox: [100.3, 205.1, 73] },
  { x: 265, y: 125.5, w: 175.8, h: 223, fill: '#8d8eaa', stemX: 357, stemTop: 344.5, labelX: 362.5, icon: screeningIcon, iconBox: [319, 204.5, 67] },
  { x: 461, y: 145.5, w: 133.1, h: 184, fill: '#7384ae', stemX: 526, stemTop: 327.5, labelX: 529.6, icon: shortlistedIcon, iconBox: [501, 211.5, 54] },
  { x: 620.6, y: 162, w: 103.9, h: 151, fill: '#48648f', stemX: 677, stemTop: 310.5, labelX: 682, icon: interviewIcon, iconBox: [649.5, 218, 45] },
  { x: 750.6, y: 175, w: 79.9, h: 125, fill: '#3f5280', stemX: 793, stemTop: 298.5, labelX: 798.7, icon: offerIcon, iconBox: [770.5, 220, 40] },
  { x: 874.9, y: 205, w: 64, h: 66, fill: '#34486f', stemX: 908, stemTop: 269.5, labelX: 908, icon: hireIcon, iconBox: [888, 222, 36] },
]

export const CAP = { x: 978.3, y: 211, w: 25.3, h: 54, fill: '#314d7e' }

export const BANDS = [
  [127.5, 239.7, 273, 219.1, '#e3dce9'],
  [367.2, 157.1, 218, 184, '#c1c3de'],
  [527, 150.5, 184, 151, '#a4b4dc'],
  [672, 121.1, 151, 123.9, '#7b90be'],
  [793.2, 113.2, 125, 64.8, '#7588b5'],
  [906.5, 85.2, 66, 53.9, '#6d7ea1'],
]

export function bandPath([x, width, left, right]) {
  const x2 = x + width
  return `M${x} ${CENTER_Y - left / 2}L${x2} ${CENTER_Y - right / 2}L${x2} ${CENTER_Y + right / 2}L${x} ${CENTER_Y + left / 2}Z`
}

/** Linear reading of a value across the six Figma stages at position `t` (0 = first stage, 1 = last). */
function along(values, t) {
  const at = t * (values.length - 1)
  const low = Math.floor(at)
  const high = Math.min(low + 1, values.length - 1)
  return values[low] + (values[high] - values[low]) * (at - low)
}

/** The colour of the Figma stage nearest to position `t`. */
const nearest = (values, t) => values[Math.round(t * (values.length - 1))]

/**
 * The funnel for `count` stages: exactly the Figma shapes for six, otherwise the same profile spread over `count`
 * stages (2 … 12), keeping the first stage's left edge and the cap's position. `width` is the drawing's width
 * (wider than 1128 for many stages, so the labels keep room).
 */
export function funnelFor(count) {
  if (count === STAGE_SHAPES.length) return { width: WIDTH, shapes: STAGE_SHAPES, bands: BANDS, cap: CAP }
  const width = Math.max(WIDTH, count * 120 + 200)
  const first = STAGE_SHAPES[0].x + STAGE_SHAPES[0].w / 2
  const last = width - (WIDTH - (STAGE_SHAPES.at(-1).x + STAGE_SHAPES.at(-1).w / 2))
  const step = count > 1 ? (last - first) / (count - 1) : 0
  const pick = (field) => STAGE_SHAPES.map((shape) => shape[field])
  const shapes = Array.from({ length: count }, (_, index) => {
    const t = count > 1 ? index / (count - 1) : 0
    const cx = first + step * index
    const h = along(pick('h'), t)
    const w = Math.min(along(pick('w'), t), step * 0.82 || Infinity)
    const icon = Math.min(along(STAGE_SHAPES.map((shape) => shape.iconBox[2]), t), w * 0.5)
    return { x: cx - w / 2, y: CENTER_Y - h / 2, w, h, fill: nearest(pick('fill'), t), stemX: cx, stemTop: CENTER_Y + h / 2 - 2, labelX: cx, iconBox: [cx - icon / 2, CENTER_Y - icon / 2, icon] }
  })
  const capX = shapes.at(-1).stemX + (CAP.x - STAGE_SHAPES.at(-1).stemX)
  const cap = { ...CAP, x: capX }
  const bandColours = BANDS.map((band) => band[4])
  const bands = shapes.map((shape, index) => {
    const next = shapes[index + 1]
    const t = count > 1 ? index / (count - 1) : 0
    const toX = next ? next.stemX : cap.x + cap.w / 2
    const toH = next ? next.h * 0.98 : cap.h
    return [shape.stemX, toX - shape.stemX, shape.h - 1, toH, nearest(bandColours, t)]
  })
  return { width, shapes, bands, cap }
}
