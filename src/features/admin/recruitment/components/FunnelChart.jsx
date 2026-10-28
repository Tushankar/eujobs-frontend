import appliedIcon from '@/assets/icons/recruitment-funnel-applied.svg'
import screeningIcon from '@/assets/icons/recruitment-funnel-screening.svg'
import shortlistedIcon from '@/assets/icons/recruitment-funnel-shortlisted.svg'
import interviewIcon from '@/assets/icons/recruitment-funnel-interview.svg'
import offerIcon from '@/assets/icons/recruitment-funnel-offer.svg'
import hireIcon from '@/assets/icons/recruitment-funnel-hire.svg'
import { cx } from '@/utils/cx.js'
import { FUNNEL_STAGES } from '../data/recruitment.js'
import styles from './FunnelChart.module.css'

/*
 * Funnel drawn in a 1128 x 477 coordinate space (the Figma panel at 1440px). Each stage is an ellipse
 * (x, y, w, h) joined to the next by a tapered band; the stem, ring and label hang below it.
 * `bands` = [x, width, left height, right height, colour].
 */
const WIDTH = 1128
const HEIGHT = 477
const CENTER_Y = 238
const RING_Y = 389.5

const STAGE_SHAPES = [
  { x: 55.5, y: 101, w: 162.4, h: 274, fill: '#a7a5b2', stemX: 136.7, stemTop: 372, labelX: 146.4, icon: appliedIcon, iconBox: [100.3, 205.1, 73] },
  { x: 265, y: 125.5, w: 175.8, h: 223, fill: '#8d8eaa', stemX: 357, stemTop: 344.5, labelX: 362.5, icon: screeningIcon, iconBox: [319, 204.5, 67] },
  { x: 461, y: 145.5, w: 133.1, h: 184, fill: '#7384ae', stemX: 526, stemTop: 327.5, labelX: 529.6, icon: shortlistedIcon, iconBox: [501, 211.5, 54] },
  { x: 620.6, y: 162, w: 103.9, h: 151, fill: '#48648f', stemX: 677, stemTop: 310.5, labelX: 682, icon: interviewIcon, iconBox: [649.5, 218, 45] },
  { x: 750.6, y: 175, w: 79.9, h: 125, fill: '#3f5280', stemX: 793, stemTop: 298.5, labelX: 798.7, icon: offerIcon, iconBox: [770.5, 220, 40] },
  { x: 874.9, y: 205, w: 64, h: 66, fill: '#34486f', stemX: 908, stemTop: 269.5, labelX: 908, icon: hireIcon, iconBox: [888, 222, 36] },
]

const CAP = { x: 978.3, y: 211, w: 25.3, h: 54, fill: '#314d7e' }

const BANDS = [
  [127.5, 239.7, 273, 219.1, '#e3dce9'],
  [367.2, 157.1, 218, 184, '#c1c3de'],
  [527, 150.5, 184, 151, '#a4b4dc'],
  [672, 121.1, 151, 123.9, '#7b90be'],
  [793.2, 113.2, 125, 64.8, '#7588b5'],
  [906.5, 85.2, 66, 53.9, '#6d7ea1'],
]

function bandPath([x, width, left, right]) {
  const x2 = x + width
  return `M${x} ${CENTER_Y - left / 2}L${x2} ${CENTER_Y - right / 2}L${x2} ${CENTER_Y + right / 2}L${x} ${CENTER_Y + left / 2}Z`
}

/**
 * Funnel view of the hiring pipeline as an inline SVG. Each stage is a button: choosing one reports it
 * through `onSelectStage` (the page uses it to filter the candidate movement table).
 */
export default function FunnelChart({ selectedStage, onSelectStage }) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Funnel View</h3>
      <div className={styles.scroll}>
        <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Hiring funnel by stage">
          {BANDS.map((band) => (
            <path key={band[0]} d={bandPath(band)} fill={band[4]} />
          ))}
          <ellipse cx={CAP.x + CAP.w / 2} cy={CAP.y + CAP.h / 2} rx={CAP.w / 2} ry={CAP.h / 2} fill={CAP.fill} />

          {FUNNEL_STAGES.map((stage, index) => {
            const shape = STAGE_SHAPES[index]
            const selected = selectedStage === stage.stage
            const choose = () => onSelectStage(stage.stage)
            const [iconX, iconY, iconSize] = shape.iconBox
            return (
              <g
                key={stage.id}
                className={cx(styles.stage, selected && styles.selected)}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${stage.label}: ${stage.count} candidates. Show candidates at this stage.`}
                onClick={choose}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    choose()
                  }
                }}
              >
                <rect x={shape.x} y={shape.y} width={shape.w} height={440 - shape.y} fill="transparent" />
                <line x1={shape.stemX} x2={shape.stemX} y1={shape.stemTop} y2={RING_Y - 5} className={styles.stem} />
                <circle cx={shape.stemX} cy={RING_Y} r={5} className={styles.ring} />
                <ellipse
                  className={styles.ellipse}
                  cx={shape.x + shape.w / 2}
                  cy={shape.y + shape.h / 2}
                  rx={shape.w / 2}
                  ry={shape.h / 2}
                  fill={shape.fill}
                />
                {selected && (
                  <ellipse
                    className={styles.outline}
                    cx={shape.x + shape.w / 2}
                    cy={shape.y + shape.h / 2}
                    rx={shape.w / 2 + 3}
                    ry={shape.h / 2 + 3}
                  />
                )}
                <image href={shape.icon} x={iconX} y={iconY} width={iconSize} height={iconSize} />
                <text className={styles.label} x={shape.labelX} y={407} textAnchor="middle" dominantBaseline="central">
                  {stage.label}
                </text>
                <text className={styles.count} x={shape.labelX} y={428} textAnchor="middle" dominantBaseline="central">
                  {stage.count}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
