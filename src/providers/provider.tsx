'use client';

import { actions } from '@/lib/actions';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { KBarProvider } from 'kbar';
import { CustomAnimatedCursor, Events, Providers, ThemeProvider } from '.';
import { QueryProvider } from './QueryProvider';

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
          [QueryProvider, {}],
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
