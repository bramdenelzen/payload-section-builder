'use client'

import { useLivePreview } from '@payloadcms/live-preview-react'
import { sectionAttributes, SectionOverlay } from 'payload-section-builder/react'

import type { Page } from '../../../../payload-types.js'

type Section = NonNullable<Page['layout']>[number]

function RenderSection({ index, section }: { index: number; section: Section }) {
  const attrs = sectionAttributes(index, section.blockType)

  switch (section.blockType) {
    case 'cta':
      return (
        <section className="cta" {...attrs}>
          <div className="inner">
            <h2>{section.heading}</h2>
            <a className="button" href={section.buttonHref ?? '#'}>
              {section.buttonLabel}
            </a>
          </div>
        </section>
      )
    case 'hero':
      return (
        <section className="hero" {...attrs}>
          <div className="inner">
            <h1>{section.heading}</h1>
            {section.intro && <p>{section.intro}</p>}
            {section.buttonLabel && (
              <a className="button" href="#">
                {section.buttonLabel}
              </a>
            )}
          </div>
        </section>
      )
    case 'text':
      return (
        <section className="text" {...attrs}>
          <div className="inner">
            {section.heading && <h2>{section.heading}</h2>}
            <p>{section.body}</p>
          </div>
        </section>
      )
    default:
      return null
  }
}

export function PreviewPage({ initialData, serverURL }: { initialData: Page; serverURL: string }) {
  const { data } = useLivePreview<Page>({ depth: 1, initialData, serverURL })

  return (
    <main>
      {(data.layout ?? []).map((section, index) => (
        <RenderSection index={index} key={section.id ?? index} section={section} />
      ))}
      <SectionOverlay adminOrigin={serverURL} />
    </main>
  )
}
