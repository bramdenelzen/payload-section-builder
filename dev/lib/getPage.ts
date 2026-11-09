import config from '@payload-config'
import { getPayload } from 'payload'

/** The home page is the page with slug `home`, served at `/`. */
export const HOME_SLUG = 'home'

/**
 * Published pages only. Draft-only pages (saved with "Save Draft" but never
 * published) are visible in the live preview but 404 on the public site.
 */
export async function getPublishedPage(slug: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'pages',
    depth: 1,
    limit: 1,
    where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
  })
  return docs[0] ?? null
}
