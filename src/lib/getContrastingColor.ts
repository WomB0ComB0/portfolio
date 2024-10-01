export function getContrastingColor(col: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const useBlack = getColor(hexToRgb(standardizeColor(col)));
  return useBlack ? '#000000' : '#ffffff';
}

type RGB = {
  r: number;
  g: number;
  b: number;
} | null;

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

function standardizeColor(str: string): string {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) {
    return '';
  }

  ctx.fillStyle = str;
  return ctx.fillStyle;
}

function hexToRgb(hex: string): RGB {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1] ?? '0', 16),
        g: Number.parseInt(result[2] ?? '0', 16),
        b: Number.parseInt(result[3] ?? '0', 16),
      }
    : null;
}
