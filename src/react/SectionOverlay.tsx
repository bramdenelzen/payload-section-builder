'use client'

import { useEffect } from 'react'

import { initSectionOverlay } from '../overlay/index.js'

export type SectionOverlayProps = {
  /** Origin of the Payload admin, e.g. `process.env.NEXT_PUBLIC_SERVER_URL`. */
  adminOrigin: string
}

/** Mount once on preview pages. Renders nothing outside the Payload live preview. */
export const SectionOverlay = ({ adminOrigin }: SectionOverlayProps) => {
  useEffect(() => initSectionOverlay({ adminOrigin }), [adminOrigin])
  return null
}
