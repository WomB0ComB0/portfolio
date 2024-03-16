import React from 'react'
import Script from 'next/script'

export const Scripts = () => {
  return (
    <>
      <Script
        defer
        src={`https://analytics.us.umami.is/script.js`} data-website-id="e7be89ea-5e5f-463b-97c3-95457c7cb00a"
      />
      <Script
        async
        src={`https://maps.googleapis.com/maps/api/js?key=${}&callback=console.debug&libraries=maps,marker&v=beta`}
      />
    </>
  )
}
