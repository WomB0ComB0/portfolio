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
 * Detects if the current user agent is an iOS device (iPad, iPhone, iPod).
 *
 * @returns {boolean} True if the platform is iOS, otherwise false.
 * @web
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
 * @version 1.0.0
 * @example
 * if (isIOS()) { console.log('Running on iOS'); }
 */
export const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

/**
 * Detects if the current user agent is an Android device.
 *
 * @returns {boolean} True if the platform is Android, otherwise false.
 * @web
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
 * @version 1.0.0
 * @example
 * if (isAndroid()) { console.log('Running on Android'); }
 */
export const isAndroid = (): boolean => /android/i.test(navigator.userAgent);

/**
 * Detects if the current user agent is a macOS device.
 *
 * @returns {boolean} True if the platform is macOS, otherwise false.
 * @web
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
 * @version 1.0.0
 * @example
 * if (isMacOS()) { console.log('Running on macOS'); }
 */
export const isMacOS = (): boolean =>
  /Macintosh|Mac|Mac OS|MacIntel|MacPPC|Mac68K/gi.test(navigator.userAgent);

/**
 * Detects if the current user agent is a Windows device.
 *
 * @returns {boolean} True if the platform is Windows, otherwise false.
 * @web
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
 * @version 1.0.0
 * @example
 * if (isWindows()) { console.log('Running on Windows'); }
 */
export const isWindows = (): boolean =>
  /Win32|Win64|Windows|Windows NT|WinCE/gi.test(navigator.userAgent);

/**
 * Detects if the current user agent is Chrome OS.
 *
 * @returns {boolean} True if the platform is Chrome OS, otherwise false.
 * @web
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
 * @version 1.0.0
 * @example
 * if (isChromeOS()) { console.log('Running on Chrome OS'); }
 */
export const isChromeOS = (): boolean => /CrOS/gi.test(navigator.userAgent);

/**
 * Retrieves the browser name based on the user agent string.
 *
 * @returns {string} The browser name: 'edge', 'chrome', 'firefox', 'safari', 'opera', 'android', 'iphone', or 'unknown'.
 * @web
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
 * @version 1.0.0
 * @throws {TypeError} Throws if navigator.userAgent is not accessible.
 * @example
 * const browser = getBrowser(); // 'chrome', 'firefox', etc.
 */
