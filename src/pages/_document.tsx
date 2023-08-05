import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';
const RootDocument = () => {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Mike Odnis' portfolio. Undergraduate, Computer Science student at Farmingdale State College."/>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#560BAD" />
        <meta name="apple-mobile-web-app-status-bar" content="#560BAD" />
        <meta name="apple-mobile-web-app-title" content="Mike Odnis" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="google-site-verification" content="UEQaFuTqVDx84-mVcEXzo-y2PmglIrDzOPjcetwCnrM" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};
export default RootDocument;