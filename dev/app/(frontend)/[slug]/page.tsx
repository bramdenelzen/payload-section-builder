import { notFound, redirect } from 'next/navigation.js'

import { RenderSections } from '../../../components/RenderSections.js'
import { getPublishedPage, HOME_SLUG } from '../../../lib/getPage.js'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // One URL per page: /home lives at /
  if (slug === HOME_SLUG) {
    redirect('/')
  }

  const page = await getPublishedPage(slug)
  if (!page) {
    notFound()
  }

  return (
    <main>
      <RenderSections sections={page.layout} />
    </main>
  )
}
