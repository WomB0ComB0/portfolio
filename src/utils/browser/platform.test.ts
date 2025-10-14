import { describe, it, expect, vi } from 'vitest';
import {
  isIOS,
  isAndroid,
  isMacOS,
  isWindows,
  isChromeOS,
  getBrowser,
  getPlatform,
  isTouchScreen,
  isChrome,
  isFirefox,
  isSafari,
  isOpera,
  isEdge,
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
});

describe('getPlatform', () => {
  it('should return the correct platform', () => {
    setUserAgent('iPhone');
    expect(getPlatform()).toBe('ios');
  });
});

describe('isTouchScreen', () => {
  it('should detect touch screen capabilities', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      writable: true,
    });
    expect(isTouchScreen()).toBe(true);
  });
});
