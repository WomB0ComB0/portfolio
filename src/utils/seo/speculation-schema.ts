'use client';

/**
 * Supported Schema.org types for structured data generation.
 * @public
 * @readonly
 * @see https://schema.org/docs/full.html
 * @author Mike Odnis
 * @version 1.0.0
 */
type SchemaType = 'NewsArticle' | 'WebPage' | 'Organization' | 'Article' | 'BlogPosting';

/**
 * Describes the options for generating a Schema.org JSON-LD object.
 *
 * @public
 * @see https://schema.org/docs/schemas.html
 * @author Mike Odnis
 * @version 1.0.0
 */
interface SchemaProps {
  /**
   * The Schema.org type for the object.
   * @type {SchemaType}
   * @readonly
   */
  type: SchemaType;
  /**
   * Headline for articles or news pieces.
   * @type {string}
   * @readonly
   */
  headline?: string;
  /**
   * Canonical URL for the schema.
   * @type {string}
   * @readonly
   */
  url: string;
  /**
   * Thumbnail URL as a URL object.
   * @type {URL}
   * @readonly
   */
  thumbnailUrl?: URL;
  /**
   * Date the item was published (ISO string).
   * @type {string}
   * @readonly
   */
  datePublished?: string;
  /**
   * Section in which the article appears.
   * @type {string}
   * @readonly
   */
  articleSection?: string;
  /**
   * Creator(s) of the content.
   * @type {string | string[]}
   * @readonly
   */
  creator?: string | string[];
  /**
   * Keywords associated with the content.
   * @type {string[]}
   * @readonly
   */
  keywords?: string[];
  /**
   * Name of the entity (for Organization, etc.).
   * @type {string}
   * @readonly
   */
  name?: string;
  /**
   * Logo URL as a URL object.
   * @type {URL}
   * @readonly
   */
  logo?: URL;
  /**
   * Additional URLs related to the entity (social media, etc.).
   * @type {string[]}
   * @readonly
   */
  sameAs?: string[];
}

/**
 * Generates a Schema.org compatible JSON-LD object for SEO, based on the given properties.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 *
 * @param {SchemaProps} props - The properties describing the schema entity.
 * @returns {Record<string, unknown>} The resulting Schema.org JSON-LD object.
 * @throws {TypeError} Throws if required fields like 'type' or 'url' are missing or invalid.
 *
 * @example
 * // Basic usage for an article schema:
 * const schema = generateSchema({
 *   type: 'Article',
 *   headline: 'Understanding TypeScript',
 *   url: 'https://example.com/article/typescript',
 *   datePublished: '2024-05-01T12:00:00Z',
 *   creator: ['WomB0ComB0'],
 *   keywords: ['TypeScript', 'Programming'],
 * });
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
 * @see https://schema.org
 */
export const generateSchema = (props: SchemaProps): Record<string, unknown> => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': props.type,
    ...(props.headline && { headline: props.headline }),
    url: props.url,
    ...(props.thumbnailUrl && { thumbnailUrl: props.thumbnailUrl }),
    ...(props.datePublished && { datePublished: props.datePublished }),
    ...(props.articleSection && { articleSection: props.articleSection }),
    ...(props.creator && { creator: props.creator }),
    ...(props.keywords && { keywords: props.keywords }),
    ...(props.name && { name: props.name }),
    ...(props.logo && { logo: props.logo }),
    ...(props.sameAs && { sameAs: props.sameAs }),
  };

  return schema;
};
