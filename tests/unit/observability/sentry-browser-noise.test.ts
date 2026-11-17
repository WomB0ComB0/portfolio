// @vitest-environment node
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

import { createRequire } from 'node:module';
import path from 'node:path';
import {
  BrowserClient,
  defaultStackParser,
  eventFiltersIntegration,
  thirdPartyErrorFilterIntegration,
} from '@sentry/browser';
import { type BrowserOptions, type ErrorEvent, Scope } from '@sentry/nextjs';
import { describe, expect, it, vi } from 'vitest';
import { buildClientOptions, SENTRY_APPLICATION_KEY } from '@/lib/observability/sentry-options';

const PAGE_URL = 'https://mikeodnis.dev/experience/exp-develop-for-good';
const APP_URL = 'https://mikeodnis.dev/_next/static/chunks/app.js';
const READER_ERRORS = [
  {
    type: 'TypeError',
    value: "undefined is not an object (evaluating 'window.__firefox__.reader')",
    column: 19,
  },
  { type: 'ReferenceError', value: "Can't find variable: __firefox__", column: 12 },
] as const;

function readerEvent(signature: (typeof READER_ERRORS)[number] = READER_ERRORS[0]): ErrorEvent {
  return {
    type: undefined,
    request: { url: PAGE_URL },
    tags: { third_party_code: true },
    exception: {
      values: [
        {
          type: signature.type,
          value: signature.value,
          mechanism: { type: 'auto.browser.global_handlers.onerror', handled: false },
          // The SDK parses the raw Safari stack before Next.js normalizes the filename.
          stacktrace: {
            frames: defaultStackParser(`global code@${PAGE_URL}:1:${signature.column}`),
          },
        },
      ],
    },
  };
}

function nativeBridgeEvent(id = 1): ErrorEvent {
  return {
    type: undefined,
    exception: {
      values: [
        {
          type: 'UnhandledRejection',
          value: `Non-Error promise rejection captured with value: Object Not Found Matching Id:${id}, MethodName:update, ParamCount:4`,
          mechanism: { type: 'auto.browser.global_handlers.onunhandledrejection', handled: false },
        },
      ],
    },
    breadcrumbs: [
      {
        category: 'console',
        type: 'default',
        message: 'antifingerprint not defined yet. will try and handle event after its ready...',
      },
    ],
  };
}

function exceptionFrom(event: ErrorEvent) {
  const exception = event.exception?.values?.[0];
  if (!exception) throw new Error('Missing test exception');
  return exception;
}

function framesFrom(event: ErrorEvent) {
  const frames = exceptionFrom(event).stacktrace?.frames;
  if (!frames) throw new Error('Missing test stack');
  return frames;
}

function frameFrom(event: ErrorEvent) {
  const frame = framesFrom(event)[0];
  if (!frame) throw new Error('Missing test frame');
  return frame;
}

function filter(event: ErrorEvent) {
  const options: BrowserOptions = buildClientOptions({ optIn: '1' });
  return options.beforeSend ? options.beforeSend(event, {}) : event;
}

const NATIVE_BRIDGE_PRESERVED_CASES: [string, (event: ErrorEvent) => void][] = [
  [
    'no breadcrumb',
    (event) => {
      delete event.breadcrumbs;
    },
  ],
  [
    'a different breadcrumb message',
    (event) => {
      event.breadcrumbs = [{ category: 'console', message: 'antifingerprint failed' }];
    },
  ],
  [
    'the same message outside a console breadcrumb',
    (event) => {
      event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
        ...breadcrumb,
        category: 'app',
      }));
    },
  ],
  [
    'an application frame',
    (event) => {
      exceptionFrom(event).stacktrace = {
        frames: [{ filename: APP_URL, function: 'update', lineno: 1, colno: 40, in_app: true }],
      };
    },
  ],
  [
    'an unidentified frame',
    (event) => {
      exceptionFrom(event).stacktrace = { frames: [{}] };
    },
  ],
  [
    'a different method',
    (event) => {
      exceptionFrom(event).value = exceptionFrom(event).value?.replace(
        'MethodName:update',
        'MethodName:remove',
      );
    },
  ],
  [
    'a different parameter count',
    (event) => {
      exceptionFrom(event).value = exceptionFrom(event).value?.replace(
        'ParamCount:4',
        'ParamCount:3',
      );
    },
  ],
  [
    'extra message text',
    (event) => {
      exceptionFrom(event).value += ' in application update';
    },
  ],
  [
    'a trailing message newline',
    (event) => {
      exceptionFrom(event).value += '\n';
    },
  ],
  [
    'an explicit application capture',
    (event) => {
      exceptionFrom(event).mechanism = { type: 'generic', handled: true };
    },
  ],
  [
    'a handled global rejection',
    (event) => {
      exceptionFrom(event).mechanism = {
        type: 'auto.browser.global_handlers.onunhandledrejection',
        handled: true,
      };
    },
  ],
  [
    'a missing rejection mechanism',
    (event) => {
      delete exceptionFrom(event).mechanism;
    },
  ],
  [
    'a different exception type',
    (event) => {
      exceptionFrom(event).type = 'Error';
    },
  ],
  [
    'a linked application exception',
    (event) => {
      event.exception?.values?.push({ type: 'Error', value: 'Application update failed' });
    },
  ],
];

