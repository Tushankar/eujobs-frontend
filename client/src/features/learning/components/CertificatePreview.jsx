import '@fontsource/cinzel/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/cormorant-garamond/600.css'
import QRCode from 'qrcode'
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import logoUrl from '@/assets/images/logo.svg'
import markUrl from '@/assets/images/logo-mark-white.svg'
import { frame, rosette } from '@/lib/guilloche.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './CertificatePreview.module.css'

/*
 * The certificate as issued ("Heritage", server/lib/pdf.js), drawn as one SVG on the PDF's 1123 × 794 grid so it scales
 * to any width: ivory paper, guilloché border, microprint, gold seal, the QR code of this check. The wording is in the
 * visitor's language; the holder's PDF is in theirs. The document stays ivory in the dark theme, like paper.
 */
const W = 1123
const H = 794
const CX = W / 2
const BOX = { x: 100, width: 923 }
const COLOURS = {
  paper: '#FDFBF5',
  navy: '#012B74',
  blue: '#0263DC',
  ink: '#0F1B33',
  body: '#3F4A5E',
  muted: '#5B6475',
  gold: '#B08D3A',
  goldDark: '#6E5214',
  goldText: '#45330A',
  goldLight: '#F3DD94',
  link: '#0247C1',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"
const DISPLAY = "Cinzel, Georgia, serif"
const SANS = 'Inter, system-ui, sans-serif'
const MICROPRINT = 'EU JOBS · CERTIFICATE OF COMPLETION · VERIFIED · '.repeat(70)
const GOLD = [
  [0, '#7D5E1A'],
  [0.22, '#D9B85C'],
  [0.42, '#F6E7A6'],
  [0.6, '#C49D3E'],
  [0.8, '#ECD58B'],
  [1, '#8A6A1F'],
]
const CORNERS = [
  [36, 36],
  [W - 36, 36],
  [W - 36, H - 36],
  [36, H - 36],
]

// The line art is the same on every certificate: drawn once.
let art
const lineArt = () =>
  (art ??= {
    watermark: rosette(CX, 380, 220, 16, 40, 4) + rosette(CX, 380, 150, 10, 28, 4) + rosette(CX, 380, 80, 7, 18, 3),
    band: frame(W, H, 36, 7, 42, 6),
    fine: frame(W, H, 36, 3, 14, 3),
    corners: CORNERS.map(([x, y]) => rosette(x, y, 9.5, 2.5, 8, 3)).join(''),
    sealEdge: rosette(75, 75, 67, 2.6, 44, 1),
    sealInner: rosette(75, 75, 30, 4, 12, 4),
  })

/** The QR code's dark modules as one path in a `size`-wide square. */
function qrPath(text, size) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const cell = size / modules.size
  let path = ''
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) path += `M${column * cell} ${row * cell}h${cell}v${cell}h${-cell}Z`
    }
  }
  return path
}

/** The font size from `max` down to `min` at which the text fits on one line BOX.width wide (as the PDF shrinks it). */
function useFit(text, max, min) {
  const ref = useRef(null)
  const [fit, setFit] = useState({ size: max, squeeze: false })
  useLayoutEffect(() => {
    let live = true
    const measure = () => {
      const node = ref.current
      if (!live || !node) return
      node.setAttribute('font-size', max)
      const length = node.getComputedTextLength()
      const size = Math.max(min, Math.min(max, Math.floor((max * BOX.width) / length)))
      setFit({ size, squeeze: (length * size) / max > BOX.width })
    }
    measure()
    document.fonts?.ready.then(measure)
    return () => {
      live = false
    }
  }, [text, max, min])
  const props = { ref, fontSize: fit.size, ...(fit.squeeze && { textLength: BOX.width, lengthAdjust: 'spacingAndGlyphs' }) }
  return props
}

/** The date or the issuer over a rule over its small label, centred on `cx`. */
function SignedLine({ cx, value, label }) {
  return (
    <g textAnchor="middle">
      <text x={cx} y={598} fontFamily={SERIF} fontSize={23} fontWeight={600} fill={COLOURS.ink}>
        {value}
      </text>
      <line x1={cx - 115} x2={cx + 115} y1={610} y2={610} stroke={COLOURS.ink} />
      <text x={cx} y={629} fontFamily={SANS} fontSize={10.5} fontWeight={600} letterSpacing={1.9} fill={COLOURS.muted}>
        {label.toUpperCase()}
      </text>
    </g>
  )
}

