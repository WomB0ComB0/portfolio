'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { KBarProvider } from 'kbar';
import { actions } from '@/lib';
import { CustomAnimatedCursor, Events, Providers, ThemeProvider } from '.';
import { createQueryClient } from './server';

export const Provider: React.FC<
  Readonly<{
    children: React.ReactNode;
  }>
> = ({ children }) => {
  return (
    <>
      <Providers
        providers={[
          [ThemeProvider, {}],
          [
            KBarProvider,
            {
              actions: actions,
            },
          ],
          [Events, {}],
          [QueryClientProvider, { client: createQueryClient() }],
        ]}
      >
        <>
          {children}
          <CustomAnimatedCursor />
          <ReactQueryDevtools initialIsOpen={false} />
        </>
      </Providers>
    </>
  );
};
Provider.displayName = 'Provider';
export default Provider;
