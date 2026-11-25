import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton, SkeletonRegion } from '@/components/ui'
import { countScale } from '@/features/admin/overview/chartScale.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './ActivityCharts.module.css'

/* Drawn in real pixels at the box's size (2026-11-25), so the axis text stays 11px on a phone instead of shrinking
   with a scaled viewBox; the box is at least 220px tall and grows with its card. */
const TOP = 12
const BOTTOM = 28
const RIGHT = 4

function useSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) }))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

/** A bar from the baseline up to `top`, its data end rounded 4px. */
function barPath(x, width, top, baseline) {
  const radius = Math.min(4, (baseline - top) / 2, width / 2)
  return `M${x} ${baseline}V${top + radius}a${radius} ${radius} 0 0 1 ${radius} ${-radius}h${width - 2 * radius}a${radius} ${radius} 0 0 1 ${radius} ${radius}V${baseline}Z`
}

/**
 * Registrations and applications per day or week (M-170, M-171) as paired bars (`view` "bar") or lines, on one
 * whole-number axis. Hover or tap a day for both counts; the card's accessible label lists every value.
 */
export function ActivityChart({ view, labels, registrations, applications }) {
  const { t } = useTranslation('adminOverview')
  const format = useFormat()
  const [ref, { width, height }] = useSize()
  const [active, setActive] = useState(null)
  const empty = [...registrations, ...applications].every((value) => value === 0)
  const { ceiling, ticks: scaleTicks } = countScale(Math.max(...registrations, ...applications))
  // An empty period draws only the baseline, under its message.
  const ticks = empty ? [0] : scaleTicks
  const left = Math.max(...ticks.map((tick) => format.number(tick).length)) * 7 + 12
  const baseline = height - BOTTOM
  const band = Math.max(width - left - RIGHT, 0) / labels.length
  const xAt = (index) => left + band * (index + 0.5)
  const yAt = (value) => baseline - (value / ceiling) * (baseline - TOP)
  const barWidth = Math.min(20, Math.max(4, (band * 0.6 - 2) / 2))
  const series = [
    { key: 'registrations', values: registrations, className: styles.registrations },
    { key: 'applications', values: applications, className: styles.applications },
  ]
  const pick = (event) => {
    const index = Math.floor((event.clientX - event.currentTarget.getBoundingClientRect().left - left) / band)
    setActive(index >= 0 && index < labels.length ? index : null)
  }

  return (
    <div ref={ref} className={styles.root}>
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} aria-hidden="true" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)}>
          {active !== null &&
            (view === 'line' ? (
              <line x1={xAt(active)} x2={xAt(active)} y1={TOP} y2={baseline} className={styles.crosshair} />
            ) : (
              <rect x={left + band * active + 2} y={TOP} width={band - 4} height={baseline - TOP} rx="6" className={styles.hoverBand} />
            ))}
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - RIGHT} y1={yAt(tick)} y2={yAt(tick)} className={tick === 0 ? styles.axis : styles.grid} />
              <text x={left - 8} y={yAt(tick)} dy="0.32em" textAnchor="end" className={styles.tick}>
                {format.number(tick)}
              </text>
            </g>
          ))}
          {view === 'line'
            ? [...series].reverse().map(({ key, values, className }) => {
                const points = values.map((value, index) => `${xAt(index)},${yAt(value)}`)
                return (
                  <g key={key} className={className}>
                    <path d={`M${xAt(0)},${baseline}L${points.join('L')}L${xAt(values.length - 1)},${baseline}Z`} className={styles.area} />
                    <polyline points={points.join(' ')} className={styles.line} />
                    {values.map((value, index) => (
                      <circle key={index} cx={xAt(index)} cy={yAt(value)} r={index === active ? 5 : 4} className={styles.dot} />
                    ))}
                  </g>
                )
              })
            : labels.map((label, index) =>
                series.map(({ key, values, className }, order) =>
                  values[index] > 0 ? (
                    <path key={`${label}-${key}`} d={barPath(xAt(index) - barWidth - 1 + order * (barWidth + 2), barWidth, yAt(values[index]), baseline)} className={cx(styles.bar, className)} />
                  ) : null,
                ),
              )}
          {labels.map((label, index) => (
            <text key={label} x={xAt(index)} y={baseline + 18} textAnchor="middle" className={cx(styles.tick, index === active && styles.tickActive)}>
              {label}
            </text>
          ))}
        </svg>
      )}
      {empty && width > 0 && (
        <p className={styles.empty} style={{ left, bottom: BOTTOM }}>
          {t('chart.empty')}
        </p>
      )}
      {active !== null && width > 0 && (
        <div className={styles.tooltip} style={{ left: Math.min(Math.max(xAt(active), 76), width - 76) }} aria-hidden="true">
          <p className={styles.tooltipLabel}>{labels[active]}</p>
          {series.map(({ key, values, className }) => (
            <p key={key} className={cx(styles.tooltipRow, className)}>
              <span className={styles.key} />
              <strong>{format.number(values[active])}</strong>
              {t(`chart.${key}`)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/* Bar heights (% of the plot) of the placeholder week: registrations, applications. */
const SKELETON_BARS = [
  [46, 30],
  [62, 40],
  [38, 24],
  [74, 52],
  [54, 36],
  [30, 18],
  [44, 28],
]

/** The bar chart's shape (same height as the chart) while the counts load. */
export function ChartSkeleton() {
  return (
    <SkeletonRegion className={styles.skeleton}>
      <div className={styles.skeletonPlot}>
        {SKELETON_BARS.map(([registrations, applications], index) => (
          <div key={index} className={styles.skeletonColumn}>
            <Skeleton shape="block" width={14} height={`${registrations}%`} className={styles.skeletonBar} />
            <Skeleton shape="block" width={14} height={`${applications}%`} className={styles.skeletonBar} />
          </div>
        ))}
      </div>
      <div className={styles.skeletonLabels}>
        {SKELETON_BARS.map((_, index) => (
          <span key={index}>
            <Skeleton width={24} height={8} />
          </span>
        ))}
      </div>
    </SkeletonRegion>
  )
}
