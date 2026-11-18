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
 * @file Explicit App Router handler for the `/monitoring` Sentry envelope tunnel.
 *
 * Having a first-class route at `/monitoring` ensures every `POST /monitoring` request is handled
 * directly by Next.js with a bounded body read and upstream timeout (instead of falling through to
 * `/_not-found` or hanging on `http.Server.emit` interception).
 */

import { env } from '@/env';
import { forwardSentryTunnelRequest } from '@/lib/observability/sentry-tunnel';

/** Cap serverless execution at 15s so stalled client connections never hang for 300s. */
export const maxDuration = 15;

export async function POST(request: Request): Promise<Response> {
  return forwardSentryTunnelRequest(request, {
    allowedDsns: [env.NEXT_PUBLIC_SENTRY_DSN],
  });
}
