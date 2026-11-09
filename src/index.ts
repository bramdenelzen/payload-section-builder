import type { CollectionSlug, Config } from 'payload'

export type SectionBuilderCollectionOptions = {
  /** Name of the top-level blocks field that holds the sections, e.g. `layout`. */
  field: string
}

export type SectionBuilderConfig = {
  /** Collections that get the visual section builder, and which blocks field it drives. */
  collections: Partial<Record<CollectionSlug, SectionBuilderCollectionOptions>>
  /** Turns the editor off without changing the schema. */
  disabled?: boolean
  /**
   * Origin of the preview frontend, e.g. `https://www.client.com`. Messages are only
   * accepted from and sent to this origin. Defaults to the origin of the loaded preview URL.
   */
  previewOrigin?: string
}

export { sectionAttributes } from './protocol.js'

export const BRIDGE_FIELD_NAME = '_sectionBuilderBridge'

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
        throw new Error(`[section-builder] Collection "${slug}" was not found in the Payload config.`)
      }

      const blocksField = collection.fields.find(
        (field) => 'name' in field && field.name === collectionOptions.field,
      )

      if (!blocksField || blocksField.type !== 'blocks') {
        throw new Error(
          `[section-builder] "${slug}.${collectionOptions.field}" must be a top-level blocks field.`,
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

    return config
  }
