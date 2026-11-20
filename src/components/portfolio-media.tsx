/**
 * Copyright 2026 Mike Odnis
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

import type { CSSProperties, ReactElement } from 'react';
import CdnImage from '@/components/ui/cdn-image';
import { type PortfolioMediaItem, portfolioMediaOf } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';

type MediaImage = Extract<PortfolioMediaItem, { _type: 'portfolioPhoto' }>['image'];

/** Building from the asset keeps the full screenshot visible, independent of a Studio crop. */
function imageUrl(image: MediaImage | undefined, width?: number): string | undefined {
  if (!image) return undefined;
  try {
    const builder = urlFor(image.asset).auto('format');
    return (width ? builder.width(width).fit('max') : builder).url();
  } catch {
    return undefined;
  }
}

/** A Sanity image asset id carries the original's size: `image-<hash>-<w>x<h>-<format>`. */
const ASSET_SIZE = /^image-[A-Za-z0-9]+-(\d+)x(\d+)-[a-z0-9]+$/u;
/** The shape a frame takes when its media has no readable size: 16:9. */
const DEFAULT_SIZE = { width: 1280, height: 720 } as const;

interface MediaSize {
  readonly width: number;
  readonly height: number;
}

/** The poster's or photo's own size, from its asset id; 16:9 without one. */
export function mediaSizeOf(image: MediaImage | undefined): MediaSize {
  const match = ASSET_SIZE.exec(image?.asset._ref ?? '');
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  return width > 0 && height > 0 ? { width, height } : DEFAULT_SIZE;
}

/** The frame's shape as a CSS variable, set in the server HTML, so nothing moves on load. */
const frameStyle = ({ width, height }: MediaSize): CSSProperties =>
  ({ '--media-aspect': Math.round((width / height) * 10_000) / 10_000 }) as CSSProperties;

/**
 * Each frame takes its media's own shape, never taller than min(36rem, 75svh): a phone-shaped
 * walkthrough narrows to that height instead of shrinking into a 16:9 box, and a wide one fills
 * the column. Both sides come from the shape, so the box is sized before anything loads.
 */
const FRAME =
  'relative block aspect-(--media-aspect) w-[min(100%,calc(min(36rem,75svh)*var(--media-aspect)))] overflow-hidden rounded-lg border border-hairline bg-surface-1';
const LINK =
  'rounded-sm text-body-sm text-muted-foreground underline underline-offset-4 [overflow-wrap:anywhere] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus)';

function Preview({ src, alt }: { readonly src: string; readonly alt: string }): ReactElement {
  return (
    <CdnImage
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 640px"
      className="object-contain"
      loading="lazy"
    />
  );
}

/** Native controls work without client JavaScript; full-image and watch links are ordinary anchors. */
function MediaFigure({ item }: { readonly item: PortfolioMediaItem }): ReactElement | null {
  if (item._type === 'portfolioPhoto') {
    const full = imageUrl(item.image);
    const preview = imageUrl(item.image, 1200);
    if (!full || !preview) return null;
    return (
      <figure className="min-w-0 space-y-3">
        <a
          href={full}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${item.alt} — open full image (new tab)`}
          data-media-frame=""
          style={frameStyle(mediaSizeOf(item.image))}
          className={`${FRAME} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus)`}
        >
          <Preview src={preview} alt={item.alt} />
        </a>
        {item.caption ? (
          <figcaption className="text-body-sm text-muted-foreground [overflow-wrap:anywhere]">
            {item.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  const poster = imageUrl(item.poster, 1200);
  const file = item.file;
  const size = mediaSizeOf(poster ? item.poster : undefined);
  return (
    <figure className="min-w-0 space-y-3">
      {file ? (
        <>
          {/* biome-ignore lint/a11y/useMediaCaption: Authored WebVTT is optional for silent walkthroughs and rendered below when supplied. */}
          <video
            aria-label={item.title}
            controls
            playsInline
            preload="none"
            poster={poster}
            width={size.width}
            height={size.height}
            data-media-frame=""
            style={frameStyle(size)}
            className={`${FRAME} h-auto object-contain`}
          >
            <source
              src={file.url}
              type={
                file.mimeType ??
                (new URL(file.url).pathname.endsWith('.mp4') ? 'video/mp4' : 'video/webm')
              }
            />
            {item.captionsFile ? (
              <track
                kind="captions"
                src={item.captionsFile.url.replace(
                  /^https:\/\/cdn\.sanity\.io\/files\//u,
                  '/assets/sanity-files/',
                )}
                srcLang={item.captionsLanguage}
                label={item.captionsLabel}
              />
            ) : null}
            Your browser does not support inline video. Use the link below to watch it.
          </video>
          <a
            className={`${LINK} inline-block min-h-11 py-2`}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open video: {item.title}
            <span className="sr-only"> (new tab)</span>
          </a>
        </>
      ) : (
        <a
          className={`${LINK} block min-h-11 space-y-3`}
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {poster ? (
            <span data-media-frame="" style={frameStyle(size)} className={FRAME}>
              <Preview src={poster} alt="" />
            </span>
          ) : null}
          <span className="block">
            Watch: {item.title}
            <span className="sr-only"> (new tab)</span>
          </span>
        </a>
      )}
      {item.caption ? (
        <figcaption className="text-body-sm text-muted-foreground [overflow-wrap:anywhere]">
          {item.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export interface PortfolioMediaProps {
  readonly id: string;
  readonly media?: readonly PortfolioMediaItem[] | null;
  readonly title?: string;
  readonly headingLevel?: 2 | 4;
}

/** An optional server-rendered detail section. Invalid entries cannot break their owner. */
export function PortfolioMedia({
  id,
  media,
  title = 'Photos and videos',
  headingLevel = 2,
}: PortfolioMediaProps): ReactElement | null {
  const items = portfolioMediaOf(media);
  if (items.length === 0) return null;
  const Heading = headingLevel === 4 ? 'h4' : 'h2';
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-portfolio-media=""
      className="flex min-w-0 flex-col gap-4"
    >
      <Heading
        id={`${id}-title`}
        className="border-b border-hairline-strong pb-2 tile-title text-foreground"
      >
        {title}
      </Heading>
      <div className="grid min-w-0 grid-cols-1 gap-6 @min-[48rem]/page:grid-cols-2">
        {items.map((item) => (
          <MediaFigure key={item._key} item={item} />
        ))}
      </div>
    </section>
  );
}
