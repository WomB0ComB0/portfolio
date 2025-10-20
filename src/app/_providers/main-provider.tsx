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

/**
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link ../../providers/Providers.tsx} for the main application providers composition.
 * @description A main provider component that wraps the application's children.
 *   This component serves as a placeholder or a top-level wrapper for other context providers
 *   that might be composed within the application. It ensures that all child components
 *   have access to the necessary contexts (e.g., theme, query, state management).
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child elements to be rendered within the provider's context.
 * @returns {JSX.Element} The rendered children wrapped by the provider.
 * @example
 * ```tsx
 * import { MainProvider } from '@/app/_providers/main-provider';
 *
 * function App() {
 *   return (
 *     <MainProvider>
 *       <Layout>
 *         <HomePage />
 *       </Layout>
 *     </MainProvider>
 *   );
 * }
 * ```
 */
'use client';

import type React from 'react';

export const MainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

MainProvider.displayName = 'MainProvider';
export default MainProvider;
