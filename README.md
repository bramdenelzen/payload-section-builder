# payload-section-builder

Visual section builder for [Payload CMS](https://payloadcms.com). Editors click a section in the
live preview to edit it in the sidebar, and rearrange sections without leaving the preview.

> Status: phase 0 prototype. Selecting a section and moving it up or down work end to end.
> The section library, drag and drop and per-page-type rules follow in the next phases.

## How it works

```
Payload admin (edit view)                     Preview iframe (your frontend)
┌──────────────────────────┐   live data     ┌──────────────────────────────┐
│ Document form            │ ──────────────▶ │ Sections with data attributes│
│ SectionBridge (UI field) │ ◀────────────── │ Overlay: outlines, toolbar    │
└──────────────────────────┘   edit intents  └──────────────────────────────┘
```

- The **bridge** is mounted inside the document form as a UI field (it stores nothing). It applies
  intents from the preview to the form with Payload's own form API, so drafts, validation and
  autosave keep working.
- The **overlay** is framework-free. It only switches on inside the live preview after the admin
  answers a handshake, so production pages are never affected.
- Messages carry a `source` and protocol `version`, and both sides check the origin.

## Usage

```ts
// payload.config.ts
import { sectionBuilder } from 'payload-section-builder'

export default buildConfig({
  plugins: [
    sectionBuilder({
      collections: {
        pages: { field: 'layout' }, // a top-level blocks field
      },
    }),
  ],
})
```

```tsx
// Preview page (React)
import { sectionAttributes, SectionOverlay } from 'payload-section-builder/react'

{data.layout?.map((section, index) => (
  <section key={section.id} {...sectionAttributes(index, section.blockType)}>…</section>
))}
<SectionOverlay adminOrigin={process.env.NEXT_PUBLIC_SERVER_URL!} />
```

Not using React? Call `initSectionOverlay({ adminOrigin })` from `payload-section-builder/overlay`.

## Entry points

| Import | Contents |
| --- | --- |
| `payload-section-builder` | `sectionBuilder()` plugin, `sectionAttributes()` |
| `payload-section-builder/client` | `SectionBridge` admin component (referenced by the plugin) |
| `payload-section-builder/overlay` | Framework-free `initSectionOverlay()` |
| `payload-section-builder/react` | `<SectionOverlay />`, `sectionAttributes()` |

## Development

The `dev/` folder is a Payload + Next.js playground on SQLite (`dev/dev.db`, gitignored). It seeds a
user (`dev@payloadcms.com` / `test`) and a Home page with four sections.

Playground routes:

| Route | Shows |
| --- | --- |
| `/` | The published page with slug `home` (`/home` redirects here) |
| `/[slug]` | Any other published page. Draft-only pages return 404 until published. |
| `/preview/[id]` | Live preview, by document id, including unpublished drafts |

```bash
pnpm install
pnpm dev              # http://localhost:3000/admin, open Pages > Home > Live Preview
pnpm typecheck
pnpm test:int         # plugin config tests (vitest)
pnpm test:e2e         # select and move a section in the browser (Playwright)
pnpm build            # outputs dist/
```

## License

MIT
