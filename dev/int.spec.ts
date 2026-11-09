import type { Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { BRIDGE_FIELD_NAME, sectionBuilder } from '../src/index.js'

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
