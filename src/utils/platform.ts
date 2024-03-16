/* eslint-disable @typescript-eslint/no-explicit-any */
export const isIOS = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
export const isAndroid = (): boolean => /android/i.test(navigator.userAgent);
export const isMacOS = (): boolean => /Macintosh|Mac|Mac OS|MacIntel|MacPPC|Mac68K/gi.test(navigator.userAgent);
export const isWindows = (): boolean => /Win32|Win64|Windows|Windows NT|WinCE/gi.test(navigator.userAgent);
export const isChromeOS = (): boolean => /CrOS/gi.test(navigator.userAgent);

export const getBrowser = (): string => {
  const { userAgent } = navigator;

  return userAgent.match(/edg/i) ? 'edge' :
    userAgent.match(/chrome|chromium|crios/i) ? 'chrome' :
    userAgent.match(/firefox|fxios/i) ? 'firefox' :
    userAgent.match(/safari/i) ? 'safari' :
    userAgent.match(/opr\//i) ? 'opera' :
    userAgent.match(/android/i) ? 'android' :
    userAgent.match(/iphone/i) ? 'iphone' : 'unknown';
}

export const getPlatform = (): string => {
  return isIOS() ? 'ios' :
    isAndroid() ? 'android' :
    isMacOS() ? 'macos' :
    isChromeOS() ? 'chromeos' :
    isWindows() ? 'windows' : 'unknown';
}

export const isTouchScreen = (): boolean => {
  return navigator.maxTouchPoints && navigator.maxTouchPoints > 0 ||
    window.matchMedia && window.matchMedia("(any-pointer:coarse)").matches;
};

export const isChrome = (): boolean => getBrowser() === 'chrome';
export const isFirefox = (): boolean => getBrowser() === 'firefox';
export const isSafari = (): boolean => getBrowser() === 'safari';
export const isOpera = (): boolean => getBrowser() === 'opera';
export const isEdge = (): boolean => getBrowser() === 'edge';
export const isIOSSafari = (): boolean => getBrowser() === 'safari' && isIOS();
export const isIOSChrome = (): boolean => getBrowser() === 'chrome' && isIOS();
export const isAndroidChrome = (): boolean => getBrowser() === 'chrome' && isAndroid();
export const isMacOSChrome = (): boolean => getBrowser() === 'chrome' && isMacOS();
export const isWindowsChrome = (): boolean => getBrowser() === 'chrome' && isWindows();
export const isIOSFirefox = (): boolean => getBrowser() === 'firefox' && isIOS();
export const isAndroidFirefox = (): boolean => getBrowser() === 'firefox' && isAndroid();
export const isIOSEdge = (): boolean => getBrowser() === 'edge' && isIOS();
export const isAndroidEdge = (): boolean => getBrowser() === 'edge' && isAndroid();
export const isMacOSEdge = (): boolean => getBrowser() === 'edge' && isMacOS();
export const isWindowsEdge = (): boolean => getBrowser() === 'edge' && isWindows();
export const isIOSOpera = (): boolean => getBrowser() === 'opera' && isIOS();
export const isAndroidOpera = (): boolean => getBrowser() === 'opera' && isAndroid();
