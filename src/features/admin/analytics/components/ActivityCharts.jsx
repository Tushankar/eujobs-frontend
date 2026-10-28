import styles from './ActivityCharts.module.css'

const WIDTH = 502
const HEIGHT = 202
const BASELINE = 176
const PLOT_LEFT = 29
const PLOT_TOP = 8

/** Rounds `max` up to a tidy axis ceiling that splits into five equal steps (e.g. 21 -> 25, 104 -> 120). */
function niceCeiling(max) {
  const raw = Math.max(max, 1) / 5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw)
  return step * 5
}

function describe(labels, registrations, applications) {
  return labels
    .map((label, index) => `${label}: ${registrations[index]} registrations, ${applications[index]} applications`)
    .join('; ')
}

/** Bar-top path with 4px rounded top corners, growing up from the baseline. */
function barPath(x, width, height) {
  const radius = Math.min(4, height)
  const top = BASELINE - height
  return `M${x} ${BASELINE}V${top + radius}a${radius} ${radius} 0 0 1 ${radius} ${-radius}h${width - 2 * radius}a${radius} ${radius} 0 0 1 ${radius} ${radius}V${BASELINE}Z`
}

/** Paired bars (registrations in brand blue, applications in pale blue) per label. */
export function BarChart({ labels, registrations, applications }) {
  const max = Math.max(...registrations, ...applications, 1)
  const barWidth = 20
  const gap = 6
  const itemWidth = (WIDTH - 32 - 20 * (labels.length - 1)) / labels.length

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Bar chart. ${describe(labels, registrations, applications)}`}
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
                <title>{`${label}: ${registrations[index]} registrations`}</title>
              </path>
            )}
            {applicationHeight > 0 && (
              <path d={barPath(left + barWidth + gap, barWidth, applicationHeight)} className={styles.applications}>
                <title>{`${label}: ${applications[index]} applications`}</title>
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

/** Two area-and-line series on a dashed grid with a left value axis. */
export function LineChart({ labels, registrations, applications }) {
  const ceiling = niceCeiling(Math.max(...registrations, ...applications))
  const plotWidth = WIDTH - PLOT_LEFT
  const band = plotWidth / labels.length
  const plotHeight = BASELINE - PLOT_TOP
  const xAt = (index) => PLOT_LEFT + band * (index + 0.5)
  const yAt = (value) => PLOT_TOP + plotHeight * (1 - value / ceiling)
  const ticks = Array.from({ length: 6 }, (_, index) => (ceiling / 5) * index)

  function series(values, key, className, gradientId) {
    const points = values.map((value, index) => [xAt(index), yAt(value)])
    const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join('')
    const area = `${line}L${points[points.length - 1][0]} ${BASELINE}L${points[0][0]} ${BASELINE}Z`
    return (
      <g className={className} key={key}>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className={styles.line} />
        {points.map(([x, y], index) => (
          <g key={labels[index]}>
            <circle cx={x} cy={y} r="8" className={styles.ripple} />
            <circle cx={x} cy={y} r="4" className={styles.node}>
              <title>{`${labels[index]}: ${values[index]} ${key}`}</title>
            </circle>
          </g>
        ))}
      </g>
    )
  }

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Line chart. ${describe(labels, registrations, applications)}`}
    >
      <defs>
        <linearGradient id="activity-registrations" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0084ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0084ff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="activity-applications" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#eaf4ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#eaf4ff" stopOpacity="0.05" />
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
          y2={BASELINE}
          className={styles.grid}
        />
      ))}
      {series(applications, 'applications', styles.applicationsSeries, 'activity-applications')}
      {series(registrations, 'registrations', styles.registrationsSeries, 'activity-registrations')}
      {labels.map((label, index) => (
        <text key={label} x={xAt(index)} y={BASELINE + 22} textAnchor="middle" className={styles.axisLabel}>
          {label}
        </text>
      ))}
    </svg>
  )
}
