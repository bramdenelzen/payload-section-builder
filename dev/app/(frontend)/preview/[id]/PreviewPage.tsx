'use client'

import { useLivePreview } from '@payloadcms/live-preview-react'
import { SectionOverlay } from 'payload-section-builder/react'

import type { Page } from '../../../../payload-types.js'

import { RenderSections } from '../../../../components/RenderSections.js'

export function PreviewPage({ initialData, serverURL }: { initialData: Page; serverURL: string }) {
  const { data } = useLivePreview<Page>({ depth: 1, initialData, serverURL })

  return (
    <main>
      <RenderSections sections={data.layout} />
      <SectionOverlay adminOrigin={serverURL} />
    </main>
  )
}
