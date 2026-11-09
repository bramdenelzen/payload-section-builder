'use client'

import { useEffect } from 'react'

import { initSectionOverlay } from '../overlay/index.js'

export type SectionOverlayProps = {
  /** Origin of the Payload admin, e.g. `process.env.NEXT_PUBLIC_SERVER_URL`. */
  adminOrigin: string
  /** Inject the default editor chrome styles. Default: `true`. */
  injectStyles?: boolean
}

/** Mount once on preview pages. Renders nothing outside the Payload live preview. */
export const SectionOverlay = ({ adminOrigin, injectStyles }: SectionOverlayProps) => {
  useEffect(() => initSectionOverlay({ adminOrigin, injectStyles }), [adminOrigin, injectStyles])
  return null
}
