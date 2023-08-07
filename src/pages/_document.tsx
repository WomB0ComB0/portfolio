import React, { useEffect} from 'react';
import { Html, Head, Main, NextScript } from 'next/document';
const RootDocument = () => {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Mike Odnis' portfolio. Undergraduate, Computer Science student at Farmingdale State College."/>
        {/* eslint-disable-next-line @next/next/no-title-in-document-head */}
        <title>Mike Odnis</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="canonical" href="https://www.mikeodnis.com" />
        <meta name="theme-color" content="#560BAD" />
        <meta name="apple-mobile-web-app-status-bar" content="#560BAD" />
        <meta name="apple-mobile-web-app-title" content="Mike Odnis" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="google-site-verification" content="UEQaFuTqVDx84-mVcEXzo-y2PmglIrDzOPjcetwCnrM" />
        <meta name="google" content="translate"/>
        {/* Start of OG */}
        <meta property="og:image" content="../../public/PurpleBackground.png"/>
        <meta property="og:title" content="Mike Ondis | Portfolio"/>
        <meta property="og:description" content="Mike Odnis' portfolio. Undergraduate, Computer Science student at Farmingdale State College." />
        <meta property="og:url" content="https://www.mikeodnis.com"></meta>
        {/* Twitter */}
        <meta property="twitter:image" content="../../public/PurpleBackground.png"/>
        <meta property="twitter:card" content="summary_large_image"/>
        <meta property="twitter:title" content="Mike Odnis | Portfolio"/>
        <meta property="twitter:description" content="Mike Odnis' portfolio. Undergraduate, Computer Science student at Farmingdale State College."/>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};
export default RootDocument;