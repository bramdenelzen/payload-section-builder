import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Config,
  GlobalAfterChangeHook,
  GlobalConfig,
  PayloadRequest,
} from 'payload'

/**
 * Cache tags for content from Payload. Tag your cached reads with these, and the plugin
 * invalidates them when an editor publishes, unpublishes, deletes or renames a document.
 *
 * ```ts
 * unstable_cache(fn, key, { tags: [cacheTags.slug('pages', slug), cacheTags.collection('media')] })
 * ```
 */
export const cacheTags = {
  /** Anything in the collection changed. Use it for lists, menus and the sitemap. */
  collection: (collection: string) => tag(`payload:${collection}`),
  /** One document, by id. */
  doc: (collection: string, id: number | string) => tag(`payload:${collection}:id:${id}`),
  /** A global changed (header, footer, settings). */
  global: (global: string) => tag(`payload:global:${global}`),
  /**
   * The document that has (or had) this slug. Both the old and the new slug are invalidated
   * when a slug changes, so a cached 404 for a new URL and the page at an old URL both refresh.
   */
  slug: (collection: string, slug: string) => tag(`payload:${collection}:slug:${slug}`),
}

/** Next.js ignores tags longer than 256 characters, so very long slugs are shortened with a hash. */
const MAX_TAG_LENGTH = 256

const tag = (value: string): string => {
  if (value.length <= MAX_TAG_LENGTH) {
    return value
  }
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  }
  const suffix = `#${(hash >>> 0).toString(36)}`
  return value.slice(0, MAX_TAG_LENGTH - suffix.length) + suffix
}

export type RevalidateTag = (tag: string) => Promise<void> | void

export type CacheCollectionOptions = {
  /** Field with the URL slug; its old and new value are invalidated. Default `slug`. */
  slugField?: string
}

export type CacheOptions = {
  /**
   * Extra collections whose changes refresh cached content, e.g. `media` (images on pages) or
   * `redirects`. The section builder's own collections are always included.
   */
  collections?: Record<string, CacheCollectionOptions | true>
  /** Globals whose changes refresh cached content, e.g. a header or footer. */
  globals?: string[]
  /**
   * Invalidates one tag. Defaults to Next.js `revalidateTag(tag, { expire: 0 })`: the next
   * visitor gets the new version, never a stale one. Pass your own for another framework or
   * a shared cache.
   */
  revalidateTag?: RevalidateTag
}

type Doc = { _status?: unknown; id?: number | string } & Record<string, unknown>

/**
 * Default: Next.js. `expire: 0` instead of the `max` profile: with `max`, the first visitor
 * after a publish still gets the old page while the new one renders, and that visitor is
 * usually the editor checking their change.
 */
const nextRevalidateTag: RevalidateTag = async (value) => {
  const { revalidateTag } = await import('next/cache.js')
  revalidateTag(value, { expire: 0 })
}

/**
 * Invalidation must never break a save. It throws outside a Next.js request (the Payload CLI,
 * scripts, `onInit` during startup), where there is no cache to invalidate in this process.
 */
const invalidate = async (
  tags: Iterable<string>,
  revalidateTag: RevalidateTag,
  req: PayloadRequest,
): Promise<void> => {
  for (const value of new Set(tags)) {
    try {
      await revalidateTag(value)
    } catch (error) {
      req.payload.logger.debug({
        err: error,
        msg: `[section-builder] Could not revalidate cache tag "${value}" (no Next.js request context).`,
      })
    }
  }
}

/**
 * True when the change can affect what the public sees. Collections with drafts only matter
 * when the new or the previous state is published: publishing, unpublishing, or a change to a
 * published document. Saving a draft of a never-published document changes nothing public.
 */
const affectsPublic = (doc: Doc | undefined, previousDoc: Doc | undefined, hasDrafts: boolean) =>
  !hasDrafts || doc?._status === 'published' || previousDoc?._status === 'published'

const slugTags = (collection: string, slugField: string, docs: (Doc | undefined)[]) =>
  docs
    .map((doc) => doc?.[slugField])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => cacheTags.slug(collection, value))

const collectionTags = (collection: string, slugField: string, docs: (Doc | undefined)[]) => [
  cacheTags.collection(collection),
  ...docs.flatMap((doc) => (doc?.id === undefined ? [] : [cacheTags.doc(collection, doc.id)])),
  ...slugTags(collection, slugField, docs),
]

const hasDrafts = (config: CollectionConfig | GlobalConfig) =>
  Boolean(config.versions && typeof config.versions === 'object' && config.versions.drafts)

export const withCollectionRevalidation = (
  collection: CollectionConfig,
  options: CacheCollectionOptions,
  revalidateTag: RevalidateTag,
): CollectionConfig => {
  const slugField = options.slugField ?? 'slug'
  const drafts = hasDrafts(collection)

  const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
    if (affectsPublic(doc, previousDoc, drafts)) {
      await invalidate(collectionTags(collection.slug, slugField, [doc, previousDoc]), revalidateTag, req)
    }
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
    await invalidate(collectionTags(collection.slug, slugField, [doc]), revalidateTag, req)
    return doc
  }

  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: [...(collection.hooks?.afterChange ?? []), afterChange],
      afterDelete: [...(collection.hooks?.afterDelete ?? []), afterDelete],
    },
  }
}

export const withGlobalRevalidation = (
  global: GlobalConfig,
  revalidateTag: RevalidateTag,
): GlobalConfig => {
  const drafts = hasDrafts(global)

  const afterChange: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
    if (affectsPublic(doc, previousDoc, drafts)) {
      await invalidate([cacheTags.global(global.slug)], revalidateTag, req)
    }
    return doc
  }

  return {
    ...global,
    hooks: { ...global.hooks, afterChange: [...(global.hooks?.afterChange ?? []), afterChange] },
  }
}

/** Adds the revalidation hooks to the given collections and globals. */
export const applyRevalidation = (
  config: Config,
  collections: Record<string, CacheCollectionOptions>,
  options: CacheOptions,
): Config => {
  const revalidateTag = options.revalidateTag ?? nextRevalidateTag
  const all: Record<string, CacheCollectionOptions> = { ...collections }
  for (const [slug, value] of Object.entries(options.collections ?? {})) {
    all[slug] = { ...all[slug], ...(value === true ? {} : value) }
  }

  for (const slug of Object.keys(all)) {
    if (!config.collections?.some((c) => c.slug === slug)) {
      throw new Error(`[section-builder] cache: collection "${slug}" was not found in the Payload config.`)
    }
  }
  for (const slug of options.globals ?? []) {
    if (!config.globals?.some((g) => g.slug === slug)) {
      throw new Error(`[section-builder] cache: global "${slug}" was not found in the Payload config.`)
    }
  }

  return {
    ...config,
    collections: config.collections?.map((c) =>
      all[c.slug] ? withCollectionRevalidation(c, all[c.slug], revalidateTag) : c,
    ),
    globals: config.globals?.map((g) =>
      options.globals?.includes(g.slug) ? withGlobalRevalidation(g, revalidateTag) : g,
    ),
  }
}