describe('observed native bridge injection filter', () => {
  it.each([1, 2, 3, 4])('drops the complete observed signature for object %i', (id) => {
    expect(filter(nativeBridgeEvent(id))).toBeNull();
  });

  it('also accepts an explicitly empty stack', () => {
    const event = nativeBridgeEvent();
    exceptionFrom(event).stacktrace = { frames: [] };
    expect(filter(event)).toBeNull();
  });

  it.each(NATIVE_BRIDGE_PRESERVED_CASES)('keeps %s', (_name, change) => {
    const event = nativeBridgeEvent();
    change(event);
    expect(filter(event)).toBe(event);
  });
});

describe('browser reader injection filter', () => {
  it.each(READER_ERRORS)('drops the observed third-party $type reader signature', (signature) => {
    expect(filter(readerEvent(signature))).toBeNull();
  });

  it('drops the document frame after Next.js rewrites its origin to app://', () => {
    const event = readerEvent();
    frameFrom(event).filename = 'app:///experience/exp-develop-for-good';
    expect(filter(event)).toBeNull();
  });

  it.each([undefined, false, 'true', 'True'])(
    'keeps events without the SDK boolean tag: %s',
    (tag) => {
      const event = readerEvent();
      event.tags = tag === undefined ? {} : { third_party_code: tag };
      expect(filter(event)).toBe(event);
    },
  );

  it.each([APP_URL, 'app:///_next/static/chunks/app.js', 'app:///another-page'])(
    'keeps a matching error from a different frame URL, even if tagged: %s',
    (filename) => {
      const event = readerEvent();
      frameFrom(event).filename = filename;
      expect(filter(event)).toBe(event);
    },
  );

  it('keeps an error with an additional application frame', () => {
    const event = readerEvent();
    framesFrom(event).push({
      filename: APP_URL,
      function: 'renderExperience',
      lineno: 1,
      colno: 40,
      in_app: true,
    });
    expect(filter(event)).toBe(event);
  });

  it('keeps linked application errors', () => {
    const event = readerEvent();
    event.exception?.values?.push({ type: 'Error', value: 'Experience rendering failed' });
    expect(filter(event)).toBe(event);
  });

  it.each([
    "undefined is not an object (evaluating 'window.__firefox__.reader.open')",
    "undefined is not an object (evaluating 'experience.reader')",
    "Can't find variable: experience",
    'NetworkError when attempting to fetch resource.',
  ])('keeps other Firefox/browser errors: %s', (value) => {
    const event = readerEvent();
    event.contexts = { browser: { name: 'Firefox' } };
    exceptionFrom(event).value = value;
    expect(filter(event)).toBe(event);
  });

  it('keeps a different exception type with the same text', () => {
    const event = readerEvent();
    exceptionFrom(event).type = 'Error';
    expect(filter(event)).toBe(event);
  });

  it('keeps explicit application captures', () => {
    const event = readerEvent();
    exceptionFrom(event).mechanism = { type: 'generic', handled: true };
    expect(filter(event)).toBe(event);
  });

  it('keeps stacks that do not identify a single inline global frame', () => {
    for (const change of [
      { function: 'renderExperience' },
      { lineno: 20 },
      { filename: undefined },
    ]) {
      const event = readerEvent();
      Object.assign(frameFrom(event), change);
      expect(filter(event)).toBe(event);
    }
    const event = readerEvent();
    exceptionFrom(event).stacktrace = { frames: [] };
    expect(filter(event)).toBe(event);
  });

  it('keeps events without document URL or exception evidence', () => {
    const event = readerEvent();
    delete event.request;
    expect(filter(event)).toBe(event);
    expect(filter({ type: undefined })).toEqual({ type: undefined });
  });

  it.each(['not a URL', 'app:///experience/exp-develop-for-good'])(
    'keeps an event with invalid document URL evidence: %s',
    (url) => {
      const event = readerEvent();
      event.request = { url };
      frameFrom(event).filename = url;
      expect(filter(event)).toBe(event);
    },
  );

  it('keeps the update rejection without its injection breadcrumb', () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'UnhandledRejection',
            value:
              'Non-Error promise rejection captured with value: Object Not Found Matching Id:1, MethodName:update, ParamCount:4',
            mechanism: {
              type: 'auto.browser.global_handlers.onunhandledrejection',
              handled: false,
            },
          },
        ],
      },
    };
    expect(filter(event)).toBe(event);
  });
});

