import { notFound } from 'next/navigation.js'

import { RenderSections } from '../../components/RenderSections.js'
import { getPublishedPage, HOME_SLUG } from '../../lib/getPage.js'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const page = await getPublishedPage(HOME_SLUG)
  if (!page) {
    notFound()
  }

  return (
    <main>
      <RenderSections sections={page.layout} />
    </main>
  )
}
