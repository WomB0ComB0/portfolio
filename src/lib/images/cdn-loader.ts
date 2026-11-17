import type { ImageLoaderProps } from 'next/image';

/** Only public image-asset URLs from Sanity; also used for already-decoded gallery previews. */
export function isSanityImageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'cdn.sanity.io' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.startsWith('/images/')
    );
  } catch {
    return false;
  }
}

/** Providers that can size images themselves, without the billed /_next/image relay. */
export function canResizeAtCdn(src: string): boolean {
  try {
    const url = new URL(src);
    return (
      url.protocol === 'https:' &&
      !url.pathname.endsWith('.svg') &&
      !url.username &&
      !url.password &&
      !url.port &&
      ((url.hostname === 'cdn.sanity.io' && url.pathname.startsWith('/images/')) ||
        url.hostname === 'avatars.githubusercontent.com')
    );
  } catch {
    return false;
  }
}

const positiveNumber = (value: string | null): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

/** Retain Studio crop/hotspot parameters and authored size caps while generating a srcset. */
export function cdnImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!canResizeAtCdn(src)) return src;
  const url = new URL(src);
  if (url.hostname === 'avatars.githubusercontent.com') {
    url.searchParams.set('s', String(width));
    return url.href;
  }
  const params = url.searchParams;
  const oldWidth = positiveNumber(params.get('w'));
  const oldHeight = positiveNumber(params.get('h'));
  const nextWidth = Math.min(width, oldWidth ?? width);
  // Scaling just w on a w/h crop would change its aspect ratio. Keep the same crop window.
  if (oldWidth && oldHeight) {
    params.set('h', String(Math.max(1, Math.round((oldHeight * nextWidth) / oldWidth))));
  }
  params.set('w', String(nextWidth));
  params.set('q', String(quality ?? 75));
  if (!params.has('fit')) params.set('fit', 'max');
  if (!params.has('fm')) params.set('auto', 'format');
  return url.href;
}
