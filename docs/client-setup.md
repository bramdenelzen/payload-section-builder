# Using payload-section-builder in a client project

This guide adds the visual section builder to an existing Payload 3 + Next.js project. When
you're done, editors can open a page, switch on Live Preview, click a section to edit it in the
sidebar, and move sections up or down from the preview.

**Division of work**

| You (the client project) | The plugin |
| --- | --- |
| Define sections as Payload blocks | Connects the live preview to the admin form |
| Build and style the section components | Draws the editor chrome (outlines, toolbar) inside the preview |
| Render pages and the preview route | Applies preview actions (select, move) to the form |

The plugin ships no sections and no site CSS.

---

## 1. Requirements

- Payload `^3.93` with `@payloadcms/ui` and `@payloadcms/next`
- Next.js App Router with React 19
- `@payloadcms/live-preview-react`, for live data in the preview

## 2. Install

```bash
pnpm add payload-section-builder @payloadcms/live-preview-react
```

## 3. Define your sections

A section is a normal Payload [block](https://payloadcms.com/docs/fields/blocks) plus a React
component. A layout that scales well is one folder per section:

```
src/sections/
  hero/
    config.ts       # the Payload block
    Component.tsx   # how it looks
  text/
    config.ts
    Component.tsx
  index.ts          # registry: slug -> block + component
```

```ts
// src/sections/hero/config.ts
import type { Block } from 'payload'

export const heroBlock: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock', // generates a `HeroBlock` type in payload-types.ts
  labels: { singular: 'Hero', plural: 'Heroes' },
  imageURL: '/sections/hero.png', // optional thumbnail in Payload's block picker
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'intro', type: 'textarea' },
  ],
}
```

```tsx
// src/sections/hero/Component.tsx
import type { HeroBlock } from '@/payload-types'

export function Hero({ heading, intro }: HeroBlock) {
  return (
    <div className="hero">
      <h1>{heading}</h1>
      {intro && <p>{intro}</p>}
    </div>
  )
}
```

```tsx
// src/sections/index.ts
import { heroBlock } from './hero/config'
import { Hero } from './hero/Component'
import { textBlock } from './text/config'
import { Text } from './text/Component'

export const sectionBlocks = [heroBlock, textBlock]

export const sectionComponents = {
  hero: Hero,
  text: Text,
} as const
```

Style the components however the project is styled (CSS modules, Tailwind and so on). The plugin
never touches them.

## 4. Add a collection with a sections field

The builder works on any collection with a **top-level blocks field**. A typical `pages` collection:

```ts
// src/collections/Pages.ts
import type { CollectionConfig } from 'payload'
import { sectionBlocks } from '../sections'

const siteURL = process.env.NEXT_PUBLIC_SERVER_URL!

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    // Load the preview by id: the slug can be empty or unsaved while editing.
    livePreview: { url: ({ data }) => `${siteURL}/preview/${data?.id ?? ''}` },
  },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'layout', type: 'blocks', blocks: sectionBlocks },
  ],
}
```

To use the builder on more collections later, such as `posts`, give them their own blocks field and
add them to the plugin config in the next step.

## 5. Register the plugin

```ts
// src/payload.config.ts
import { sectionBuilder } from 'payload-section-builder'

export default buildConfig({
  collections: [Pages /* , ... */],
  plugins: [
    sectionBuilder({
      collections: {
        pages: { field: 'layout' },
        // posts: { field: 'content' },
      },
      // previewOrigin: 'https://www.client.com', // only if the site and admin are on different origins
    }),
  ],
})
```

Then regenerate the import map. **This step is required:** the plugin adds an admin component, and
Payload only loads admin components that are listed in the import map.

```bash
pnpm payload generate:importmap
pnpm payload generate:types
```

## 6. Render sections with the marker attributes

Every section's root element gets `sectionAttributes(index, blockType)`. It adds
`data-section-index` and `data-section-type`, which the overlay uses to find sections. It adds
no styles.

```tsx
// src/components/RenderSections.tsx
import { sectionAttributes } from 'payload-section-builder/react'
import { sectionComponents } from '@/sections'
import type { Page } from '@/payload-types'

export function RenderSections({ sections }: { sections: Page['layout'] }) {
  return (
    <>
      {sections?.map((section, index) => {
        const Component = sectionComponents[section.blockType]
        if (!Component) return null
        return (
          <section key={section.id ?? index} {...sectionAttributes(index, section.blockType)}>
            <Component {...(section as any)} />
          </section>
        )
      })}
    </>
  )
}
```

Use the same component on public pages and in the preview, so the preview matches the live site
exactly.

## 7. Add the preview route

The preview is a normal page of your site that loads a draft by id, receives live data while the
editor types, and mounts the overlay.

```tsx
// src/app/(frontend)/preview/[id]/page.tsx
import config from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { PreviewPage } from './PreviewPage'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })

  // Drafts are private: only show them to someone logged in to the admin.
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) notFound()

  const page = await payload
    .findByID({ collection: 'pages', id, draft: true, depth: 1, disableErrors: true })
    .catch(() => null)
  if (!page) notFound()

  return <PreviewPage initialData={page} serverURL={process.env.NEXT_PUBLIC_SERVER_URL!} />
}
```

```tsx
// src/app/(frontend)/preview/[id]/PreviewPage.tsx
'use client'

import { useLivePreview } from '@payloadcms/live-preview-react'
import { SectionOverlay } from 'payload-section-builder/react'
import { RenderSections } from '@/components/RenderSections'
import type { Page } from '@/payload-types'

export function PreviewPage({ initialData, serverURL }: { initialData: Page; serverURL: string }) {
  const { data } = useLivePreview<Page>({ initialData, serverURL, depth: 1 })
  return (
    <main>
      <RenderSections sections={data.layout} />
      <SectionOverlay adminOrigin={serverURL} />
    </main>
  )
}
```

`SectionOverlay` renders nothing on its own. It only activates when the page is inside the Payload
live preview **and** the admin answers its handshake, so it's safe on any page.

## 8. Add public routes

Public pages show **published** content only.

```tsx
// src/app/(frontend)/[slug]/page.tsx
const { docs } = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
  limit: 1,
})
if (!docs[0]) notFound()
return <RenderSections sections={docs[0].layout} />
```

Serve the home page at `/` from `src/app/(frontend)/page.tsx` with the slug `home`. The playground
in this repo (`dev/app/(frontend)`) has a complete version, including slug clean-up and a
development-only message for draft pages.

## 9. Environment variables

| Variable | Example | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | `https://www.client.com` | Live preview URL, `useLivePreview`, overlay `adminOrigin` |

If the admin and the site run on **different origins** (for example `cms.client.com` and
`www.client.com`):
- set `previewOrigin` in the plugin config to the site origin
- pass the admin origin as `adminOrigin` to `<SectionOverlay />`
- protect the preview route with a token instead of the auth cookie, because cookies don't cross origins

## 10. Style the editor chrome (optional)

The hover outline, selection outline, label and toolbar use CSS variables. Override them anywhere
in your site CSS:

```css
:root {
  --psb-accent: #0f766e;            /* outlines and label */
  --psb-accent-soft: rgba(15, 118, 110, .2);
  --psb-on-accent: #fff;
  --psb-toolbar-bg: #111;
  --psb-toolbar-fg: #fff;
  --psb-focus: #5eead4;
  --psb-font: 500 13px/1 'Inter', sans-serif;
  --psb-z: 2147483000;              /* stacking order */
}
```

You can also skip the default styles completely and style `.psb-box`, `.psb-hover`,
`.psb-selected`, `.psb-label` and `.psb-toolbar` yourself:

```tsx
<SectionOverlay adminOrigin={serverURL} injectStyles={false} />
```

## 11. Restrict sections per page type (optional)

Payload's blocks field has `filterOptions` built in. It hides disallowed blocks in the admin and
rejects them on save, so the plugin doesn't need to do anything for this:

```ts
{ name: 'pageType', type: 'select', options: ['home', 'default'], defaultValue: 'default' },
{
  name: 'layout',
  type: 'blocks',
  blocks: sectionBlocks,
  filterOptions: ({ siblingData }) =>
    siblingData?.pageType === 'home' ? true : ['text', 'cta'], // e.g. hero only on home
},
```

## 12. Frontends that don't use React

Use the framework-free overlay and add the data attributes yourself:

```ts
import { initSectionOverlay, sectionAttributes } from 'payload-section-builder/overlay'

const stop = initSectionOverlay({ adminOrigin: 'https://cms.client.com' })
// <section data-section-index="0" data-section-type="hero">…</section>
```

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| No **Live Preview** button | Payload only shows it after a document has been saved once. Click **Save Draft** first. |
| Preview works, but no outlines or toolbar | The import map wasn't regenerated (`pnpm payload generate:importmap`), or `adminOrigin` doesn't exactly match the admin's origin, including the protocol and port. |
| Clicking a section does nothing in the sidebar | The root element is missing `sectionAttributes`, or the plugin's `field` doesn't match the blocks field name. |
| Error at startup: "must be a top-level blocks field" | The `field` in the plugin config points to a field that isn't a blocks field, or that's nested inside a group or tab. |
| Public page returns 404, but the preview works | The page is draft-only. Click **Publish changes**. |
| Preview returns 404 | You're not logged in to the admin in this browser, or the id doesn't exist. |
| A `_section Builder Bridge` column appears in the list view | Known issue: the plugin's internal field shows up as a list column. It stores no data and is safe to hide from the column picker. A fix is planned. |

## API reference

### `sectionBuilder(options)` from `payload-section-builder`

| Option | Type | Description |
| --- | --- | --- |
| `collections` | `{ [slug]: { field: string } }` | Collections that get the builder, and the name of their top-level blocks field |
| `previewOrigin` | `string?` | Origin of the preview site. Defaults to the origin of the loaded preview URL. |
| `disabled` | `boolean?` | Turns the builder off without changing the schema |

### `<SectionOverlay />` from `payload-section-builder/react`

| Prop | Type | Description |
| --- | --- | --- |
| `adminOrigin` | `string` | Origin of the Payload admin. Messages from any other origin are ignored. |
| `injectStyles` | `boolean?` | Inject the default chrome styles. Default: `true`. |

### `sectionAttributes(index, blockType)`

Returns `{ 'data-section-index': index, 'data-section-type': blockType }`. Exported from all
entry points.

### `initSectionOverlay(options)` from `payload-section-builder/overlay`

The same options as `<SectionOverlay />`. Returns a cleanup function.
