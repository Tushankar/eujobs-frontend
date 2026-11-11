import { useTranslation } from 'react-i18next'
import { Skeleton, SkeletonRegion } from '@/components/ui'
import { niceCeiling } from '@/features/admin/overview/chartScale.js'
import styles from './ActivityCharts.module.css'

const WIDTH = 502
const HEIGHT = 202
const BASELINE = 176
/* The line view's plot is taller than the bars' (Figma: 189px vs 168px). */
const LINE_BASELINE = 197
const PLOT_LEFT = 29
const PLOT_TOP = 8

/** The chart in words, for screen readers. */
function useDescribe() {
  const { t } = useTranslation('adminOverview')
  return {
    t,
    points: (labels, registrations, applications) =>
      labels.map((label, index) => t('chart.point', { label, registrations: registrations[index], applications: applications[index] })).join('; '),
  }
}

/** Bar-top path with 4px rounded top corners, growing up from the baseline. */
function barPath(x, width, height) {
  const radius = Math.min(4, height)
  const top = BASELINE - height
  return `M${x} ${BASELINE}V${top + radius}a${radius} ${radius} 0 0 1 ${radius} ${-radius}h${width - 2 * radius}a${radius} ${radius} 0 0 1 ${radius} ${radius}V${BASELINE}Z`
}

/** Paired bars (registrations in brand blue, applications in pale blue) per label. */
export function BarChart({ labels, registrations, applications }) {
  const { t, points } = useDescribe()
  const max = Math.max(...registrations, ...applications, 1)
  const barWidth = 20
  const gap = 6
  const itemWidth = (WIDTH - 32 - 20 * (labels.length - 1)) / labels.length

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t('chart.barSummary', { items: points(labels, registrations, applications) })}
    >
      <line x1="0" x2={WIDTH} y1={BASELINE + 0.5} y2={BASELINE + 0.5} className={styles.baseline} />
      {labels.map((label, index) => {
        const center = 16 + itemWidth / 2 + (itemWidth + 20) * index
        const left = center - barWidth - gap / 2
        const registrationHeight = (registrations[index] / max) * 147
        const applicationHeight = (applications[index] / max) * 147
        return (
          <g key={label}>
            {registrationHeight > 0 && (
              <path d={barPath(left, barWidth, registrationHeight)} className={styles.registrations}>
                <title>{t('chart.registrationsAt', { label, count: registrations[index] })}</title>
              </path>
            )}
            {applicationHeight > 0 && (
              <path d={barPath(left + barWidth + gap, barWidth, applicationHeight)} className={styles.applications}>
                <title>{t('chart.applicationsAt', { label, count: applications[index] })}</title>
              </path>
            )}
            <text x={center} y={BASELINE + 22} textAnchor="middle" className={styles.barLabel}>
              {label}
            </text>
          </g>
        )
      })}
    </svg>
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

/** The bar chart's shape (same proportions as its SVG) while the counts load. */
export function ChartSkeleton() {
  return (
    <SkeletonRegion className={styles.skeleton}>
      <div className={styles.skeletonPlot}>
        {SKELETON_BARS.map(([registrations, applications], index) => (
          <div key={index} className={styles.skeletonColumn}>
            <Skeleton shape="block" width={20} height={`${registrations}%`} className={styles.skeletonBar} />
            <Skeleton shape="block" width={20} height={`${applications}%`} className={styles.skeletonBar} />
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

/** Two area-and-line series on a dashed grid with a left value axis. */
export function LineChart({ labels, registrations, applications }) {
  const { t, points } = useDescribe()
  const ceiling = niceCeiling(Math.max(...registrations, ...applications))
  const plotWidth = WIDTH - PLOT_LEFT
  const band = plotWidth / labels.length
  const plotHeight = LINE_BASELINE - PLOT_TOP
  const xAt = (index) => PLOT_LEFT + band * (index + 0.5)
  const yAt = (value) => PLOT_TOP + plotHeight * (1 - value / ceiling)
  const ticks = Array.from({ length: 6 }, (_, index) => (ceiling / 5) * index)

  function series(values, key, className, gradientId) {
    const points = values.map((value, index) => [xAt(index), yAt(value)])
    const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join('')
    const area = `${line}L${points[points.length - 1][0]} ${LINE_BASELINE}L${points[0][0]} ${LINE_BASELINE}Z`
    return (
      <g className={className} key={key}>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className={styles.line} />
        {points.map(([x, y], index) => (
          <g key={labels[index]}>
            <circle cx={x} cy={y} r="8" className={styles.ripple} />
            <circle cx={x} cy={y} r="4" className={styles.node}>
              <title>{t(`chart.${key}At`, { label: labels[index], count: values[index] })}</title>
            </circle>
          </g>
        ))}
      </g>
    )
  }

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${WIDTH} ${LINE_BASELINE + HEIGHT - BASELINE - 2}`}
      role="img"
      aria-label={t('chart.lineSummary', { items: points(labels, registrations, applications) })}
    >
      <defs>
        <linearGradient id="activity-registrations" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0263dc" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0263dc" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="activity-applications" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#eaf1fd" stopOpacity="0.3" />
          <stop offset="1" stopColor="#eaf1fd" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <g key={tick}>
          <text x={PLOT_LEFT - 5} y={yAt(tick) + 4} textAnchor="end" className={styles.axisLabel}>
            {tick}
          </text>
          <line
            x1={PLOT_LEFT + 1}
            x2={WIDTH - 1}
            y1={yAt(tick)}
            y2={yAt(tick)}
            className={tick === 0 ? styles.axisBaseline : styles.grid}
          />
        </g>
      ))}
      {Array.from({ length: labels.length + 1 }, (_, index) => (
        <line
          key={index}
          x1={PLOT_LEFT + 1 + ((plotWidth - 2) / labels.length) * index}
          x2={PLOT_LEFT + 1 + ((plotWidth - 2) / labels.length) * index}
          y1={PLOT_TOP}
          y2={LINE_BASELINE}
          className={styles.grid}
        />
      ))}
      {series(applications, 'applications', styles.applicationsSeries, 'activity-applications')}
      {series(registrations, 'registrations', styles.registrationsSeries, 'activity-registrations')}
      {labels.map((label, index) => (
        <text key={label} x={xAt(index)} y={LINE_BASELINE + 22} textAnchor="middle" className={styles.axisLabel}>
          {label}
        </text>
      ))}
    </svg>
  )
}
