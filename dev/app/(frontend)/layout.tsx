import type { ReactNode } from 'react'

import './styles.css'

export const metadata = { title: 'Section builder playground' }

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
