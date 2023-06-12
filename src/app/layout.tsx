import './globals.css'
import React,{ useState, useEffect } from 'react'
import { Inter } from 'next/font/google'
import Head from 'next/head'
import {Loader, Header, Footer} from '@/components'
import {Analytics} from "@vercel/analytics/react"
const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Mike Odnis',
  description: 'Mike Odnis\' portfolio. Undergraduate, Computer Science student at Farmingdale State College.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    return () => clearTimeout(timeout)
  }, [])
  return (
    <html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="viewport" content="width=device-width, initial-sc ale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <body className={inter.className}>
      {isLoading ? (
        <Loader />) : (
        <>
          <Header />
          {children}
          <Footer />
          <Analytics />
        </>
      )}
      </body>
    </html>
  )
}