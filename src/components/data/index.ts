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
 * @file Building blocks for server-rendered data sections. No directive on purpose: server
 * components import SectionError from here, and the client parts carry their own 'use client'.
 * Not re-exported from the root '@/components' barrel, which pulls cmd and layout into the RSC
 * graph.
 */

export { LinkPending, type LinkPendingProps } from './link-pending';
export { RetryButton, type RetryButtonProps } from './retry-button';
export { SectionBoundary, type SectionBoundaryProps } from './section-boundary';
export { SECTION_ERROR_DESCRIPTION, SectionError, type SectionErrorProps } from './section-error';
