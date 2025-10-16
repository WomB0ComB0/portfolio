import { describe, expect, it, vi } from 'vitest';
import {
  getBrowser,
  getPlatform,
  isAndroid,
  isChrome,
  isChromeOS,
  isEdge,
  isFirefox,
  isIOS,
  isMacOS,
  isOpera,
  isSafari,
  isTouchScreen,
  isWindows,
} from './platform';

const setUserAgent = (userAgent: string) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
};

describe('Platform Detection', () => {
  it('should detect iOS', () => {
    setUserAgent('iPhone');
    expect(isIOS()).toBe(true);
  });

  it('should detect Android', () => {
    setUserAgent('Android');
    expect(isAndroid()).toBe(true);
  });

  it('should detect MacOS', () => {
    setUserAgent('Macintosh');
    expect(isMacOS()).toBe(true);
  });

  it('should detect Windows', () => {
    setUserAgent('Windows');
    expect(isWindows()).toBe(true);
  });

  it('should detect ChromeOS', () => {
    setUserAgent('CrOS');
    expect(isChromeOS()).toBe(true);
  });
});

describe('Browser Detection', () => {
  it('should detect Chrome', () => {
    setUserAgent('Chrome');
    expect(getBrowser()).toBe('chrome');
    expect(isChrome()).toBe(true);
  });

  it('should detect Firefox', () => {
    setUserAgent('Firefox');
    expect(getBrowser()).toBe('firefox');
    expect(isFirefox()).toBe(true);
  });

  it('should detect Safari', () => {
    setUserAgent('Safari');
    expect(getBrowser()).toBe('safari');
    expect(isSafari()).toBe(true);
  });

  it('should detect Opera', () => {
    setUserAgent('OPR/');
    expect(getBrowser()).toBe('opera');
    expect(isOpera()).toBe(true);
  });

  it('should detect Edge', () => {
    setUserAgent('Edg');
    expect(getBrowser()).toBe('edge');
    expect(isEdge()).toBe(true);
  });

  it('should return "unknown" for an unknown browser', () => {
    setUserAgent('unknown');
    expect(getBrowser()).toBe('unknown');
  });
});

describe('getPlatform', () => {
  it('should return the correct platform', () => {
    setUserAgent('iPhone');
    expect(getPlatform()).toBe('ios');
  });

  it('should return "unknown" for an unknown platform', () => {
    setUserAgent('unknown');
    expect(getPlatform()).toBe('unknown');
  });
});

describe('isTouchScreen', () => {
  it('should detect touch screen capabilities via maxTouchPoints', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      writable: true,
    });
    expect(isTouchScreen()).toBe(true);
  });

  it('should detect touch screen capabilities via matchMedia', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      writable: true,
    });
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(any-pointer:coarse)',
    }));
    expect(isTouchScreen()).toBe(true);
  });
});
