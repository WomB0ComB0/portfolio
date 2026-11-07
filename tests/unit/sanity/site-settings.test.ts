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
 * @file The site settings in Studio: one optional-field document opened as a single "Site
 * settings" item at its fixed id, which cannot be created from the "Create" menu, deleted,
 * duplicated or unpublished. Studio refuses every value the site's decoder would drop (so the
 * owner never publishes an edit the home page silently ignores): an address the mailto link
 * cannot carry, a location or tagline of spaces only, a link with credentials.
 *
 * The location is the one field with no built-in value (owner decision: 'Clear the field in
 * Studio to hide it'): Studio lets the owner clear it, and the site takes a location of spaces
 * only, which only the API could still write, as cleared too, keeping the document's other fields.
 *
 * Validation runs Sanity's own validator (@sanity/validation, the version `sanity` ships) on the
 * compiled schema, without a client: the rules are all local. The decoder side runs the site's
 * SiteSettingsDocumentSchema on the same values. The structure is checked with a fake Structure
 * Builder that records the calls structure.ts makes.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ValidationClient, validateDocument } from '@sanity/validation';
import { Either, Schema } from 'effect';
import type { DocumentActionComponent, Template } from 'sanity';
import { createSchema } from 'sanity';
import type { StructureBuilder, StructureResolverContext } from 'sanity/structure';
import { describe, expect, it } from 'vitest';
import { SiteSettingsDocumentSchema } from '@/hooks/sanity/schemas';
import { siteSettingsQuery } from '@/lib/sanity/queries';
import { schema } from '@/sanity/schemaTypes';
import {
  SITE_SETTINGS_ID,
  SITE_SETTINGS_TYPE,
  siteSettingsType,
} from '@/sanity/schemaTypes/site-settings';
import {
  SITE_BLANK_TEXT_MESSAGE,
  SITE_EMAIL_MESSAGE,
  SITE_LOCATION_MAX_LENGTH,
  SITE_TAGLINE_MAX_LENGTH,
} from '@/sanity/site-settings-rules';
import { singletonSafeActions, structure, withoutSingletonTemplates } from '@/sanity/structure';

const studioSchema = createSchema({ name: 'site-settings-test', types: [siteSettingsType] });

/** Never reached: no rule asks Sanity anything. */
const offline = (): never => {
  throw new Error('the site settings rules must not call Sanity');
};

/**
 * Studio runs custom rules only with a client. This one fails any request, so a rule that
 * started asking Sanity would fail here rather than pass unchecked.
 */
const OFFLINE_CLIENT: ValidationClient = {
  fetch: offline,
  getDataUrl: offline,
  request: offline,
  observable: { fetch: offline },
  withConfig: () => OFFLINE_CLIENT,
};

interface Problem {
  readonly path: string;
  readonly code: string;
  readonly level: string;
}

/** What Studio says is wrong with a settings document holding `fields`, in its own words too. */
async function problemsWithMessages(
  fields: Record<string, unknown>,
): Promise<(Problem & { readonly message: string })[]> {
  const { markers } = await validateDocument({
    schema: studioSchema,
    client: OFFLINE_CLIENT,
    document: {
      _id: SITE_SETTINGS_ID,
      _type: SITE_SETTINGS_TYPE,
      _createdAt: '2026-11-06T12:00:00Z',
      _updatedAt: '2026-11-06T12:00:00Z',
      _rev: 'rev-1',
      ...fields,
    },
  });
  return markers.map(({ path, code, level, message }) => ({
    path: path.join('.'),
    code,
    level,
    message,
  }));
}

/** What Studio says is wrong with a settings document holding `fields`. */
async function problemsWith(fields: Record<string, unknown>): Promise<Problem[]> {
  const problems = await problemsWithMessages(fields);
  return problems.map(({ path, code, level }) => ({ path, code, level }));
}

const error = (path: string, code: string): Problem => ({ path, code, level: 'error' });

const FULL = {
  location: 'New York, NY',
  tagline: 'Building web software end to end.',
  email: 'mike@mikeodnis.dev',
  githubUrl: 'https://github.com/WomB0ComB0',
  linkedinUrl: 'https://www.linkedin.com/in/mikeodnis/',
};

