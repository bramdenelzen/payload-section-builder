import config from '@payload-config'
import { headers } from 'next/headers.js'
import { notFound } from 'next/navigation.js'
import { getPayload } from 'payload'

import { PreviewPage } from './PreviewPage.js'

export const dynamic = 'force-dynamic'

/**
 * Live preview loads pages by document id, not slug: the slug can be empty or
 * changed-but-unsaved while editing, which would otherwise 404 the preview.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })

  // Drafts are private: only show the preview to someone logged in to the admin.
  // The admin and the site share an origin here, so the Payload auth cookie is sent along.
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) {
    notFound()
  }

  const page = await payload
    .findByID({ id, collection: 'pages', depth: 1, disableErrors: true, draft: true })
    .catch(() => null)

  if (!page) {
    notFound()
  }

  return (
    <PreviewPage
      initialData={page}
      serverURL={process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}
    />
  )
}
