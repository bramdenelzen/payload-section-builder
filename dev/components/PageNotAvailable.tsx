import { notFound } from 'next/navigation.js'

/**
 * In development, explain why a page that exists in Payload isn't shown.
 * In production this is a normal 404.
 */
export function PageNotAvailable({ slug, status }: { slug: string; status: 'missing' | 'unpublished' }) {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return (
    <main className="inner" style={{ padding: '72px 24px' }}>
      <h1>{status === 'unpublished' ? 'This page is not published yet' : 'Page not found'}</h1>
      <p>
        {status === 'unpublished'
          ? `A page with slug "${slug}" exists, but only as a draft. Click "Publish changes" in the admin to show it here. (Production returns a 404.)`
          : `No page has the slug "${slug}". Check the slug field in the admin. (Production returns a 404.)`}
      </p>
    </main>
  )
}
