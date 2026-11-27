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

/**
 * @file The DNS-pinned HTTP transport: one request to an address the caller has already resolved
 * and vetted (probe.ts resolvePublicAddress), sent to that IP with the original Host, SNI and TLS
 * identity, so a name cannot rebind between the check and the connection. requestPinned answers
 * status and Location for the link probe and never reads a body. requestPinnedResponse keeps the
 * body as a stream for the free-books content inspection (free-books/pinned-fetch.ts), decoding a
 * gzip, deflate or br body a server sent although identity was asked for, and naming any other
 * encoding so the inspection can refuse it. Neither follows a redirect. Guarded by
 * tests/unit/link-health/probe.test.ts.
 */

import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { isIP } from 'node:net';
import { pipeline, Readable, type Transform } from 'node:stream';
import { checkServerIdentity } from 'node:tls';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { type PublicAddress, probeHostname, publicAddress, publicHostname } from './ip-policy';
import { normalizeLinkUrl } from './url';

/** Sent with every link probe. */
const LINK_CHECK_USER_AGENT = 'Portfolio-Link-Check/1.0';
/** A byte range of the form `bytes=0-1048575`, so a header can never carry a second line. */
const BYTE_RANGE = /^bytes=\d{1,15}-\d{0,15}$/u;
/** A user agent of printable ASCII only. */
const PRINTABLE_HEADER = /^[\x20-\x7e]{1,256}$/u;

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

/** One pinned GET whose body the caller reads (and must read or cancel). */
export interface PinnedGetRequest {
  readonly url: URL;
  readonly address: PublicAddress;
  readonly signal: AbortSignal;
  /** Sent as `Range`, e.g. `bytes=0-1048575`. */
  readonly range?: string;
  /** Sent as `User-Agent`; the link checker's own when left out. */
  readonly userAgent?: string;
}

/** A pinned GET's answer: its status, the headers content inspection reads, and its body. */
export interface PinnedResponse {
  readonly status: number;
  readonly headers: {
    readonly contentType?: string;
    readonly contentDisposition?: string;
    readonly location?: string;
    /**
     * A Content-Encoding the transport could not decode, so the body is still encoded; left out
     * when the body is the page's own bytes (sent as identity, or decoded here).
     */
    readonly contentEncoding?: string;
  };
  readonly body: ReadableStream<Uint8Array>;
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
 * The options for one pinned request, after checking the target again: the URL is canonical and
 * its host public, and the address is the public one the caller vetted. The socket destination is
 * that IP, never the DNS name; a fresh one-use agent avoids global proxy configuration and pooled
 * sockets; TLS still verifies the original hostname, not the IP we selected.
 */
function pinnedRequestOptions(
  url: URL,
  address: PublicAddress,
  method: ProbeRequest['method'],
  signal: AbortSignal,
  headers: Readonly<Record<string, string>>,
): RequestOptions {
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
  return {
    protocol: url.protocol,
    hostname: checked.address,
    family: checked.family,
    port: secure ? 443 : 80,
    path: `${url.pathname}${url.search}`,
    method,
    headers: { Host: url.host, ...headers },
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
  const options = pinnedRequestOptions(url, address, method, signal, {
    Accept: '*/*',
    'User-Agent': LINK_CHECK_USER_AGENT,
  });
  const secure = url.protocol === 'https:';
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

/** The headers content inspection reads, when the server sent them as single values. */
function inspectionHeadersOf(response: IncomingMessage): PinnedResponse['headers'] {
  const { 'content-type': contentType, 'content-disposition': contentDisposition } =
    response.headers;
  return {
    ...(typeof contentType === 'string' ? { contentType } : {}),
    ...(typeof contentDisposition === 'string' ? { contentDisposition } : {}),
    ...(typeof response.headers.location === 'string'
      ? { location: response.headers.location }
      : {}),
  };
}

/** The Content-Encodings decoded here, each with a fresh streaming decoder. */
const DECODERS: ReadonlyMap<string, () => Transform> = new Map([
  ['gzip', () => createGunzip()],
  ['x-gzip', () => createGunzip()],
  ['deflate', () => createInflate()],
  ['br', () => createBrotliDecompress()],
]);

/**
 * The response body as the page's own bytes. An identity body passes as is. A gzip, x-gzip,
 * deflate or br body (sent although identity was asked for) is piped through its streaming
 * decoder, which only decodes as fast as the caller reads; destroying the decoder (a cancel)
 * destroys the socket, and a socket error destroys the decoder. Any other encoding is left encoded
 * and named in `undecoded`, so the caller can refuse it instead of reading it as the page.
 */
function decodedBody(response: IncomingMessage): {
  readonly body: Readable;
  readonly undecoded?: string;
} {
  const raw = response.headers['content-encoding'];
  const encoding = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (encoding === '' || encoding === 'identity') return { body: response };
  const decoder = DECODERS.get(encoding)?.();
  if (!decoder) return { body: response, undecoded: encoding };
  pipeline(response, decoder, () => undefined);
  return { body: decoder };
}

/**
 * One GET to the vetted address, as requestPinned sends it, that keeps the body: it arrives as a
 * web stream, which the caller reads (bounded) or cancels; cancelling, or the signal firing,
 * destroys the socket. Asks for no compression; a server that compresses anyway has a gzip,
 * deflate or br body decoded (decodedBody), and any other encoding reported in
 * `headers.contentEncoding`, so the bytes handed on are never compressed ones posing as the page.
 * A redirect is answered, never followed: the caller vets and resolves the next hop itself.
 */
export async function requestPinnedResponse({
  url,
  address,
  signal,
  range,
  userAgent = LINK_CHECK_USER_AGENT,
}: PinnedGetRequest): Promise<PinnedResponse> {
  if ((range !== undefined && !BYTE_RANGE.test(range)) || !PRINTABLE_HEADER.test(userAgent))
    throw new Error('Unsafe link check target');
  const options = pinnedRequestOptions(url, address, 'GET', signal, {
    Accept: '*/*',
    'Accept-Encoding': 'identity',
    'User-Agent': userAgent,
    ...(range === undefined ? {} : { Range: range }),
  });
  const secure = url.protocol === 'https:';
  return new Promise((resolve, reject) => {
    const request = (secure ? httpsRequest : httpRequest)(options, (response) => {
      response.on('error', () => undefined);
      const { body, undecoded } = decodedBody(response);
      resolve({
        status: response.statusCode ?? 0,
        headers: {
          ...inspectionHeadersOf(response),
          ...(undecoded === undefined ? {} : { contentEncoding: undecoded }),
        },
        // node:stream/web's ReadableStream is the global one at runtime (Node and Bun); only the
        // declarations differ from the DOM lib's, so the cast goes through unknown.
        body: Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>,
      });
    });
    request.on('error', reject);
    // Upgrades hand the socket away from ClientRequest; never leave an unsolicited one open.
    request.once('upgrade', (response, socket) => {
      response.on('error', () => undefined);
      response.destroy();
      socket.destroy();
      reject(new Error('Unexpected protocol upgrade'));
    });
    request.end();
  });
}
