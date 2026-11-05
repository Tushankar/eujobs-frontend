import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import styles from './PipelineFunnel.module.css'

/* The admin funnel's colours (FunnelChart), light to dark; more stages share them in order. */
const FILLS = ['#a7a5b2', '#8d8eaa', '#7384ae', '#48648f', '#3f5280', '#34486f']
const BAND = '#c9cbe2'
const COLUMN = 160
const HEIGHT = 220
const CENTER_Y = HEIGHT / 2

const fillOf = (index, count) => FILLS[count <= 1 ? 0 : Math.round((index * (FILLS.length - 1)) / (count - 1))]

/**
 * The Funnel view of the Hiring pipeline (owner decision 2026-11-05): one segment per company stage, sized by the
 * applications that ever reached it, with "now" and the share kept from the stage before. Each stage is a button
 * (show who is in it) and a drop target (move a dragged candidate there). Below 768px it turns into stacked bars.
 */
export default function PipelineFunnel({ stages, selectedId, onSelect, move }) {
  const { t } = useTranslation()
  const width = COLUMN * stages.length
  const max = Math.max(...stages.map((stage) => stage.reached), 1)
  const shapes = stages.map((stage, index) => {
    const height = 56 + 140 * (stage.reached / max)
    return { stage, x: COLUMN * index + COLUMN / 2, height, rx: Math.max(22, height * 0.3), fill: fillOf(index, stages.length) }
  })

  return (
    <div className={styles.scroll}>
      <div className={styles.funnel} style={{ '--stages': stages.length }}>
        <svg className={styles.drawing} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true" focusable="false">
          {shapes.slice(0, -1).map((from, index) => {
            const to = shapes[index + 1]
            return (
              <path
                key={from.stage.id}
                fill={BAND}
                d={`M${from.x} ${CENTER_Y - from.height / 2}L${to.x} ${CENTER_Y - to.height / 2}L${to.x} ${CENTER_Y + to.height / 2}L${from.x} ${CENTER_Y + from.height / 2}Z`}
              />
            )
          })}
          {shapes.map(({ stage, x, height, rx, fill }) => (
            <g key={stage.id}>
              <ellipse cx={x} cy={CENTER_Y} rx={rx} ry={height / 2} fill={fill} className={cx(styles.shape, move.dropStageId === stage.id && styles.dropShape)} />
              {stage.id === selectedId && <ellipse cx={x} cy={CENTER_Y} rx={rx + 5} ry={height / 2 + 5} className={styles.ring} />}
            </g>
          ))}
        </svg>

        <ol className={styles.stages} aria-label={t('applications:funnel.label')}>
          {stages.map((stage, index) => {
            const previous = stages[index - 1]
            const kept = previous ? Math.round((stage.reached / Math.max(previous.reached, 1)) * 100) : null
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  className={cx(styles.stage, stage.id === selectedId && styles.selected, move.dropStageId === stage.id && styles.drop)}
                  aria-pressed={stage.id === selectedId}
                  aria-label={t('applications:funnel.stage', { stage: stage.name, now: stage.now, reached: stage.reached })}
                  data-funnel-stage={stage.name}
                  data-now={stage.now}
                  data-reached={stage.reached}
                  onClick={() => onSelect(stage.id)}
                  onDragOver={(event) => move.over(event, stage.id)}
                  onDragLeave={move.leave}
                  onDrop={(event) => move.drop(event, stage.id)}
                >
                  <span className={styles.space} aria-hidden="true" />
                  <span className={styles.bar} aria-hidden="true">
                    <span style={{ width: `${(stage.reached / max) * 100}%`, background: shapes[index].fill }} />
                  </span>
                  <span className={styles.name}>{stage.name}</span>
                  <span className={styles.now}>
                    {stage.now} <small>{t('applications:funnel.now')}</small>
                  </span>
                  <span className={styles.reached}>
                    {t('applications:funnel.reached', { count: stage.reached })}
                    {kept !== null && ` · ${t('applications:funnel.kept', { percent: kept })}`}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