describe('the site settings schema in Studio', () => {
  it('accepts a full document, and an empty one: every field is optional', async () => {
    expect(await problemsWith(FULL)).toEqual([]);
    expect(await problemsWith({})).toEqual([]);
  });

  // Clearing a string field in Studio unsets it: the key goes, and Publish must still work.
  it('lets the owner clear the location to hide it, the other fields set', async () => {
    const { location: _cleared, ...rest } = FULL;
    expect(await problemsWith(rest)).toEqual([]);
    expect(await problemsWith({ ...rest, location: undefined })).toEqual([]);
    expect(siteSettingsType.fields.find(({ name }) => name === 'location')?.description).toBe(
      'Optional. Shown after your current role at the top of the home page, in muted text, e.g. "New York, NY". Clear it to hide your location.',
    );
  });

  it(`limits the location to ${SITE_LOCATION_MAX_LENGTH} characters and the tagline to ${SITE_TAGLINE_MAX_LENGTH}`, async () => {
    expect(
      await problemsWith({
        location: 'x'.repeat(SITE_LOCATION_MAX_LENGTH),
        tagline: 'x'.repeat(SITE_TAGLINE_MAX_LENGTH),
      }),
    ).toEqual([]);
    expect(
      await problemsWith({
        location: 'x'.repeat(SITE_LOCATION_MAX_LENGTH + 1),
        tagline: 'x'.repeat(SITE_TAGLINE_MAX_LENGTH + 1),
      }),
    ).toEqual([
      error('location', 'string.maximum-length'),
      error('tagline', 'string.maximum-length'),
    ]);
  });

  it('takes an email address only', async () => {
    expect(await problemsWith({ email: 'mike@' })).toContainEqual(error('email', 'string.email'));
  });

  it.each([
    "o'brien@x.com",
    'a&b@x.com',
    'a/b@x.com',
    'a=b@x.com',
    'mike?cc=x@a.com',
    'mike@mikeodnis.dev#x',
  ])('refuses %s, which a mailto link cannot carry, with the rule in words', async (email) => {
    const problems = await problemsWithMessages({ email });

    expect(problems).toContainEqual({
      ...error('email', 'custom.site-email'),
      message: SITE_EMAIL_MESSAGE,
    });
  });

  it.each([
    ['location', '   '],
    ['tagline', ' \n\t '],
    ['location', ''],
    ['location', ' \n '],
  ])('refuses a %s of spaces only: clear the field instead', async (field, value) => {
    expect(await problemsWithMessages({ [field]: value })).toEqual([
      { ...error(field, 'custom.site-text-blank'), message: SITE_BLANK_TEXT_MESSAGE },
    ]);
  });

  it('refuses a link with a user name or password, as the site does', async () => {
    const problems = await problemsWith({
      githubUrl: 'https://user:secret@github.com/WomB0ComB0',
      linkedinUrl: 'https://someone@www.linkedin.com/in/mikeodnis/',
    });

    expect(problems).toEqual([
      error('githubUrl', 'string.url.credentials-not-allowed'),
      error('linkedinUrl', 'string.url.credentials-not-allowed'),
    ]);
  });

  it('takes https links only, for GitHub and LinkedIn', async () => {
    expect(
      await problemsWith({
        githubUrl: 'http://github.com/WomB0ComB0',
        linkedinUrl: 'ftp://www.linkedin.com/in/mikeodnis/',
      }),
    ).toEqual([
      error('githubUrl', 'string.url.scheme-not-allowed'),
      error('linkedinUrl', 'string.url.scheme-not-allowed'),
    ]);
    const [relative] = await problemsWith({ githubUrl: '/WomB0ComB0' });
    expect(relative).toMatchObject({ path: 'githubUrl', level: 'error' });
  });

  it('says where on the site each field appears, and what leaving it empty does', () => {
    expect(siteSettingsType.fields.map(({ name }) => name)).toEqual([
      'location',
      'tagline',
      'email',
      'githubUrl',
      'linkedinUrl',
    ]);
    for (const field of siteSettingsType.fields) {
      expect(field.description, field.name).toMatch(/home page/);
      // The location has no built-in value to fall back to: clearing it hides it.
      expect(field.description, field.name).toMatch(
        field.name === 'location'
          ? /^Optional\..*Clear it to hide your location\.$/
          : /Leave it empty/,
      );
    }
    const location = siteSettingsType.fields[0]?.description ?? '';
    expect(location).not.toMatch(/capitals|beside your avatar|built-in/);
  });

  it('is registered in the Studio schema', () => {
    expect(schema.types).toContain(siteSettingsType);
  });

  it('runs on a validator package.json declares, released with sanity', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(manifest.devDependencies?.['@sanity/validation']).toMatch(/^\^?6\./);
    expect(manifest.dependencies?.sanity).toMatch(/^\^?6\./);
  });

  it("matches the site's query: same type and id", () => {
    expect(siteSettingsType.name).toBe('siteSettings');
    expect(siteSettingsQuery).toContain(
      `_type == "${SITE_SETTINGS_TYPE}" && _id == "${SITE_SETTINGS_ID}"`,
    );
  });
});

