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
 * @fileoverview The 404 view for notFound() thrown by any page under (routes).
 *
 * It renders inside the (routes) layout, which already provides the shell, so it adds only the
 * view. Unmatched URLs never reach this file: Next renders src/app/not-found.tsx for them, outside
 * route-group layouts. Keep both, so a future catch-all page under (routes) still gets a 404 view.
 */

import type { JSX } from 'react';
import { NotFoundView } from '@/app/_components/errors';

export default function NotFound(): JSX.Element {
  return <NotFoundView />;
}
