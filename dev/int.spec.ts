import type { Config, Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { BRIDGE_FIELD_NAME, findDataField, sectionBuilder } from '../src/index.js'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  await payload.destroy()
})

describe('section builder plugin', () => {
  test('adds the bridge UI field to configured collections', () => {
    const fields = payload.collections.pages.config.fields
    expect(fields.some((f) => 'name' in f && f.name === BRIDGE_FIELD_NAME)).toBe(true)
  })

  test('does not store anything for the bridge field', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { slug: `test-${Date.now()}`, title: 'Test' },
    })
    expect(page).not.toHaveProperty(BRIDGE_FIELD_NAME)
  })

  test('throws a clear error when the field is not a blocks field', () => {
    expect(() =>
      sectionBuilder({ collections: { pages: { field: 'title' } } })({
        collections: [{ slug: 'pages', fields: [{ name: 'title', type: 'text' }] }],
        secret: 'x',
      } as never),
    ).toThrow(/must be a top-level blocks field/)
  })
})

describe('blocks field lookup', () => {
  const blocks = { name: 'layout', blocks: [], type: 'blocks' as const }

  test('finds the field inside unnamed tabs, rows and collapsibles', () => {
    expect(findDataField([blocks], 'layout')).toBe(blocks)
    expect(
      findDataField(
        [
          {
            tabs: [
              { fields: [], label: 'SEO' },
              { fields: [blocks], label: 'Content' },
            ],
            type: 'tabs',
          },
        ],
        'layout',
      ),
    ).toBe(blocks)
    expect(findDataField([{ fields: [blocks], type: 'row' }], 'layout')).toBe(blocks)
    expect(findDataField([{ fields: [blocks], label: 'X', type: 'collapsible' }], 'layout')).toBe(
      blocks,
    )
  })

  test('ignores named tabs and groups, which change the data path', () => {
    expect(
      findDataField([{ tabs: [{ name: 'content', fields: [blocks] }], type: 'tabs' }], 'layout'),
    ).toBeUndefined()
    expect(
      findDataField([{ name: 'group', fields: [blocks], type: 'group' }], 'layout'),
    ).toBeUndefined()
  })

  test('works after plugin-seo has moved the fields into a Content tab', () => {
    const config = {
      collections: [
        {
          fields: [
            {
              tabs: [
                { fields: [blocks], label: 'Content' },
                { fields: [], label: 'SEO' },
              ],
              type: 'tabs',
            },
          ],
          slug: 'pages',
        },
      ],
    } as unknown as Config
    const result = sectionBuilder({ collections: { pages: { field: 'layout' } } })(config)
    const fields = result.collections![0]!.fields
    // The bridge sits at the top level, so it stays mounted on every tab.
    expect(fields.some((f) => 'name' in f && f.name === BRIDGE_FIELD_NAME)).toBe(true)
  })
})
