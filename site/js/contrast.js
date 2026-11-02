// sRGB only: enough to turn a computed highlight color into a WCAG ratio.

function toLinear(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function oklabToLinearSrgb([lightness, a, b]) {
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

function displayP3ToLinearSrgb(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  return [
    1.2249401 * r - 0.2249404 * g,
    -0.0420569 * r + 1.0420571 * g,
    -0.0196376 * r - 0.0786361 * g + 1.0982735 * b,
  ];
}

function readNumber(token, percentScale = 1) {
  if (token === 'none') return 0;
  if (token.endsWith('%')) return (parseFloat(token) / 100) * percentScale;
  return parseFloat(token);
}

// Linear sRGB channels clipped to 0–1, or null for a format this doesn't read.
function parseLinearSrgb(colorText) {
  const match = colorText.trim().match(/^([a-z-]+)\((.*)\)$/i);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const tokens = match[2].split('/')[0].replace(/,/g, ' ').trim().split(/\s+/);
  let linear = null;

  if (name === 'rgb' || name === 'rgba') {
    linear = tokens
      .slice(0, 3)
      .map((token) => toLinear(readNumber(token, 255) / 255));
  } else if (name === 'oklch') {
    const lightness = readNumber(tokens[0], 1);
    const chroma = readNumber(tokens[1], 0.4);
    const hue = (readNumber(tokens[2]) * Math.PI) / 180;
    linear = oklabToLinearSrgb([
      lightness,
      chroma * Math.cos(hue),
      chroma * Math.sin(hue),
    ]);
  } else if (name === 'oklab') {
    linear = oklabToLinearSrgb([
      readNumber(tokens[0], 1),
      readNumber(tokens[1], 0.4),
      readNumber(tokens[2], 0.4),
    ]);
  } else if (name === 'color') {
    const space = tokens[0];
    const channels = tokens.slice(1, 4).map((token) => readNumber(token, 1));
    if (space === 'srgb') linear = channels.map(toLinear);
    if (space === 'srgb-linear') linear = channels;
    if (space === 'display-p3') linear = displayP3ToLinearSrgb(channels);
  }

  if (!linear || linear.some(Number.isNaN)) return null;
  return linear.map((channel) => Math.min(Math.max(channel, 0), 1));
}

function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (x, y) => y - x
  );
  return (lighter + 0.05) / (darker + 0.05);
}

// hue-hop turns its colors off outside this media query.
const isColorModeOn = matchMedia(
  '(forced-colors: none) and (prefers-contrast: no-preference)'
);

function resolveColor(element, color) {
  const swatch = document.createElement('span');
  swatch.style.color = color;
  element.after(swatch);
  const resolved = getComputedStyle(swatch).color;
  swatch.remove();
  return resolved;
}

// Measures a still copy, so drift can't move the number between reads. NaN when there's nothing to measure.
export function lowestLetterContrast(element, background) {
  if (!('highlights' in CSS) || !isColorModeOn.matches) return NaN;
  const backgroundLinear = parseLinearSrgb(resolveColor(element, background));
  if (!backgroundLinear) return NaN;

  const probe = element.cloneNode(true);
  probe.removeAttribute('id');
  probe.removeAttribute('drift');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  element.after(probe);

  let lowest = Infinity;
  for (let index = 0; index < probe.hops; index++) {
    const linear = parseLinearSrgb(
      getComputedStyle(probe, `::highlight(hue-hop-${index})`).color
    );
    if (linear)
      lowest = Math.min(lowest, contrastRatio(linear, backgroundLinear));
  }
  probe.remove();
  return lowest === Infinity ? NaN : lowest;
}
