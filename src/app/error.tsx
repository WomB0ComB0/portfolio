'use client';
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
}: { error: Error & { digest?: string }; reset: () => void }) {
  return <InternalServerError error={error} reset={reset} />;
}
