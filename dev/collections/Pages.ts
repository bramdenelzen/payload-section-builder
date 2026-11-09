import type { CollectionConfig } from 'payload'

import { toSlug } from '../lib/slug.js'
import { allSections } from '../sections/blocks.js'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    livePreview: {
      url: ({ data }) => `${serverURL}/preview/${data?.id ?? ''}`,
    },
    useAsTitle: 'title',
  },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      admin: { description: 'The page URL. Leave empty to generate it from the title.' },
      hooks: {
        // Clients type "Contact Us" or "/about/"; store "contact-us" and "about".
        beforeValidate: [
          ({ data, value }) => toSlug(typeof value === 'string' && value ? value : (data?.title ?? '')),
        ],
      },
      index: true,
      // Not marked required: the hook above always fills it, and a required flag
      // would block saving an empty slug in the browser before the hook runs.
      unique: true,
    },
    { name: 'layout', type: 'blocks', blocks: allSections },
  ],
  versions: { drafts: true },
}
