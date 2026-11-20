import { Upload } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './PdfButton.module.css'

/** A PDF picker drawn as a button (the input covers it). */
export default function PdfButton({ label, onFile, busy, variant = 'outline' }) {
  return (
    <label className={`${styles.pdfButton} ${styles[variant]}`} aria-busy={busy || undefined}>
      <input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) onFile(file)
      }} />
      <Icon as={Upload} size={14} />
      {label}
    </label>
  )
}
