import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Image from '@/components/ui/cdn-image';
import { cdnImageLoader, isSanityImageUrl } from '@/lib/images/cdn-loader';
import { buildContentSecurityPolicy } from '@/lib/security/csp';

const asset =
  'https://cdn.sanity.io/images/34jrnkds/production/d2afa1c91463761d139db9cc4aab7e803f0f54fa-4080x3072.jpg';
const url = (src: string, width = 640) => new URL(cdnImageLoader({ src, width, quality: 75 }));

describe('direct CDN image delivery', () => {
  it.each([
    'https://user:pass@cdn.sanity.io/images/a/b/c.jpg',
    'http://cdn.sanity.io/images/a/b/c.jpg',
    'https://cdn.sanity.io.evil.test/images/a/b/c.jpg',
  ])('rejects untrusted preview source %s', (src) => {
    expect(isSanityImageUrl(src)).toBe(false);
  });
  it('serves the reported photo responsively from Sanity without the failing optimizer', () => {
    const html = renderToString(
      <Image src={`${asset}?h=1200&fit=max`} alt="Visit" width={1200} height={900} sizes="100vw" />,
    );
    expect(html).not.toContain('/_next/image');
    const container = document.createElement('div');
    container.innerHTML = html;
    const img = container.querySelector('img');
    if (!img) throw new Error('Expected a rendered image');
    expect(img.getAttribute('srcset')).toContain('640w');
    const src = new URL(img.src);
    expect(src.hostname).toBe('cdn.sanity.io');
    expect(src.searchParams.get('auto')).toBe('format');
    expect(src.searchParams.get('fit')).toBe('max');
    expect(src.searchParams.get('h')).toBe('1200');
  });
  it('preserves authored crops and scales both output dimensions together', () => {
    const src = url(`${asset}?rect=0,100,4080,2040&w=1200&h=600&fit=crop`, 640);
    expect(src.searchParams.get('rect')).toBe('0,100,4080,2040');
    expect(src.searchParams.get('w')).toBe('640');
    expect(src.searchParams.get('h')).toBe('320');
    expect(src.searchParams.get('fit')).toBe('crop');
  });
  it('keeps portrait fit-max photos whole and respects their height cap', () => {
    const src = url(`${asset}?h=1200&fit=max`, 320);
    expect(src.searchParams.get('w')).toBe('320');
    expect(src.searchParams.get('h')).toBe('1200');
    expect(src.searchParams.has('rect')).toBe(false);
  });
  it('does not exceed an existing width cap or add a second quality parameter', () => {
    const src = url(`${asset}?w=320&h=240&fit=crop&q=90`, 2048);
    expect(src.searchParams.get('w')).toBe('320');
    expect(src.searchParams.get('h')).toBe('240');
    expect(src.searchParams.getAll('q')).toEqual(['75']);
  });
  it('keeps explicit format choices and unrelated transformation parameters', () => {
    const src = url(`${asset}?w=1200&fm=png&sat=-100`);
    expect(src.searchParams.get('fm')).toBe('png');
    expect(src.searchParams.get('sat')).toBe('-100');
  });
  it('uses GitHub avatar sizing directly', () => {
    const src = url('https://avatars.githubusercontent.com/u/95197809?v=4', 96);
    expect(src.searchParams.get('s')).toBe('96');
    expect(src.searchParams.get('v')).toBe('4');
  });
  it.each([
    `${asset.replace('.jpg', '.svg')}`,
    '/assets/images/logo.webp',
    'https://i.scdn.co/image/abc',
    'https://cdn.sanity.io.evil.test/photo.jpg',
  ])('serves %s directly without inventing provider parameters', (src) => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Image src={src} alt="Image" width={64} height={64} />);
    const img = container.querySelector('img');
    if (!img) throw new Error('Expected a rendered image');
    expect(img.getAttribute('src')).toBe(src);
    expect(img.hasAttribute('srcset')).toBe(false);
  });
  it('allows direct CDN images in enforced CSP without allowing arbitrary HTTPS hosts', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'test', isDev: false, mode: 'enforce' });
    const images =
      policy
        .split('; ')
        .find((x) => x.startsWith('img-src '))
        ?.split(' ') ?? [];
    expect(images).toContain('https://cdn.sanity.io');
    expect(images).toContain('https://avatars.githubusercontent.com');
    expect(images).toContain('https://i.scdn.co');
    expect(images).not.toContain('https:');
    expect(images).not.toContain('*');
  });
});
