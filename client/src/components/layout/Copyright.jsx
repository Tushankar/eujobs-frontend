import { useState } from 'react'
import { BRAND } from '@/app/brand.js'

/** M-197: "© {current year} EU Jobs". */
export default function Copyright() {
  const [year] = useState(() => new Date().getFullYear())
  return (
    <>
      © {year} {BRAND.name}
    </>
  )
}
