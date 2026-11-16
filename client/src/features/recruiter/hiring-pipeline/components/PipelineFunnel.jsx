import { useTranslation } from 'react-i18next'
import { bandPath, CATEGORY_ICONS, funnelFor, HEIGHT, RING_Y } from '@/features/admin/recruitment/funnelGeometry.js'
import { cx } from '@/utils/cx.js'
import styles from './PipelineFunnel.module.css'

/**
 * The Funnel view of the Hiring pipeline: the admin Figma funnel (owner decision 2026-11-05), one shape per company
 * stage with its category icon, the stage name, who is in it now, and how many ever reached it with the share kept
 * from the stage before. Each stage is a button (show who is in it) and a drop target (move a dragged candidate there).
 */
export default function PipelineFunnel({ stages, selectedId, onSelect, move }) {
  const { t } = useTranslation()
  const { width, shapes, bands, cap } = funnelFor(stages.length)
  // The share kept from the stage before, only once someone reached that stage.
  const keptAt = (index) => (stages[index - 1]?.reached ? Math.round((stages[index].reached / stages[index - 1].reached) * 100) : null)
  // What a stage does in either layout: show who is in it, and take a dragged candidate.
  const stageProps = (stage) => ({
    'aria-pressed': stage.id === selectedId,
    'aria-label': t('applications:funnel.stage', { stage: stage.name, now: stage.now, reached: stage.reached }),
    'data-funnel-stage': stage.name,
    'data-now': stage.now,
    'data-reached': stage.reached,
    onClick: () => onSelect(stage.id),
    onDragOver: (event) => move.over(event, stage.id),
    onDragLeave: move.leave,
    onDrop: (event) => move.drop(event, stage.id),
  })

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{t('applications:funnel.title')}</h3>
      <div className={styles.scroll}>
        <svg className={styles.chart} viewBox={`0 0 ${width} ${HEIGHT}`} style={{ minWidth: Math.round(width * 0.675) }} role="group" aria-label={t('applications:funnel.label')}>
          {bands.map((band) => (
            <path key={band[0]} d={bandPath(band)} fill={band[4]} />
          ))}
          <ellipse cx={cap.x + cap.w / 2} cy={cap.y + cap.h / 2} rx={cap.w / 2} ry={cap.h / 2} fill={cap.fill} />

          {stages.map((stage, index) => {
            const shape = shapes[index]
            const selected = stage.id === selectedId
            const dropping = move.dropStageId === stage.id
            const kept = keptAt(index)
            const [iconX, iconY, iconSize] = shape.iconBox
            const centerX = shape.x + shape.w / 2
            const centerY = shape.y + shape.h / 2
            return (
              <g
                key={stage.id}
                className={cx(styles.stage, selected && styles.selected, dropping && styles.dropping)}
                role="button"
                tabIndex={0}
                {...stageProps(stage)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(stage.id)
                  }
                }}
              >
                <rect x={shape.x} y={shape.y} width={shape.w} height={470 - shape.y} fill="transparent" />
                <line x1={shape.stemX} x2={shape.stemX} y1={shape.stemTop} y2={RING_Y - 5} className={styles.stem} />
                <circle cx={shape.stemX} cy={RING_Y} r={5} className={styles.ring} />
                <ellipse className={styles.ellipse} cx={centerX} cy={centerY} rx={shape.w / 2} ry={shape.h / 2} fill={shape.fill} />
                {(selected || dropping) && <ellipse className={styles.outline} cx={centerX} cy={centerY} rx={shape.w / 2 + 3} ry={shape.h / 2 + 3} />}
                <image href={CATEGORY_ICONS[stage.category]} x={iconX} y={iconY} width={iconSize} height={iconSize} />
                <text className={styles.label} x={shape.labelX} y={407} textAnchor="middle" dominantBaseline="central">
                  {stage.name}
                </text>
                <text className={styles.count} x={shape.labelX} y={428} textAnchor="middle" dominantBaseline="central">
                  {stage.now}
                </text>
                <text className={styles.reached} x={shape.labelX} y={448} textAnchor="middle" dominantBaseline="central">
                  {t('applications:funnel.reached', { count: stage.reached })}
                </text>
                {kept !== null && (
                  <text className={styles.reached} x={shape.labelX} y={464} textAnchor="middle" dominantBaseline="central">
                    {t('applications:funnel.kept', { percent: kept })}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Phones: the same funnel turned upright, one band per stage narrowing downward (owner 2026-11-16). */}
      <ol className={styles.upright} aria-label={t('applications:funnel.label')}>
        {stages.map((stage, index) => {
          const top = 100 - (55 * index) / stages.length
          const bottom = 100 - (55 * (index + 1)) / stages.length
          const kept = keptAt(index)
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={cx(styles.uprightStage, stage.id === selectedId && styles.selected, move.dropStageId === stage.id && styles.dropping)}
                {...stageProps(stage)}
              >
                <span className={styles.bandCell}>
                  <span className={styles.band} style={{ '--top': `${top}%`, '--inset': `${((top - bottom) / 2 / top) * 100}%`, '--fill': shapes[index].fill }}>
                    <img src={CATEGORY_ICONS[stage.category]} alt="" width={22} height={22} />
                  </span>
                </span>
                <span className={styles.uprightText}>
                  <span className={styles.uprightName}>{stage.name}</span>
                  <span className={styles.uprightCount}>{stage.now}</span>
                  <span className={styles.uprightReached}>
                    {[t('applications:funnel.reached', { count: stage.reached }), kept !== null && t('applications:funnel.kept', { percent: kept })].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
