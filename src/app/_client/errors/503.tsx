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
 * @public
 * @web
 * @component
 * @description Renders a 503 Service Unavailable error page.
 * This component displays a title and a descriptive message indicating that the service is temporarily unavailable.
 * It leverages the `ErrorLayout` component for consistent error page styling and structure.
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link ErrorLayout} for the underlying layout structure.
 */

import React from 'react';
import { ErrorLayout } from '.';

const ServiceUnavailableError = React.memo(() => {
  return <ErrorLayout title="503" description="Service Unavailable - Please try again later" />;
});

ServiceUnavailableError.displayName = 'ServiceUnavailableError';
export { ServiceUnavailableError };
