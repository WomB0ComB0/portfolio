
/**
 * Returns a highly contrasting color (#000000 or #ffffff) for a given input color string,
 * useful for ensuring text or UI elements remain visible against varying backgrounds.
 *
 * The function attempts to standardize and parse the input color, calculates its brightness,
 * and returns black for light backgrounds, or white for dark backgrounds.
 *
 * This function only runs in the browser; on the server, it returns undefined.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.1.0
 * @param {string} col - The input color (any valid CSS color string, e.g. "#f00", "rgb(255,0,0)", "blue").
 * @returns {string | undefined} The hex color string for the contrasting color ("#000000" or "#ffffff"), or undefined if not in browser environment.
 * @throws {Error} May throw if standardization or parsing of color fails, but usually falls back silently.
 * @example
 * getContrastingColor('#FFFFFF'); // → "#000000"
 * getContrastingColor('navy');    // → "#ffffff"
 * @see https://www.w3.org/WAI/ER/WD-AERT/#color-contrast
 */
export function getContrastingColor(col: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const useBlack = getColor(hexToRgb(standardizeColor(col)));
  return useBlack ? '#000000' : '#ffffff';
}

/**
 * RGB color interface.
 * Used for representing color channels after hex parsing.
 *
 * @interface
 * @readonly
 * @property {number} r - Red channel (0-255)
 * @property {number} g - Green channel (0-255)
 * @property {number} b - Blue channel (0-255)
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.0.0
 */
type RGB = {
  r: number;
  g: number;
  b: number;
} | null;

/**
 * Determines if black or white text provides better contrast over a given RGB color,
 * based on relative luminance and YIQ formula.
 *
 * @function
 * @private
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.1.0
 * @param {RGB} rgb - The color to evaluate as RGB object or null
 * @returns {boolean | undefined} True if black should be used, false if white; undefined if rgb is invalid
 * @see https://www.w3.org/WAI/ER/WD-AERT/#color-contrast
 */
function getColor(rgb: RGB) {
  if (!rgb) {
    return;
  }

  const { r, g, b } = rgb;
  if (r && g && b) {
    const isLight = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return isLight < 0.5;
  }
  return false;
}

/**
 * Standardizes any valid CSS color string to its computed form (e.g. converts "red" to "#ff0000").
 *
 * Uses Canvas 2D context for browser-based color parsing.
 *
 * @function
 * @private
 * @web
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.1.0
 * @param {string} str - CSS color input
 * @returns {string} The standardized hex color string, or an empty string on failure
 * @throws {Error} If Canvas context creation fails (rare, typically not thrown)
 */
function standardizeColor(str: string): string {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) {
    return '';
  }

  ctx.fillStyle = str;
  return ctx.fillStyle;
}

/**
 * Converts a hex color code string into an { r, g, b } RGB object.
 * Accepts both shorthand ("#f00") and full ("#ff0000") hex formats.
 *
 * @function
 * @private
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.0.0
 * @param {string} hex - The hex color string (with or without '#')
 * @returns {RGB} The parsed RGB object, or null if parsing fails
 * @example
 * hexToRgb('#03f'); // { r: 0, g: 51, b: 255 }
 * hexToRgb('336699'); // { r: 51, g: 102, b: 153 }
 */
function hexToRgb(hex: string): RGB {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1] ?? '0', 16),
        g: Number.parseInt(result[2] ?? '0', 16),
        b: Number.parseInt(result[3] ?? '0', 16),
      }
    : null;
}

