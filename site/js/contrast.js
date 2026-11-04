import {
  clipToScreen,
  contrastRatio,
  luminance,
  parseComputedColor,
} from './color.js';

function parseLinearSrgb(colorText) {
  const color = parseComputedColor(colorText);
  return color && clipToScreen(color);
}

// hue-hop turns its colors off outside this media query.
export const isColorModeOn = matchMedia(
  '(forced-colors: none) and (prefers-contrast: no-preference)'
);

export function floorRatio(ratio) {
  return (Math.floor(ratio * 10) / 10).toFixed(1);
}

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
  const backgroundLuminance = luminance(backgroundLinear);

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
    if (linear) {
      const ratio = contrastRatio(luminance(linear), backgroundLuminance);
      lowest = Math.min(lowest, ratio);
    }
  }
  probe.remove();
  return lowest === Infinity ? NaN : lowest;
}
