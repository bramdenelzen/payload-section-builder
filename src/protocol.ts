/**
 * Messages exchanged between the Payload admin (the "bridge") and the
 * live preview window (the "overlay"). Every message carries `source` and
 * `version` so older client installs keep working when the protocol changes.
 */
export const MESSAGE_SOURCE = 'payload-section-builder'
export const PROTOCOL_VERSION = 1

/** Data attributes the frontend puts on each rendered section. */
export const SECTION_INDEX_ATTR = 'data-section-index'
export const SECTION_TYPE_ATTR = 'data-section-type'

export type PreviewToAdminMessage =
  | { index: number; type: 'select-block' }
  | { from: number; to: number; type: 'move-block' }
  | { type: 'overlay-hello' }

export type AdminToPreviewMessage =
  | { blockCount: number; type: 'editor-ready' }
  | { index: null | number; type: 'selection-changed' }

export type Envelope<T> = { source: typeof MESSAGE_SOURCE; version: number } & T

export const wrap = <T extends object>(message: T): Envelope<T> => ({
  ...message,
  source: MESSAGE_SOURCE,
  version: PROTOCOL_VERSION,
})

export const isEnvelope = (data: unknown): data is Envelope<{ type: string }> =>
  typeof data === 'object' &&
  data !== null &&
  (data as { source?: unknown }).source === MESSAGE_SOURCE &&
  typeof (data as { type?: unknown }).type === 'string'

/**
 * Spread onto the root element of each rendered section:
 * `<section {...sectionAttributes(index, block.blockType)}>`
 */
export const sectionAttributes = (index: number, blockType: string) => ({
  [SECTION_INDEX_ATTR]: index,
  [SECTION_TYPE_ATTR]: blockType,
})
