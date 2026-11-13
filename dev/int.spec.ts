import type { Config, Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { BRIDGE_FIELD_NAME, cacheTags, findDataField, sectionBuilder } from '../src/index.js'

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
  const blocks = { name: 'layout', type: 'blocks' as const, blocks: [] }

  test('finds the field inside unnamed tabs, rows and collapsibles', () => {
    expect(findDataField([blocks], 'layout')).toBe(blocks)
    expect(
      findDataField(
        [
          {
            type: 'tabs',
            tabs: [
              { fields: [], label: 'SEO' },
              { fields: [blocks], label: 'Content' },
            ],
          },
        ],
        'layout',
      ),
    ).toBe(blocks)
    expect(findDataField([{ type: 'row', fields: [blocks] }], 'layout')).toBe(blocks)
    expect(findDataField([{ type: 'collapsible', fields: [blocks], label: 'X' }], 'layout')).toBe(
      blocks,
    )
  })

  test('ignores named tabs and groups, which change the data path', () => {
    expect(
      findDataField([{ type: 'tabs', tabs: [{ name: 'content', fields: [blocks] }] }], 'layout'),
    ).toBeUndefined()
    expect(
      findDataField([{ name: 'group', type: 'group', fields: [blocks] }], 'layout'),
    ).toBeUndefined()
  })

  test('works after plugin-seo has moved the fields into a Content tab', () => {
    const config = {
      collections: [
        {
          slug: 'pages',
          fields: [
            {
              type: 'tabs',
              tabs: [
                { fields: [blocks], label: 'Content' },
                { fields: [], label: 'SEO' },
              ],
            },
          ],
        },
      ],
    } as unknown as Config
    const result = sectionBuilder({ collections: { pages: { field: 'layout' } } })(config)
    const fields = result.collections![0].fields
    // The bridge sits at the top level, so it stays mounted on every tab.
    expect(fields.some((f) => 'name' in f && f.name === BRIDGE_FIELD_NAME)).toBe(true)
  })
})

describe('cache revalidation', () => {
  const build = (
    revalidated: string[],
    cache: Parameters<typeof sectionBuilder>[0]['cache'] = {},
  ) => {
    const config = sectionBuilder({
      cache: cache === false ? false : { ...cache, revalidateTag: (tag) => void revalidated.push(tag) },
      collections: { pages: { field: 'layout' } },
    })({
      collections: [
        {
          slug: 'pages',
          fields: [
            { name: 'slug', type: 'text' },
            { name: 'layout', type: 'blocks', blocks: [] },
          ],
          versions: { drafts: true },
        },
        { slug: 'media', fields: [] },
      ],
      globals: [{ slug: 'header', fields: [] }],
      secret: 'x',
    } as unknown as Config)
    const collection = (slug: string) => config.collections!.find((c) => c.slug === slug)!
    return { collection, config }
  }

  const req = { payload: { logger: { debug: () => {} } } } as never

  const change = async (
    hooks: { afterChange?: unknown[] } | undefined,
    doc: Record<string, unknown>,
    previousDoc?: Record<string, unknown>,
  ) => {
    for (const hook of hooks?.afterChange ?? []) {
      await (hook as (args: unknown) => Promise<unknown>)({ doc, previousDoc, req })
    }
  }

  test('tags for collections, documents, slugs and globals', () => {
    expect(cacheTags.collection('pages')).toBe('payload:pages')
    expect(cacheTags.doc('pages', 4)).toBe('payload:pages:id:4')
    expect(cacheTags.slug('pages', 'contact')).toBe('payload:pages:slug:contact')
    expect(cacheTags.global('header')).toBe('payload:global:header')
  })

  test('keeps tags within the 256 character limit of Next.js, and distinct', () => {
    const a = cacheTags.slug('pages', 'a'.repeat(300))
    const b = cacheTags.slug('pages', `${'a'.repeat(299)}b`)
    expect(a.length).toBeLessThanOrEqual(256)
    expect(a).not.toBe(b)
  })

  test('publishing invalidates the collection, the document and its slug', async () => {
    const revalidated: string[] = []
    const { collection } = build(revalidated)
    await change(collection('pages').hooks, { id: 1, slug: 'about', _status: 'published' })
    expect(revalidated).toEqual(['payload:pages', 'payload:pages:id:1', 'payload:pages:slug:about'])
  })

  test('a slug change invalidates the old and the new slug', async () => {
    const revalidated: string[] = []
    const { collection } = build(revalidated)
    await change(
      collection('pages').hooks,
      { id: 1, slug: 'about-us', _status: 'published' },
      { id: 1, slug: 'about', _status: 'published' },
    )
    expect(revalidated).toContain('payload:pages:slug:about')
    expect(revalidated).toContain('payload:pages:slug:about-us')
  })

  test('unpublishing invalidates, saving a draft of an unpublished page does not', async () => {
    const revalidated: string[] = []
    const { collection } = build(revalidated)
    await change(collection('pages').hooks, { id: 2, slug: 'new', _status: 'draft' }, { id: 2, _status: 'draft' })
    expect(revalidated).toEqual([])
    await change(
      collection('pages').hooks,
      { id: 1, slug: 'about', _status: 'draft' },
      { id: 1, slug: 'about', _status: 'published' },
    )
    expect(revalidated).toContain('payload:pages:slug:about')
  })

  test('deleting invalidates the document and its slug', async () => {
    const revalidated: string[] = []
    const { collection } = build(revalidated)
    for (const hook of collection('pages').hooks?.afterDelete ?? []) {
      await (hook as (args: unknown) => Promise<unknown>)({ doc: { id: 3, slug: 'old' }, req })
    }
    expect(revalidated).toEqual(['payload:pages', 'payload:pages:id:3', 'payload:pages:slug:old'])
  })

  test('extra collections and globals are invalidated too', async () => {
    const revalidated: string[] = []
    const { collection, config } = build(revalidated, { collections: { media: true }, globals: ['header'] })
    await change(collection('media').hooks, { id: 9 })
    await change(config.globals![0].hooks, {})
    expect(revalidated).toEqual(['payload:media', 'payload:media:id:9', 'payload:global:header'])
  })

  test('cache: false adds no hooks, unknown collections throw', () => {
    expect(build([], false).collection('pages').hooks?.afterChange ?? []).toHaveLength(0)
    expect(() => build([], { collections: { products: true } })).toThrow(/"products" was not found/)
  })

  test('saving outside a Next.js request still works', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { slug: `cache-${Date.now()}`, _status: 'published', title: 'Cache' },
    })
    expect(page.id).toBeDefined()
  })
})
