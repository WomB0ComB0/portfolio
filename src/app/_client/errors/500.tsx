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

/**
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link ErrorLayout} for the underlying layout component.
 * @description React functional component that displays a 500 Internal Server Error page.
 * This component is designed to be used as an error boundary fallback UI.
 * It leverages `React.memo` for performance optimization, preventing unnecessary re-renders
 * if its props remain shallowly equal.
 *
 * @param {object} props - The properties for the InternalServerError component.
 * @param {Error & { digest?: string }} props.error - The error object caught by the error boundary.
 *                                                   It may include a `digest` property for additional context.
 * @param {() => void} props.reset - A function provided by the error boundary to reset the state
 *                                   and attempt to re-render the component tree.
 * @returns {JSX.Element} A React element representing the 500 error page.
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallbackRender={({ error, reset }) => (
 *   <InternalServerError error={error} reset={reset} />
 * )}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import React from 'react';
import { ErrorLayout } from '.';

const InternalServerError = React.memo(
  ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
    return (
      <ErrorLayout title="500" description="Internal Server Error" error={error} reset={reset} />
    );
  },
);

InternalServerError.displayName = 'InternalServerError';
export { InternalServerError };
