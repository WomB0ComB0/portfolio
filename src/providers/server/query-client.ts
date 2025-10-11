/**
 * Copyright 2025 Product Decoder
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { cache } from 'react';
import SuperJSON from 'superjson';

export const createQueryClient = cache(() => {
  let queryClient: QueryClient | null = null;

  return (): QueryClient => {
    if (!queryClient) {
      queryClient = new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            console.error(`Query error: ${error}`, query);
          },
          onSuccess: (data, query) => {
            console.debug(`Query success`, { data, query });
          },
          onSettled: (data, error, query) => {
            console.debug(`Query settled`, { data, error, query });
          }
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            console.error(`Mutation error: ${error}`, { message: error.message, stack: error.stack });
            return Promise.resolve();
          },
          onSuccess: (data, variables, context, mutation) => {
            console.info(
              "Mutation succeeded",
              {
                data,
                variables,
                context,
                mutationKey: mutation?.options?.mutationKey,
                mutationFn: mutation?.options?.mutationFn?.name || "anonymous"
              }
            );
            return Promise.resolve();
          }
        }),
        defaultOptions: {
          dehydrate: {
            serializeData: SuperJSON.serialize,
            shouldDehydrateQuery: (query) =>
              typeof defaultShouldDehydrateQuery !== "undefined"
                ? defaultShouldDehydrateQuery(query) || query.state.status === 'pending'
                : query.state.status === 'pending',
          },
          hydrate: {
            deserializeData: SuperJSON.deserialize,
          },
        },
      });
    }
    return queryClient;
  };
})();