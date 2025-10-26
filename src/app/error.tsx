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

import dynamic from 'next/dynamic';

const InternalServerError = dynamic(
  () => import('@/app/_client').then((mod) => mod.InternalServerError),
  {
    ssr: false,
  },
);

/**
 * Error boundary component that displays a user-friendly error page.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Error & { digest?: string }} props.error - The error object that was caught
 * @param {() => void} props.reset - Function to reset the error boundary and retry rendering
 *
 * @returns {React.JSX.Element} Rendered error page with animated background and error details
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={
 *   <Error
 *     error={new Error("Something went wrong")}
 *     reset={() => window.location.reload()}
 *   />
 * }>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <InternalServerError error={error} reset={reset} />;
}
