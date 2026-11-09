import { PageNotAvailable } from '../../components/PageNotAvailable.js'
import { RenderSections } from '../../components/RenderSections.js'
import { getPublishedPage, HOME_SLUG } from '../../lib/getPage.js'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const result = await getPublishedPage(HOME_SLUG)
  if (result.status !== 'found' || !result.page) {
    return <PageNotAvailable slug={HOME_SLUG} status={result.status === 'found' ? 'missing' : result.status} />
  }

  return (
    <main>
      <RenderSections sections={result.page.layout} />
    </main>
  )
}
