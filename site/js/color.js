export const GREY_CHROMA = 0.0001;

export function wrapHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function toLinear(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function oklabToOklch([lightness, a, b]) {
  const chroma = Math.hypot(a, b);
  // Browsers treat the hue of a grey as missing, so a mix takes the other end's hue.
  const hue =
    chroma < GREY_CHROMA ? NaN : wrapHue((Math.atan2(b, a) * 180) / Math.PI);
  return { lightness, chroma, hue };
}

function linearSrgbToOklch([red, green, blue]) {
  const long = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  );
  const medium = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  );
  const short = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  );
  return oklabToOklch([
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ]);
}

export function oklchToLinearSrgb({ lightness, chroma, hue }) {
  const radians = ((Number.isNaN(hue) ? 0 : hue) * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

function displayP3ToLinearSrgb([red, green, blue]) {
  return [
    1.2249401 * red - 0.2249404 * green,
    -0.0420569 * red + 1.0420571 * green,
    -0.0196376 * red - 0.0786361 * green + 1.0982735 * blue,
  ];
}

function readNumber(token, percentScale = 1) {
  if (token === 'none') return 0;
  if (token.endsWith('%')) return (parseFloat(token) / 100) * percentScale;
  return parseFloat(token);
}

// Reads what getComputedStyle returns. Null for a format this doesn't read, and for fully transparent, which is how an unset end reads.
export function parseComputedColor(text) {
  const match = text?.trim().match(/^([a-z-]+)\((.*)\)$/i);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const tokens = match[2].replace(/[,/]/g, ' ').trim().split(/\s+/);
  const space = name === 'color' ? tokens.shift() : name;
  const channels = tokens.slice(0, 3);
  const alpha = tokens[3];

  if (channels.length < 3) return null;
  for (const channel of channels) {
    if (channel !== 'none' && Number.isNaN(parseFloat(channel))) return null;
  }
  if (alpha !== undefined && readNumber(alpha) === 0) return null;

  if (space === 'rgb' || space === 'rgba') {
    return linearSrgbToOklch(
      channels.map((channel) => toLinear(readNumber(channel, 255) / 255))
    );
  }
  if (space === 'oklch') {
    return {
      lightness: readNumber(channels[0]),
      chroma: readNumber(channels[1], 0.4),
      hue: channels[2] === 'none' ? NaN : wrapHue(parseFloat(channels[2])),
    };
  }
  if (space === 'oklab') {
    return oklabToOklch([
      readNumber(channels[0]),
      readNumber(channels[1], 0.4),
      readNumber(channels[2], 0.4),
    ]);
  }

  const numbers = channels.map((channel) => readNumber(channel));
  if (space === 'srgb') return linearSrgbToOklch(numbers.map(toLinear));
  if (space === 'srgb-linear') return linearSrgbToOklch(numbers);
  if (space === 'display-p3') {
    return linearSrgbToOklch(displayP3ToLinearSrgb(numbers.map(toLinear)));
  }
  return null;
}

// Every engine trims an out-of-sRGB color with a plain per-channel clip, so the checker does the same.
export function clipToScreen(color) {
  return oklchToLinearSrgb(color).map((channel) =>
    Math.min(Math.max(channel, 0), 1)
  );
}

export function luminance([red, green, blue]) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(luminanceA, luminanceB) {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
