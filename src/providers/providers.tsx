'use client';

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

import type { JSX, JSXElementConstructor, ReactNode } from 'react';

/**
 * Infers the props from a given React component constructor type.
 *
 * @template T - A React component constructor.
 * @readonly
 * @author Mike Odnis
 * @see https://react.dev/reference/react/Component
 * @version 1.0.0
 */
type InferProps<T> = T extends JSXElementConstructor<infer P> ? P : never;

/**
 * Represents a tuple of a Provider component and its props (excluding `children`).
 *
 * @template T - A React component constructor.
 * @readonly
 * @author Mike Odnis
 * @see https://react.dev/reference/react/Component
 * @version 1.0.0
 */
type ProviderWithProps<T extends JSXElementConstructor<unknown>> = [
  T,
  Omit<InferProps<T>, 'children'>,
];

/**
 * Infers an array of ProviderWithProps types from a readonly array of provider constructors.
 *
 * @template T - An array of React component constructors.
 * @readonly
 * @author Mike Odnis
 * @see ProviderWithProps
 * @version 1.0.0
 */
type InferProviderArray<T extends ReadonlyArray<JSXElementConstructor<unknown>>> = {
  [K in keyof T]: ProviderWithProps<T[K]>;
};

/**
 * Props for provider stack or provider wrapper components, used for composing multiple context providers.
 *
 * @template T - Array of provider constructors.
 * @property {ReactNode} children - The React children to be rendered in the innermost provider.
 * @property {InferProviderArray<T>} providers - An array of provider components and their props.
 * @readonly
 * @author Mike Odnis
 * @see https://react.dev/reference/react/Component
 * @version 1.0.0
 */
type ProvidersProps<T extends JSXElementConstructor<unknown>[]> = {
  children: ReactNode;
  providers: InferProviderArray<T>;
};

/**
 * Recursively composes multiple React context providers around a children node.
 *
 * @template T - Type of provider components array.
 * @param {ProvidersProps<T>} props - The props containing providers and children.
 * @returns {JSX.Element} A React element with the composed providers and children.
 * @throws {TypeError} If `providers` is not an array or contains invalid provider types.
 * @example
 * * <ProviderStack providers={[[SomeProvider, {value: 1}]]}>Content</ProviderStack>
 * ```
 * @author Mike Odnis <WomB0ComB0>
 * @see https://react.dev
 * @version 1.0.0
 * @public
 * @web
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
 * Composes an array of React context providers around its children node.
 * Serves as a wrapper for the application's context composition needs.
 *
 * @template T - Array of component providers.
 * @param {ProvidersProps<T>} props - The props containing providers and children.
 * @returns {JSX.Element} A React element wrapped with the composed providers.
 * @throws {TypeError} If `providers` is not an array or contains invalid provider definitions.
 * @example
 * ```tsx
 * <Providers providers={[[ThemeProvider, {theme}], [SessionProvider, {session}]]}>
 *   <App />
 * </Providers>
 * ```
 * @author Mike Odnis <WomB0ComB0>
 * @see ProviderStack
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @public
 * @web
 */
export function Providers<T extends JSXElementConstructor<any>[]>({
  children,
  providers,
}: ProvidersProps<T>): JSX.Element {
  return <ProviderStack providers={providers} children={children} />;
}
