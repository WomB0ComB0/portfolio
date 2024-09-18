import 'server-only';

import { auth } from '@/core/firebase';
import { loggerLink } from '@trpc/client';
import { experimental_nextCacheLink } from '@trpc/next/app-dir/links/nextCache';
import { experimental_createTRPCNextAppDirServer } from '@trpc/next/app-dir/server';
import { cookies } from 'next/headers';

import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';
import { transformer } from './shared';

export const api = experimental_createTRPCNextAppDirServer<typeof appRouter>({
  config() {
    return {
      transformer,
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        experimental_nextCacheLink({
          revalidate: 5,
          router: appRouter,
          createContext: async () => {
            const heads = new Headers();
            heads.set('cookie', cookies().toString());
            heads.set('x-trpc-source', 'rsc');

            // Get the Firebase ID token from the cookie
            const idToken = cookies().get('firebaseIdToken')?.value;

            let session = null;
            if (idToken) {
              try {
                // Verify the ID token
                const decodedToken = await auth.currentUser?.getIdToken();
                session = {
                  uid: decodedToken,
                  // Add any other user information you need
                };
              } catch (error) {
                console.error('Error verifying Firebase ID token:', error);
              }
            }

            return createTRPCContext({
              headers: heads,
            });
          },
        }),
      ],
    };
  },
});