describe('installed Sentry browser event pipeline', () => {
  // Load the actual installed Next.js integration: it is internal and has no package export.
  const require = createRequire(import.meta.url);
  const { nextjsClientStackFrameNormalizationIntegration } = require(
    path.join(
      path.dirname(require.resolve('@sentry/nextjs/package.json')),
      'build/cjs/client/clientNormalizationIntegration.js',
    ),
  );

  async function capture(event: ErrorEvent) {
    const sent: unknown[] = [];
    const beforeSend = vi.fn((prepared: ErrorEvent) => filter(prepared));
    const client = new BrowserClient({
      ...buildClientOptions({ optIn: '1' }),
      dsn: 'https://public@example.com/1',
      stackParser: defaultStackParser,
      integrations: [
        eventFiltersIntegration(),
        nextjsClientStackFrameNormalizationIntegration({
          rewriteFramesAssetPrefixPath: '',
          experimentalThirdPartyOriginStackFrames: false,
        }),
        thirdPartyErrorFilterIntegration({
          filterKeys: [SENTRY_APPLICATION_KEY],
          behaviour: 'apply-tag-if-exclusively-contains-third-party-frames',
          ignoreSentryInternalFrames: true,
        }),
      ],
      beforeSend,
      transport: () => ({
        send: async (envelope) => {
          sent.push(envelope);
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    });
    client.init();
    client.captureEvent(event, {}, new Scope());
    expect(await client.close(1_000)).toBe(true);
    return { sent, beforeSend };
  }

  it.each(READER_ERRORS)(
    'tags $type before beforeSend and suppresses its envelope',
    async (signature) => {
      const event = readerEvent(signature);
      delete event.tags;
      const { sent, beforeSend } = await capture(event);
      expect(beforeSend).toHaveBeenCalledOnce();
      expect(beforeSend.mock.calls[0]?.[0].tags?.third_party_code).toBe(true);
      expect(
        beforeSend.mock.calls[0]?.[0].exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename,
      ).toBe('app:///experience/exp-develop-for-good');
      expect(beforeSend.mock.results[0]?.value).toBeNull();
      expect(sent).toHaveLength(0);
    },
  );

  it('sends errors with an application-marked frame', async () => {
    const event = readerEvent();
    delete event.tags;
    framesFrom(event).push({
      filename: APP_URL,
      function: 'renderExperience',
      lineno: 1,
      colno: 40,
      module_metadata: { [`_sentryBundlerPluginAppKey:${SENTRY_APPLICATION_KEY}`]: true },
    });
    const { sent, beforeSend } = await capture(event);
    expect(beforeSend.mock.calls[0]?.[0].tags?.third_party_code).toBeUndefined();
    expect(sent).toHaveLength(1);
  });

  it('does not treat the SDK simulateEvent default as evidence to drop update rejections', async () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'UnhandledRejection',
            value:
              'Non-Error promise rejection captured with value: Object Not Found Matching Id:1, MethodName:update, ParamCount:4',
          },
        ],
      },
    };
    const { sent } = await capture(event);
    expect(sent).toHaveLength(1);
  });

  it.each([1, 2, 3, 4])(
    'suppresses the observed native bridge envelope for object %i',
    async (id) => {
      const { sent, beforeSend } = await capture(nativeBridgeEvent(id));
      expect(beforeSend).toHaveBeenCalledOnce();
      expect(beforeSend.mock.results[0]?.value).toBeNull();
      expect(sent).toHaveLength(0);
    },
  );

  it.each(NATIVE_BRIDGE_PRESERVED_CASES)(
    'sends the native bridge-like event with %s',
    async (_name, change) => {
      const event = nativeBridgeEvent();
      change(event);
      const { sent } = await capture(event);
      expect(sent).toHaveLength(1);
    },
  );
});