/** Values for each field: good ones, and every kind the site's decoder drops. */
const CANDIDATES: Record<keyof typeof FULL, readonly string[]> = {
  location: [
    'New York, NY',
    '  Brooklyn  ',
    '',
    '   ',
    '\n',
    'x'.repeat(SITE_LOCATION_MAX_LENGTH),
    'x'.repeat(SITE_LOCATION_MAX_LENGTH + 1),
  ],
  tagline: [
    'Building web software end to end.',
    ' \t ',
    'x'.repeat(SITE_TAGLINE_MAX_LENGTH),
    'x'.repeat(SITE_TAGLINE_MAX_LENGTH + 1),
  ],
  email: [
    'mike@mikeodnis.dev',
    'first.last+tag@sub.example.co',
    "o'brien@x.com",
    'a&b@x.com',
    'a/b@x.com',
    'a=b@x.com',
    'mike?cc=x@a.com',
    'mike@x.com#top',
    'mike@localhost',
    'mike@',
    'ünï@example.com',
    `${'a'.repeat(250)}@x.com`,
    '  ',
  ],
  githubUrl: [
    'https://github.com/WomB0ComB0',
    'http://github.com/WomB0ComB0',
    'https://user:secret@github.com/WomB0ComB0',
    'https://user@github.com/WomB0ComB0',
    '/WomB0ComB0',
    'javascript:alert(1)',
    'github.com/WomB0ComB0',
  ],
  linkedinUrl: [
    'https://www.linkedin.com/in/mikeodnis/',
    'ftp://www.linkedin.com/in/mikeodnis/',
    'https://:pw@www.linkedin.com/in/mikeodnis/',
  ],
};

const decodeSettings = Schema.decodeUnknownEither(SiteSettingsDocumentSchema);

/** True when the site's decoder keeps `field` = `value`. */
const siteKeeps = (field: string, value: string): boolean => {
  const decoded = decodeSettings({
    _id: SITE_SETTINGS_ID,
    _type: SITE_SETTINGS_TYPE,
    [field]: value,
  });
  return Either.isRight(decoded) && field in decoded.right;
};

/** True when Studio lets `field` = `value` be published (no error on the field). */
const studioPublishes = async (field: string, value: string): Promise<boolean> =>
  (await problemsWith({ [field]: value })).every((problem) => problem.level !== 'error');

describe('Studio and the site agree', () => {
  it.each(
    Object.entries(CANDIDATES).flatMap(([field, values]) =>
      values.map((value) => [field, value] as const),
    ),
  )('Studio publishes %s = %j only when the site keeps it', async (field, value) => {
    expect(await studioPublishes(field, value)).toBe(siteKeeps(field, value));
  });

  it.each(['', '   ', ' \n\t '])(
    'the site takes a location of %j as cleared, and keeps the other fields',
    (location) => {
      const decoded = decodeSettings({
        _id: SITE_SETTINGS_ID,
        _type: SITE_SETTINGS_TYPE,
        ...FULL,
        location,
      });

      expect(Either.isRight(decoded)).toBe(true);
      const { location: _absent, ...rest } = FULL;
      expect(Either.getOrNull(decoded)).toStrictEqual({
        _id: SITE_SETTINGS_ID,
        _type: SITE_SETTINGS_TYPE,
        ...rest,
      });
    },
  );

  it('still takes a tagline of spaces only as invalid: it has a built-in value to fall back to', () => {
    expect(
      Either.isLeft(
        decodeSettings({ _id: SITE_SETTINGS_ID, _type: SITE_SETTINGS_TYPE, tagline: '  ' }),
      ),
    ).toBe(true);
  });

  it('errs on the strict side for length: Studio counts the spaces the site trims', async () => {
    const padded = ` ${'x'.repeat(SITE_LOCATION_MAX_LENGTH)} `;

    expect(siteKeeps('location', padded)).toBe(true);
    expect(await studioPublishes('location', padded)).toBe(false);
  });
});

