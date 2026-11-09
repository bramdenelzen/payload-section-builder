import { redirect } from 'next/navigation.js'

import { PageNotAvailable } from '../../../components/PageNotAvailable.js'
import { RenderSections } from '../../../components/RenderSections.js'
import { getPublishedPage, HOME_SLUG } from '../../../lib/getPage.js'
import { toSlug } from '../../../lib/slug.js'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  const slug = toSlug(decodeURIComponent(rawSlug))

  // One URL per page: /home lives at /, and "/Contact%20Us" goes to "/contact-us"
  if (slug === HOME_SLUG) {
    redirect('/')
  }
  if (slug !== rawSlug) {
    redirect(`/${slug}`)
  }

  const result = await getPublishedPage(slug)
  if (result.status !== 'found' || !result.page) {
    return <PageNotAvailable slug={slug} status={result.status === 'found' ? 'missing' : result.status} />
  }

  return (
    <main>
      <RenderSections sections={result.page.layout} />
    </main>
  )
}
