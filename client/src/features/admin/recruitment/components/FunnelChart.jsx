import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import { BANDS, bandPath, CAP, HEIGHT, RING_Y, STAGE_SHAPES, WIDTH } from '../funnelGeometry.js'
import styles from './FunnelChart.module.css'

/**
 * Funnel view of the hiring pipeline as an inline SVG: fixed Figma shapes with real numbers (M-179), each the
 * applications that ever reached that category, withdrawn ones excluded (M-178). Each stage is a button: choosing one
 * reports it through `onSelectStage` (the page uses it to filter the candidate movement table).
 */
export default function FunnelChart({ funnel, selectedStage, onSelectStage }) {
  const { t } = useTranslation(['adminRecruitment', 'enums'])
  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{t('funnel.title')}</h3>
      <div className={styles.scroll}>
        <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={t('funnel.label')}>
          {BANDS.map((band) => (
            <path key={band[0]} d={bandPath(band)} fill={band[4]} />
          ))}
          <ellipse cx={CAP.x + CAP.w / 2} cy={CAP.y + CAP.h / 2} rx={CAP.w / 2} ry={CAP.h / 2} fill={CAP.fill} />

          {funnel.map((stage, index) => {
            const shape = STAGE_SHAPES[index]
            const label = t(`enums:stageCategory.${stage.category}`)
            const selected = selectedStage === stage.category
            const choose = () => onSelectStage(stage.category)
            const [iconX, iconY, iconSize] = shape.iconBox
            return (
              <g
                key={stage.category}
                className={cx(styles.stage, selected && styles.selected)}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={t('funnel.stage', { stage: label, count: stage.count })}
                data-funnel={stage.category}
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
                  {label}
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
