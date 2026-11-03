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

import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  CSP_MODE,
  createNonce,
  cspHeaderName,
  sentryCspReportEndpoint,
} from '@/lib/security/csp';

const directive = (policy: string, name: string): string[] | undefined =>
  policy
    .split('; ')
    .find((d) => d === name || d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1);

const prod = buildContentSecurityPolicy({
  nonce: 'abc123==',
  isDev: false,
  mode: 'enforce',
  firebaseAuthDomain: 'example-app.firebaseapp.com',
});

describe('buildContentSecurityPolicy', () => {
  it('trusts scripts by nonce with strict-dynamic, without eval in production', () => {
    expect(directive(prod, 'script-src')).toEqual([
      "'self'",
      "'nonce-abc123=='",
      "'strict-dynamic'",
      'https:',
    ]);
    expect(prod).not.toContain('unsafe-eval');
  });

  it('allows eval and websockets only in development', () => {
    const dev = buildContentSecurityPolicy({ nonce: 'n', isDev: true, mode: 'report-only' });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toEqual(expect.arrayContaining(['ws:', 'wss:']));
    expect(directive(prod, 'connect-src')).not.toContain('ws:');
  });

  it('never enforces Trusted Types (it blanks the site with Next/Turbopack)', () => {
    expect(prod).not.toMatch(/trusted-types/);
  });

  it('allows the third parties the site actually loads', () => {
    expect(directive(prod, 'connect-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://*.google-analytics.com',
        'https://www.google.com',
        'https://api.monkeytype.com',
        'https://maps.googleapis.com',
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
      ]),
    );
    expect(directive(prod, 'img-src')).toEqual(
      expect.arrayContaining([
        'https://cdn.discordapp.com',
        'https://img.youtube.com',
        'https://maps.gstatic.com',
      ]),
    );
    expect(directive(prod, 'frame-src')).toEqual([
      'https://cdn.sanity.io',
      'https://example-app.firebaseapp.com',
    ]);
    expect(directive(prod, 'worker-src')).toEqual(["'self'", 'blob:']);
  });

  it('covers what the Google Maps bundle loads (its Google Fonts stylesheet, data:/blob: fetches)', () => {
    expect(directive(prod, 'style-src')).toContain('https://fonts.googleapis.com');
    expect(directive(prod, 'font-src')).toEqual(["'self'", 'https://fonts.gstatic.com']);
    expect(directive(prod, 'connect-src')).toEqual(expect.arrayContaining(['data:', 'blob:']));
  });

  it('locks down plugins, base URLs, form targets and framing', () => {
    expect(directive(prod, 'object-src')).toEqual(["'none'"]);
    expect(directive(prod, 'base-uri')).toEqual(["'none'"]);
    expect(directive(prod, 'form-action')).toEqual(["'self'"]);
    expect(directive(prod, 'frame-ancestors')).toEqual(["'none'"]);
  });

  it('adds upgrade-insecure-requests only when enforcing (browsers ignore it in report-only)', () => {
    expect(directive(prod, 'upgrade-insecure-requests')).toEqual([]);
    const reportOnly = buildContentSecurityPolicy({
      nonce: 'n',
      isDev: false,
      mode: 'report-only',
    });
    expect(directive(reportOnly, 'upgrade-insecure-requests')).toBeUndefined();
  });

  it('adds report directives only when a report URI is given', () => {
    expect(prod).not.toContain('report-uri');
    const withReports = buildContentSecurityPolicy({
      nonce: 'n',
      isDev: false,
      mode: 'report-only',
      reportUri: 'https://example.com/report',
    });
    expect(directive(withReports, 'report-uri')).toEqual(['https://example.com/report']);
    expect(directive(withReports, 'report-to')).toEqual(['csp-endpoint']);
  });

  it('omits the Firebase frame when no auth domain is configured', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'n', isDev: false, mode: 'enforce' });
    expect(directive(policy, 'frame-src')).toEqual(['https://cdn.sanity.io']);
  });
});

describe('cspHeaderName', () => {
  it('maps the mode to the header name', () => {
    expect(cspHeaderName('enforce')).toBe('Content-Security-Policy');
    expect(cspHeaderName('report-only')).toBe('Content-Security-Policy-Report-Only');
  });

  it('starts in report-only mode', () => {
    expect(CSP_MODE).toBe('report-only');
  });
});

describe('sentryCspReportEndpoint', () => {
  it('derives the security endpoint from a DSN', () => {
    expect(sentryCspReportEndpoint('https://abc123@o42.ingest.us.sentry.io/7', 'production')).toBe(
      'https://o42.ingest.us.sentry.io/api/7/security/?sentry_key=abc123&sentry_environment=production',
    );
  });

  it('returns undefined for missing or malformed DSNs', () => {
    expect(sentryCspReportEndpoint(undefined)).toBeUndefined();
    expect(sentryCspReportEndpoint('')).toBeUndefined();
    expect(sentryCspReportEndpoint('not a url')).toBeUndefined();
    expect(sentryCspReportEndpoint('https://o42.ingest.sentry.io/7')).toBeUndefined();
    expect(sentryCspReportEndpoint('https://abc@o42.ingest.sentry.io/')).toBeUndefined();
  });
});

describe('createNonce', () => {
  it('returns a 128-bit base64 value that differs per call', () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(b);
  });
});
