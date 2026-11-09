import config from '@payload-config'
import { getPayload } from 'payload'

import { toSlug } from './slug.js'

/** The home page is the page with slug `home`, served at `/`. */
export const HOME_SLUG = 'home'

export type PageLookup =
  | { page: Awaited<ReturnType<typeof findBySlug>>; status: 'found' }
  | { status: 'missing' }
  | { status: 'unpublished' }

const findBySlug = async (slug: string, published: boolean) => {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'pages',
    depth: 1,
    draft: !published,
    limit: 1,
    where: published
      ? { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }
      : { slug: { equals: slug } },
  })
  return docs[0] ?? null
}

/**
 * Published pages only. Draft-only pages (saved with "Save Draft" but never
 * published) are visible in the live preview but not on the public site.
 */
export async function getPublishedPage(rawSlug: string): Promise<PageLookup> {
  const slug = toSlug(decodeURIComponent(rawSlug))
  const page = await findBySlug(slug, true)
  if (page) {
    return { page, status: 'found' }
  }
  const draft = await findBySlug(slug, false)
  return { status: draft ? 'unpublished' : 'missing' }
}
