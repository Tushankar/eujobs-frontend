import { Upload } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './PdfButton.module.css'

/** A PDF picker drawn as a pill button (the file input covers it); `onFile(file)` gets the chosen file. */
export default function PdfButton({ label, onFile, busy, variant = 'outline' }) {
  function handleChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }
  return (
    <label className={`${styles.pdfButton} ${styles[variant]}`} aria-busy={busy || undefined}>
      <input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={handleChange} />
      <Icon as={Upload} size={14} />
      {label}
    </label>
  )
}
