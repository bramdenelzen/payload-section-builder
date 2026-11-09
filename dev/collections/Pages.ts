import type { CollectionConfig } from 'payload'

import { allSections } from '../sections/blocks.js'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    livePreview: {
      url: ({ data }) => `${serverURL}/preview/${data?.slug ?? ''}`,
    },
    useAsTitle: 'title',
  },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'layout', type: 'blocks', blocks: allSections },
  ],
  versions: { drafts: true },
}
