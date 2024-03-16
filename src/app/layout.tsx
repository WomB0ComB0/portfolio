import "@/styles/globals.css";
import Head from "next/head";

import { Montserrat } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { Scripts } from "@/scripts/Scripts";
import Providers from "@/providers/Providers";

const inter = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Head>
        <Scripts />
      </Head>
      <body className={`font-sans ${inter.variable}`}>
        <TRPCReactProvider>
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
