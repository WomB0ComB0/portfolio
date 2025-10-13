/**
 * Copyright 2025 Mike Odnis
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

'use client';

import type { JSX, JSXElementConstructor, ReactNode } from 'react';

type InferProps<T> = T extends JSXElementConstructor<infer P> ? P : never;

type ProviderWithProps<T extends JSXElementConstructor<unknown>> = [
  T,
  Omit<InferProps<T>, 'children'>,
];

type InferProviderArray<T extends ReadonlyArray<JSXElementConstructor<unknown>>> = {
  [K in keyof T]: ProviderWithProps<T[K]>;
};

type ProvidersProps<T extends JSXElementConstructor<unknown>[]> = {
  children: ReactNode;
  providers: InferProviderArray<T>;
};

/**
 * Component that recursively composes provider components
 */
function ProviderStack<T extends JSXElementConstructor<any>[]>({
  providers,
  children,
}: ProvidersProps<T>): JSX.Element {
  return providers.reduceRight(
    (node, [Provider, props]) => <Provider {...props}>{node}</Provider>,
    <>{children}</>,
  );
}

/**
 * Provider wrapper component that composes multiple context providers
 */
export function Providers<T extends JSXElementConstructor<any>[]>({
  children,
  providers,
}: ProvidersProps<T>): JSX.Element {
  return <ProviderStack providers={providers} children={children} />;
}
