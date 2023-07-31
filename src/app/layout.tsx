"use client"
import './globals.css'
import './global.scss'
import React,{ useState, useEffect } from 'react'
import { Inter } from 'next/font/google'
import Head from 'next/head'
import {Loader, Footer, Header} from '@/components'
import {Analytics} from "@vercel/analytics/react"
const inter = Inter({ subsets: ['latin'] })
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
        <title>Mike Odnis</title>
        <meta name="description" content="Mike Odnis\' portfolio. Undergraduate, Computer Science student at Farmingdale State College." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#560BAD" />
        <meta name="apple-mobile-web-app-status-bar" content="#560BAD" />
        <meta name="apple-mobile-web-app-title" content="Mike Odnis" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Mike Odnis" />
        <meta name="msapplication-TileColor" content="#560BAD" />
        <meta name="msapplication-TileImage" content="/icons/ms-icon-144x144.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="google-site-verification" content="UEQaFuTqVDx84-mVcEXzo-y2PmglIrDzOPjcetwCnrM"/>
      </Head>
      <body className={inter.className}>
      {isLoading ? (
        <Loader />) : (
        <>
          {/* <Header /> */}
          {children}
          <Footer />
          <Analytics />
        </>
      )}
      </body>
    </html>
  )
}