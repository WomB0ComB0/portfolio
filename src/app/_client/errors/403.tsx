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

import React from 'react';
import { ErrorLayout } from '.';

/**
 * @author Mike Odnis
 * @version 1.0.0
 * @description A React functional component that renders a 403 Forbidden error page.
 * This component utilizes the generic `ErrorLayout` to display a standardized
 * error message for HTTP 403 status codes. It is memoized for performance optimization.
 * @see {@link ErrorLayout} for the underlying layout structure.
 * @returns {React.ReactElement} The rendered 403 Forbidden error page component.
 */
const ForbiddenError: React.FC = React.memo(() => {
  return <ErrorLayout title="403" description="Forbidden" />;
});

ForbiddenError.displayName = 'ForbiddenError';
export { ForbiddenError };