export const getBrowser = (): string => {
  const { userAgent } = navigator;

  return userAgent.match(/edg/i)
    ? 'edge'
    : userAgent.match(/chrome|chromium|crios/i)
      ? 'chrome'
      : userAgent.match(/firefox|fxios/i)
        ? 'firefox'
        : userAgent.match(/safari/i)
          ? 'safari'
          : userAgent.match(/opr\//i)
            ? 'opera'
            : userAgent.match(/android/i)
              ? 'android'
              : userAgent.match(/iphone/i)
                ? 'iphone'
                : 'unknown';
};

/**
 * Determines the device platform as a string: 'ios', 'android', 'macos', 'chromeos', 'windows', or 'unknown'.
 *
 * @returns {string} The detected platform.
 * @web
 * @author Mike Odnis
 * @see isIOS
 * @see isAndroid
 * @see isMacOS
 * @see isChromeOS
 * @see isWindows
 * @version 1.0.0
 * @example
 * const platform = getPlatform(); // 'android', 'ios', etc.
 */
export const getPlatform = (): string => {
  return isIOS()
    ? 'ios'
    : isAndroid()
      ? 'android'
      : isMacOS()
        ? 'macos'
        : isChromeOS()
          ? 'chromeos'
          : isWindows()
            ? 'windows'
            : 'unknown';
};

/**
 * Checks if the current device has a touchscreen capability.
 *
 * @returns {boolean} True if touch screen is supported, otherwise false.
 * @web
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/maxTouchPoints
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
 * @version 1.0.0
 * @example
 * if (isTouchScreen()) { console.log('Device supports touch.'); }
 */
export const isTouchScreen = (): boolean => {
  return (
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    window.matchMedia?.('(any-pointer:coarse)').matches
  );
};

/**
 * Determines if the current browser is Google Chrome.
 *
 * @returns {boolean} True if Chrome, otherwise false.
 * @web
 * @author Mike Odnis
 * @see getBrowser
 * @version 1.0.0
 */
export const isChrome = (): boolean => getBrowser() === 'chrome';

/**
 * Determines if the current browser is Mozilla Firefox.
 *
 * @returns {boolean} True if Firefox, otherwise false.
 * @web
 * @author Mike Odnis
 * @see getBrowser
 * @version 1.0.0
 */
export const isFirefox = (): boolean => getBrowser() === 'firefox';

/**
 * Determines if the current browser is Safari.
 *
 * @returns {boolean} True if Safari, otherwise false.
 * @web
 * @author Mike Odnis
 * @see getBrowser
 * @version 1.0.0
 */
export const isSafari = (): boolean => getBrowser() === 'safari';

/**
 * Determines if the current browser is Opera.
 *
 * @returns {boolean} True if Opera, otherwise false.
 * @web
 * @author Mike Odnis
 * @see getBrowser
 * @version 1.0.0
 */
export const isOpera = (): boolean => getBrowser() === 'opera';

/**
 * Determines if the current browser is Microsoft Edge.
 *
 * @returns {boolean} True if Edge, otherwise false.
 * @web
 * @author Mike Odnis
 * @see getBrowser
 * @version 1.0.0
 */
export const isEdge = (): boolean => getBrowser() === 'edge';

/**
 * Detects Safari running on iOS devices.
 *
 * @returns {boolean} True if iOS Safari, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isIOS
 * @see isSafari
 * @version 1.0.0
 */
export const isIOSSafari = (): boolean => getBrowser() === 'safari' && isIOS();

/**
 * Detects Chrome running on iOS devices.
 *
 * @returns {boolean} True if iOS Chrome, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isIOS
 * @see isChrome
 * @version 1.0.0
 */
export const isIOSChrome = (): boolean => getBrowser() === 'chrome' && isIOS();

/**
 * Detects Chrome running on Android devices.
 *
 * @returns {boolean} True if Android Chrome, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isAndroid
 * @see isChrome
 * @version 1.0.0
 */
export const isAndroidChrome = (): boolean => getBrowser() === 'chrome' && isAndroid();

/**
 * Detects Chrome running on macOS devices.
 *
 * @returns {boolean} True if macOS Chrome, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isMacOS
 * @see isChrome
 * @version 1.0.0
 */
export const isMacOSChrome = (): boolean => getBrowser() === 'chrome' && isMacOS();

/**
 * Detects Chrome running on Windows devices.
 *
 * @returns {boolean} True if Windows Chrome, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isWindows
 * @see isChrome
 * @version 1.0.0
 */
export const isWindowsChrome = (): boolean => getBrowser() === 'chrome' && isWindows();

/**
 * Detects Firefox running on iOS devices.
 *
 * @returns {boolean} True if iOS Firefox, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isIOS
 * @see isFirefox
 * @version 1.0.0
 */
export const isIOSFirefox = (): boolean => getBrowser() === 'firefox' && isIOS();

/**
 * Detects Firefox running on Android devices.
 *
 * @returns {boolean} True if Android Firefox, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isAndroid
 * @see isFirefox
 * @version 1.0.0
 */
export const isAndroidFirefox = (): boolean => getBrowser() === 'firefox' && isAndroid();

/**
 * Detects Edge running on iOS devices.
 *
 * @returns {boolean} True if iOS Edge, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isIOS
 * @see isEdge
 * @version 1.0.0
 */
export const isIOSEdge = (): boolean => getBrowser() === 'edge' && isIOS();

/**
 * Detects Edge running on Android devices.
 *
 * @returns {boolean} True if Android Edge, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isAndroid
 * @see isEdge
 * @version 1.0.0
 */
export const isAndroidEdge = (): boolean => getBrowser() === 'edge' && isAndroid();

/**
 * Detects Edge running on macOS devices.
 *
 * @returns {boolean} True if macOS Edge, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isMacOS
 * @see isEdge
 * @version 1.0.0
 */
export const isMacOSEdge = (): boolean => getBrowser() === 'edge' && isMacOS();

/**
 * Detects Edge running on Windows devices.
 *
 * @returns {boolean} True if Windows Edge, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isWindows
 * @see isEdge
 * @version 1.0.0
 */
export const isWindowsEdge = (): boolean => getBrowser() === 'edge' && isWindows();

/**
 * Detects Opera running on iOS devices.
 *
 * @returns {boolean} True if iOS Opera, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isIOS
 * @see isOpera
 * @version 1.0.0
 */
export const isIOSOpera = (): boolean => getBrowser() === 'opera' && isIOS();

/**
 * Detects Opera running on Android devices.
 *
 * @returns {boolean} True if Android Opera, otherwise false.
 * @web
 * @author Mike Odnis
 * @see isAndroid
 * @see isOpera
 * @version 1.0.0
 */
export const isAndroidOpera = (): boolean => getBrowser() === 'opera' && isAndroid();
