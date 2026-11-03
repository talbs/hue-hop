// Paints through hue-hop's own highlight names, keyed on an attribute the lamp's measuring copy keeps, so the lamp reads the colors on screen.

export const RAINBOW_MARKUP =
  "<!-- rainbow isn't in hue-hop or the Studio. pick a hue for real markup. -->";

const LINES = {
  pass: 'it passes. that was never the problem.',
  check: "and now it doesn't even pass.",
};

export function rainbowLine(lampState) {
  return LINES[lampState] ?? '';
}

// hue-hop's own cap. The step rules mirror hue-hop's under site names, so the site never reads its private --_hop-* values.
const MOST_HOPS = 64;

// One lightness per side. Chroma per hue sits just under that hue's sRGB limit (teal runs out first). Measured with lowestLetterContrast: every hue passes 4.5:1, so no Shift or Curve can push a letter under.
const SIDE_A = {
  lightness: 0.74,
  chroma: '0.135 + 0.015 * cos((var(--rainbow-h) - 30) * 1deg)',
};
const SIDE_B = {
  lightness: 0.5,
  chroma:
    '0.13 + 0.06 * cos((var(--rainbow-h) - 330) * 1deg) + 0.03 * cos((var(--rainbow-h) - 140) * 2deg)',
};

function colorFor({ lightness, chroma }) {
  return `oklch(${lightness} calc(${chroma}) var(--rainbow-h))`;
}

function sheetText() {
  const rules = [];
  const names = [];
  for (let step = 0; step < MOST_HOPS; step++) {
    const name = `hue-hop[data-rainbow]::highlight(hue-hop-${step})`;
    rules.push(
      `${name}{--rainbow-i:${step}}`,
      `hue-hop[data-rainbow][hops='${step + 1}']{--rainbow-n:${step + 1}}`
    );
    names.push(name);
  }
  // Steps spread evenly around the whole wheel, so the last letter never repeats the first.
  const hue = `calc(25 + pow(var(--rainbow-i) / max(var(--rainbow-n) - 1, 1), var(--hop-curve, 1)) * 360 * (var(--rainbow-n) - 1) / var(--rainbow-n) + var(--hop-shift, 0))`;
  rules.push(
    `${names.join(',')}{--rainbow-h:${hue};color:light-dark(${colorFor(SIDE_B)},${colorFor(SIDE_A)})}`
  );
  return (
    '@media (forced-colors: none) and (prefers-contrast: no-preference){' +
    rules.join('') +
    '}'
  );
}

let sheet;

export function paintRainbow() {
  if (sheet) return;
  sheet = new CSSStyleSheet();
  sheet.replaceSync(sheetText());
  document.adoptedStyleSheets.push(sheet);
}
