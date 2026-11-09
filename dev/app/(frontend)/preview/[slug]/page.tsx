import config from '@payload-config'
import { notFound } from 'next/navigation.js'
import { getPayload } from 'payload'

import { PreviewPage } from './PreviewPage.js'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'pages',
    draft: true,
    limit: 1,
    where: { slug: { equals: slug } },
  })

  if (!docs[0]) {
    notFound()
  }

  return (
    <PreviewPage
      initialData={docs[0]}
      serverURL={process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}
    />
  )
}