export default function CertificatePreview({ certificate, revoked = false }) {
  const { t } = useTranslation('certificates')
  const format = useFormat()
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { holderName, courseTitle, courseLevel, courseCategory, lessonCount, code } = certificate
  const verifyUrl = `${window.location.origin}/certificates/${code}`
  const lines = lineArt()
  const qr = useMemo(() => qrPath(verifyUrl, 50), [verifyUrl])
  const name = useFit(holderName, 76, 44)
  const course = useFit(courseTitle, 38, 22)
  const date = format.date(certificate.issuedAt, { dateStyle: 'long' })
  const details = [lessonCount && t('preview.lessons', { count: lessonCount }), t('preview.passed'), courseCategory].filter(Boolean)
  const column = (BOX.width - 48) / 6
  const goldStops = GOLD.map(([offset, colour]) => <stop key={offset} offset={offset} stopColor={colour} />)

  return (
    <div className={styles.preview}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{t('preview.label', { name: holderName, course: courseTitle, date })}</title>
        <defs>
          <linearGradient id={`${id}-rule`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2={H}>
            {[
              [0, '#9C7A2C'],
              [0.3, '#E2C574'],
              [0.55, '#A98431'],
              [0.8, '#E8CF82'],
              [1, '#9C7A2C'],
            ].map(([offset, colour]) => (
              <stop key={offset} offset={offset} stopColor={colour} />
            ))}
          </linearGradient>
          <linearGradient id={`${id}-seal`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="150" y2="150">
            {goldStops}
          </linearGradient>
          <path id={`${id}-micro`} d={`M64 64H${W - 64}V${H - 64}H64Z`} />
          <path id={`${id}-ring`} d="M75,75 m-53,0 a53,53 0 1,1 106,0 a53,53 0 1,1 -106,0" />
        </defs>

        {/* The paper, the watermark rosette and the border. */}
        <rect width={W} height={H} fill={COLOURS.paper} />
        <path d={lines.watermark} fill="none" stroke={COLOURS.navy} strokeOpacity={0.05} strokeWidth={0.7} />
        <rect x={22} y={22} width={W - 44} height={H - 44} fill="none" stroke={COLOURS.navy} strokeWidth={1.4} />
        <path d={lines.band} fill="none" stroke={COLOURS.navy} strokeOpacity={0.8} strokeWidth={0.55} />
        <path d={lines.fine} fill="none" stroke={COLOURS.blue} strokeOpacity={0.45} strokeWidth={0.4} />
        <rect x={50} y={50} width={W - 100} height={H - 100} fill="none" stroke={COLOURS.navy} strokeWidth={1.4} />
        <rect x={56} y={56} width={W - 112} height={H - 112} fill="none" stroke={`url(#${id}-rule)`} strokeWidth={1} />
        <text fontFamily={SANS} fontSize={4.2} fontWeight={600} letterSpacing={0.4} fill={COLOURS.navy} fillOpacity={0.55}>
          <textPath href={`#${id}-micro`}>{MICROPRINT}</textPath>
        </text>
        {CORNERS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={15} fill={COLOURS.paper} stroke={COLOURS.navy} />
        ))}
        <path d={lines.corners} fill="none" stroke={COLOURS.navy} strokeWidth={0.5} />

        {/* The logo, the title and its ornament. */}
        <image href={logoUrl} x={CX - 78} y={80} width={156} height={50} />
        <text x={CX} y={172} textAnchor="middle" fontFamily={DISPLAY} fontSize={24} fontWeight={600} letterSpacing={3.4} fill={COLOURS.navy}>
          {t('preview.title').toUpperCase()}
        </text>
        <g stroke={COLOURS.gold} fill="none">
          <path d={`M${CX - 112} 197H${CX - 22}M${CX + 22} 197H${CX + 112}`} />
          <path d={`M${CX - 13} 193l4 4-4 4-4-4ZM${CX + 13} 193l4 4-4 4-4-4Z`} />
          <path d={`M${CX} 191l6 6-6 6-6-6Z`} fill={COLOURS.gold} />
        </g>

        {/* Who, what and how. */}
        <g textAnchor="middle">
          <text x={CX} y={233} fontFamily={SERIF} fontSize={22} fontStyle="italic" fontWeight={500} fill={COLOURS.body}>
            {t('preview.intro')}
          </text>
          <text x={CX} y={307} fontFamily={SERIF} fontWeight={600} fill={COLOURS.ink} {...name}>
            {holderName}
          </text>
          <text x={CX} y={351} fontFamily={SERIF} fontSize={22} fontStyle="italic" fontWeight={500} fill={COLOURS.body}>
            {courseLevel ? t('preview.completedLevel', { level: t(`preview.level.${courseLevel}`) }) : t('preview.completed')}
          </text>
          <text x={CX} y={394} fontFamily={SERIF} fontWeight={600} fill={COLOURS.navy} {...course}>
            {courseTitle}
          </text>
          <text x={CX} y={424} fontFamily={SANS} fontSize={11.5} fontWeight={600} letterSpacing={2} fill={COLOURS.muted}>
            {details.join(' · ').toUpperCase()}
          </text>
        </g>

        {/* The date, the seal and the issuer. */}
        <SignedLine cx={BOX.x + column} value={date} label={t('preview.dateLabel')} />
        <g transform={`translate(${CX - 75} 466)`}>
          <polygon points="50,106 73,118 61,194 49,180 34,191" fill={COLOURS.navy} />
          <polygon points="100,106 77,118 89,194 101,180 116,191" fill={COLOURS.blue} />
          <path d={lines.sealEdge} fill={`url(#${id}-seal)`} stroke={COLOURS.goldDark} strokeWidth={0.6} />
          <circle cx={75} cy={75} r={61} fill="none" stroke={COLOURS.goldDark} strokeWidth={0.8} />
          <text fontFamily={DISPLAY} fontSize={7.4} fontWeight={600} fill={COLOURS.goldText}>
            <textPath href={`#${id}-ring`} textLength={326} lengthAdjust="spacing">
              EU JOBS · VERIFIED CERTIFICATE · AI POWERED CAREERS ·
            </textPath>
          </text>
          <circle cx={75} cy={75} r={45.5} fill="none" stroke={COLOURS.goldDark} strokeWidth={0.8} />
          <circle cx={75} cy={75} r={42} fill={COLOURS.navy} stroke={`url(#${id}-seal)`} strokeWidth={2.2} />
          <path d={lines.sealInner} fill="none" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={0.5} />
          <image href={markUrl} x={56} y={57} width={38} height={24} />
          <text x={75} y={104} textAnchor="middle" fontFamily={DISPLAY} fontSize={6.6} fontWeight={600} letterSpacing={1.6} fill={COLOURS.goldLight}>
            VERIFIED
          </text>
        </g>
        <SignedLine cx={BOX.x + BOX.width - column} value="EU Jobs" label={t('preview.issuerLabel')} />

        {/* The QR code, the code and the check link; the note on what a certificate means. */}
        <rect x={BOX.x} y={662} width={58} height={58} fill="#FFFFFF" stroke="#C9CFD9" strokeWidth={0.75} />
        <path d={qr} transform={`translate(${BOX.x + 4} 666)`} fill={COLOURS.ink} />
        <g fontFamily={SANS} fontSize={10.5}>
          <text x={BOX.x + 72} y={676} fill={COLOURS.muted}>
            {t('preview.code')}{' '}
            <tspan fontWeight={700} letterSpacing={0.5} fill={COLOURS.ink}>
              {code}
            </tspan>
          </text>
          <text x={BOX.x + 72} y={691} fill={COLOURS.muted}>
            {t('preview.verify')}
          </text>
          <text x={BOX.x + 72} y={706} fill={COLOURS.link}>
            {verifyUrl}
          </text>
        </g>
        <foreignObject x={BOX.x + BOX.width - 330} y={650} width={330} height={72}>
          <p className={styles.note}>{t('note')}</p>
        </foreignObject>
      </svg>
      {revoked && (
        <div className={styles.revoked}>
          <span>{t('status.revoked')}</span>
        </div>
      )}
    </div>
  )
}
