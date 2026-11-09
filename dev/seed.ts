import type { Payload } from 'payload'

import { devUser } from './helpers/credentials.js'

export const seed = async (payload: Payload) => {
  const { totalDocs: users } = await payload.count({
    collection: 'users',
    where: { email: { equals: devUser.email } },
  })

  if (!users) {
    await payload.create({ collection: 'users', data: devUser })
  }

  const { totalDocs: pages } = await payload.count({ collection: 'pages' })

  if (!pages) {
    await payload.create({
      collection: 'pages',
      data: {
        _status: 'published',
        layout: [
          {
            blockType: 'hero',
            buttonLabel: 'See our work',
            heading: 'Websites your team can edit',
            intro: 'Click any section in the preview to edit it in the sidebar.',
          },
          {
            blockType: 'text',
            body: 'Use the toolbar on a selected section to move it up or down.',
            heading: 'How it works',
          },
          {
            blockType: 'text',
            body: 'Every change goes through the normal Payload form, so drafts and validation keep working.',
            heading: 'Safe by default',
          },
          {
            blockType: 'cta',
            buttonHref: '#contact',
            buttonLabel: 'Get in touch',
            heading: 'Ready to start?',
          },
        ],
        slug: 'home',
        title: 'Home',
      },
    })
  }
}
