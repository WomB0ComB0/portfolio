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

// import { Providers } from '@/providers';
import type React from 'react';

const MainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

MainProvider.displayName = 'MainProvider';
export { MainProvider };
