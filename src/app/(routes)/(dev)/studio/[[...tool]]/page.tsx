/**
 * This route is responsible for the built-in authoring environment using Sanity Studio.
 * All routes under your studio path is handled by this file using Next.js' catch-all routes:
 * https://nextjs.org/docs/routing/dynamic-routes#catch-all-routes
 *
 * You can learn more about the next-sanity package here:
 * https://github.com/sanity-io/next-sanity
 * 
 * SECURITY: This route is protected and only accessible in development mode.
 * In production, users will be redirected to the home page.
 */

import { NextStudio } from 'next-sanity/studio'
import { redirect } from 'next/navigation'
import config from '../../../../../../sanity.config'

export const dynamic = 'force-dynamic'

export { metadata, viewport } from 'next-sanity/studio'

export default function StudioPage() {
  // Block access to Studio in production
  if (process.env.NODE_ENV === 'production') {
    redirect('/')
  }

  return <NextStudio config={config} />
}
