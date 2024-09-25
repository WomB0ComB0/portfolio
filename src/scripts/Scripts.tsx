import Script from 'next/script';
import React from 'react';

export const Scripts = () => {
  return (
    <>
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-CS1B01WMJR"
      />
      <Script
        strategy="afterInteractive"
        id="google-analytics"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CS1B01WMJR');
          `,
        }}
      />
      <Script
        async
        src={`https://maps.googleapis.com/maps/api/js?key=${
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        }&callback=console.debug&libraries=maps,marker&v=beta`}
      />
    </>
  );
};
