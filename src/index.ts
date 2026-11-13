import type { CollectionSlug, Config, Field } from 'payload'

import { applyRevalidation, type CacheOptions } from './cache.js'

export type SectionBuilderCollectionOptions = {
  /** Name of the top-level blocks field that holds the sections, e.g. `layout`. */
  field: string
  /** Field with the URL slug, used for the cache tags. Default `slug`. */
  slugField?: string
}

export type SectionBuilderConfig = {
  /**
   * Cache invalidation. When a document of these collections is published, unpublished,
   * deleted or gets a new slug, its cache tags (see `cacheTags`) are revalidated, so cached
   * pages update right away. On by default; `false` turns it off.
   */
  cache?: CacheOptions | false
  /**
   * Collections that get the visual section builder, and which blocks field it drives.
   * Known slugs autocomplete; any string is accepted so the config still type-checks
   * before `payload generate:types` has picked up a newly added collection.
   */
  collections: Partial<Record<CollectionSlug, SectionBuilderCollectionOptions>> &
    Record<string, SectionBuilderCollectionOptions | undefined>
  /** Turns the editor and the cache invalidation off without changing the schema. */
  disabled?: boolean
  /**
   * Origin of the preview frontend, e.g. `https://www.client.com`. Messages are only
   * accepted from and sent to this origin. Defaults to the origin of the loaded preview URL.
   */
  previewOrigin?: string
}

export {
  type CacheCollectionOptions,
  type CacheOptions,
  cacheTags,
  type RevalidateTag,
} from './cache.js'
export { sectionAttributes } from './protocol.js'

export const BRIDGE_FIELD_NAME = '_sectionBuilderBridge'

/**
 * Finds a field whose data sits at the top level of the document: directly in `fields`, or
 * inside layout-only containers (unnamed tabs, rows, collapsibles). Other plugins, such as
 * plugin-seo with its tabbed UI, move existing fields into such a tab.
 */
export const findDataField = (fields: Field[], name: string): Field | undefined => {
  for (const field of fields) {
    if ('name' in field && field.name === name) {
      return field
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const found = 'name' in tab ? undefined : findDataField(tab.fields, name)
        if (found) {
          return found
        }
      }
    }
    if (field.type === 'row' || field.type === 'collapsible') {
      const found = findDataField(field.fields, name)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

export const sectionBuilder =
  (options: SectionBuilderConfig) =>
  (config: Config): Config => {
    if (options.disabled) {
      return config
    }

    for (const [slug, collectionOptions] of Object.entries(options.collections)) {
      if (!collectionOptions) {
        continue
      }

      const collection = config.collections?.find((c) => c.slug === slug)

      if (!collection) {
        throw new Error(
          `[section-builder] Collection "${slug}" was not found in the Payload config.`,
        )
      }

      const blocksField = findDataField(collection.fields, collectionOptions.field)

      if (!blocksField || blocksField.type !== 'blocks') {
        throw new Error(
          `[section-builder] "${slug}.${collectionOptions.field}" must be a top-level blocks field ` +
            '(it may sit in an unnamed tab, row or collapsible).',
        )
      }

      // A UI field stores nothing; it only mounts the bridge inside the document form,
      // where it can reach the form state and the live preview window.
      collection.fields.push({
        name: BRIDGE_FIELD_NAME,
        type: 'ui',
        admin: {
          components: {
            Field: {
              clientProps: {
                fieldPath: collectionOptions.field,
                previewOrigin: options.previewOrigin,
              },
              path: 'payload-section-builder/client#SectionBridge',
            },
          },
        },
      })
    }

    if (options.cache === false) {
      return config
    }

    const builderCollections = Object.fromEntries(
      Object.entries(options.collections).flatMap(([slug, value]) =>
        value ? [[slug, { slugField: value.slugField }]] : [],
      ),
    )
    return applyRevalidation(config, builderCollections, options.cache ?? {})
  }
