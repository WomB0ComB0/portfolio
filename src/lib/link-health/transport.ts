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

import 'server-only';

import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { isIP } from 'node:net';
import { checkServerIdentity } from 'node:tls';
import { type PublicAddress, probeHostname, publicAddress, publicHostname } from './ip-policy';
import { normalizeLinkUrl } from './url';

export interface ProbeHeaders {
  readonly status: number;
  readonly location?: string;
}

export interface ProbeRequest {
  readonly url: URL;
  readonly address: PublicAddress;
  readonly method: 'HEAD' | 'GET';
  readonly signal: AbortSignal;
}

/** Copy only status and Location; destroy the stream without consuming a response body. */
function headersOf(response: IncomingMessage): ProbeHeaders {
  return {
    status: response.statusCode ?? 0,
    ...(typeof response.headers.location === 'string'
      ? { location: response.headers.location }
      : {}),
  };
}

/**
 * The socket destination is an IP, never the original DNS name. A fresh one-use agent avoids
 * global proxy configuration and pooled sockets. TLS still verifies the original hostname,
 * not the IP we selected. No caller headers, credentials, cookies or request body are accepted.
 */
export async function requestPinned({
  url,
  address,
  method,
  signal,
}: ProbeRequest): Promise<ProbeHeaders> {
  const checked = publicAddress(address.address);
  if (
    !(url instanceof URL) ||
    normalizeLinkUrl(url.href) !== url.href ||
    !checked ||
    checked.address !== address.address ||
    checked.family !== address.family ||
    !publicHostname(probeHostname(url)) ||
    !['HEAD', 'GET'].includes(method)
  )
    throw new Error('Unsafe link check target');
  signal.throwIfAborted();
  const hostname = probeHostname(url).replace(/\.$/u, '');
  const secure = url.protocol === 'https:';
  const options: RequestOptions = {
    protocol: url.protocol,
    hostname: checked.address,
    family: checked.family,
    port: secure ? 443 : 80,
    path: `${url.pathname}${url.search}`,
    method,
    headers: { Host: url.host, Accept: '*/*', 'User-Agent': 'Portfolio-Link-Check/1.0' },
    agent: false,
    signal,
    maxHeaderSize: 8192,
    insecureHTTPParser: false,
    ...(secure
      ? ({
          servername: isIP(hostname) ? '' : hostname,
          rejectUnauthorized: true,
          checkServerIdentity: (_server, certificate) => checkServerIdentity(hostname, certificate),
        } satisfies Partial<RequestOptions>)
      : {}),
  };
  return new Promise((resolve, reject) => {
    const request = (secure ? httpsRequest : httpRequest)(options, (response) => {
      resolve(headersOf(response));
      response.on('error', () => undefined);
      response.destroy();
    });
    request.on('error', reject);
    // Upgrades hand the socket away from ClientRequest; never leave an unsolicited one open.
    request.once('upgrade', (response, socket) => {
      resolve(headersOf(response));
      response.on('error', () => undefined);
      response.destroy();
      socket.destroy();
    });
    request.end();
  });
}