/** Unwraps what the fake builder recorded. */
const NODE = Symbol('recorded node');

type Recorded = Record<string, unknown>;

/**
 * A fake builder of `kind`: every method call records its argument under the method's name and
 * returns the builder, so chains work; `getId` answers the recorded id.
 */
function recorder(kind: string, init: Recorded = {}): unknown {
  const node: Recorded = { kind, ...init };
  const builder: unknown = new Proxy(node, {
    get: (target, property) => {
      if (property === NODE) return target;
      if (property === 'getId') return () => target.id;
      return (value: unknown) => {
        target[String(property)] = value;
        return builder;
      };
    },
  });
  return builder;
}

/** What `value` recorded, as plain data, with every nested builder unwrapped. */
function recorded(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(recorded);
  if (typeof value !== 'object' || value === null) return value;
  const node = (value as { [NODE]?: Recorded })[NODE] ?? (value as Recorded);
  return Object.fromEntries(Object.entries(node).map(([key, field]) => [key, recorded(field)]));
}

/** A Structure Builder whose generated lists are one per type in `typeNames`. */
const fakeStructureBuilder = (typeNames: readonly string[]): StructureBuilder =>
  ({
    list: () => recorder('list'),
    listItem: () => recorder('listItem'),
    document: () => recorder('document'),
    divider: () => ({ kind: 'divider' }),
    documentTypeListItems: () => typeNames.map((id) => recorder('typeList', { id })),
  }) as unknown as StructureBuilder;

describe('the Studio structure', () => {
  it('opens the site settings as one item, its fixed-id document, above the other lists', () => {
    const S = fakeStructureBuilder(['project', SITE_SETTINGS_TYPE, 'place']);

    const content = structure(S, {} as StructureResolverContext);

    expect(recorded(content)).toEqual({
      kind: 'list',
      title: 'Content',
      items: [
        {
          kind: 'listItem',
          title: 'Site settings',
          id: SITE_SETTINGS_ID,
          schemaType: SITE_SETTINGS_TYPE,
          child: {
            kind: 'document',
            schemaType: SITE_SETTINGS_TYPE,
            documentId: SITE_SETTINGS_ID,
            title: 'Site settings',
          },
        },
        { kind: 'divider' },
        { kind: 'typeList', id: 'project' },
        { kind: 'typeList', id: 'place' },
      ],
    });
  });

  it('leaves the site settings out of the "Create" menu', () => {
    const template = (schemaType: string): Template =>
      ({ id: schemaType, schemaType, title: schemaType, value: {} }) as Template;
    const templates = [template('project'), template(SITE_SETTINGS_TYPE), template('place')];

    expect(withoutSingletonTemplates(templates).map(({ id }) => id)).toEqual(['project', 'place']);
  });

  it('lets the site settings publish and discard edits only, and other types do anything', () => {
    const action = (name: DocumentActionComponent['action']): DocumentActionComponent =>
      Object.assign(() => null, { action: name });
    const actions = [
      action('publish'),
      action('discardChanges'),
      action('unpublish'),
      action('duplicate'),
      action('delete'),
      action('restore'),
      action(undefined),
    ];

    const forSettings = singletonSafeActions(actions, { schemaType: SITE_SETTINGS_TYPE });

    expect(forSettings.map(({ action: name }) => name)).toEqual([
      'publish',
      'discardChanges',
      'restore',
    ]);
    expect(singletonSafeActions(actions, { schemaType: 'project' })).toEqual(actions);
  });

  it('is what the Studio config uses, with the singleton guards', async () => {
    const { default: config } = (await import('../../../sanity.config')) as unknown as {
      default: {
        schema: { types: unknown[]; templates: unknown };
        document: { actions: unknown };
      };
    };

    expect(config.schema.types).toContain(siteSettingsType);
    expect(config.schema.templates).toBe(withoutSingletonTemplates);
    expect(config.document.actions).toBe(singletonSafeActions);
  });
});
