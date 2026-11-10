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

**Full guide for client projects: [docs/client-setup.md](docs/client-setup.md)** (install, your own sections, preview route, styling, troubleshooting).


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

## Your sections, your styling

The plugin ships **no sections and no site styles**. Each client project owns both:

- **Sections** are ordinary Payload blocks in your own config. Use any fields you like.
- **Rendering** is your own components with your own CSS, Tailwind or anything else.
- **The only contract** is one spread on each section's root element: `{...sectionAttributes(index, block.blockType)}`.
  This adds two `data-` attributes and changes nothing visually.

The plugin only handles the editing bridge between the preview and the admin. The one thing it draws is
the editor chrome (hover outline, selection outline, label and toolbar), and only inside the live preview.
To match your brand, override its CSS variables:

```css
:root {
  --psb-accent: #0f766e;
  --psb-accent-soft: rgba(15, 118, 110, .2);
  --psb-toolbar-bg: #111;
  --psb-font: 500 13px/1 'Inter', sans-serif;
}
```

You can also turn the default chrome styles off and style the `.psb-box`, `.psb-hover`, `.psb-selected`,
`.psb-label` and `.psb-toolbar` classes yourself: `<SectionOverlay adminOrigin={url} injectStyles={false} />`.

The sections in `dev/` exist only to exercise the plugin in the playground. They are not published.

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
| `/[slug]` | Any other published page. Draft-only pages return 404 in production; in development they show a "not published yet" message. |
| `/preview/[id]` | Live preview, by document id, including unpublished drafts. Payload only shows the Live Preview button after a page has been saved once. |

```bash
pnpm install
pnpm dev              # http://localhost:3000/admin, open Pages > Home > Live Preview
pnpm typecheck
pnpm test:int         # plugin config tests (vitest)
pnpm test:e2e         # select and move a section in the browser (Playwright)
pnpm build            # outputs dist/
```

## Publishing

```bash
npm version patch     # or minor; commit and tag
npm publish           # the prepare script builds dist first
```

`exports` already point at `dist`, so `npm publish` and `pnpm publish` produce the same package.
Check what will ship with `npm pack --dry-run`: every entry point needs a `.js` and a `.d.ts` file
in `dist/`.

## License

MIT
