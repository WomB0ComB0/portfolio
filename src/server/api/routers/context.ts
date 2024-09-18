import { currentUserValue } from '@/core/auth';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import type { Getter } from 'jotai';

export async function createContext(opts?: FetchCreateContextFnOptions) {
  const req = opts?.req ?? new Request('');
  const session = currentUserValue
    ?.read(req as unknown as Getter, {
      signal: new AbortController().signal,
      setSelf: () => {},
    })
    ?.getIdToken();

  return {
    session,
    headers: opts && Object.fromEntries(opts.req.headers),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
