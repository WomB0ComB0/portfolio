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

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

/**
 * ClientError component for displaying client-side error messages in a styled alert.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Error} props.error - Error object containing details about the client-side error
 *
 * @example
 * ```tsx
 * try {
 *   // Some client-side code that may throw
 * } catch (error) {
 *   return <ClientError error={error as Error} />
 * }
 * ```
 *
 * @remarks
 * - Uses the 'destructive' variant of Alert component for error styling
 * - Displays error message from error object, or fallback text if message is empty
 * - Includes warning triangle icon from Lucide icons
 * - Fully accessible with ARIA labels and semantic HTML structure
 * - Client component that can be used for client-side error handling
 *
 * @returns {React.JSX.Element} Alert component containing error details
 *
 * @throws {TypeError} If error prop is not provided or is not an Error object
 *
 * @see {@link https://react.dev/reference/react/Component} React Component
 * @see {@link https://lucide.dev/icons/alert-triangle} Lucide AlertTriangle Icon
 */
export const ClientError = ({ error }: { error: Error }) => {
  return (
    <Alert variant="destructive" className="m-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error.message || 'An unexpected client-side error occurred.'}
      </AlertDescription>
    </Alert>
  );
};

ClientError.displayName = 'ClientError';
export default ClientError;
