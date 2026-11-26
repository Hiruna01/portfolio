// Ordered dithering that matches the koi pond behind the site (the koi-pond library's dither pass):
// an 8x8 Bayer matrix, square dots of round(2 * devicePixelRatio) device pixels, and a grid that
// starts at the top-left corner of the window. Anything drawn with these helpers, on a grid that also
// starts there, puts its dots exactly on the pond's.

/** The Bayer threshold, between 0 and 1, of dot cell (x, y) counted from the window's top-left. */
export function bayer8(x: number, y: number) {
  x &= 7;
  y &= 7;
  const xy = x ^ y;
  const v = ((xy & 1) << 5) | ((y & 1) << 4) | ((xy & 2) << 2) | ((y & 2) << 1) | ((xy & 4) >> 1) | ((y & 4) >> 2);
  return (v + 0.5) / 64;
}

/** The pond's dot size: in device pixels (always whole) and in CSS pixels. */
export function dotSize(dpr = window.devicePixelRatio || 1) {
  const device = Math.max(1, Math.round(2 * dpr));
  return { device, css: device / dpr };
}

/** "#rrggbb" or "#rgb" to [r, g, b]; anything else gives the fallback. */
export function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
