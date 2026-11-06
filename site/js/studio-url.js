import { isBlankLetter } from './motion.js';
import { DEFAULT_STATE, defaultLift } from './state.js';

const PRESET_HUES = [
  'dusk',
  'reef',
  'fern',
  'ember',
  'guava',
  'orchid',
  'honey',
];

export const FONTS = {
  onest: { family: 'var(--font-display)', weights: [100, 900] },
  'dm-sans': { family: "'DM Sans', sans-serif", weights: [100, 900] },
  instrument: { family: "'Instrument Sans', sans-serif", weights: [400, 700] },
  funnel: { family: "'Funnel Sans', sans-serif", weights: [300, 800] },
  host: { family: "'Host Grotesk', sans-serif", weights: [300, 800] },
  golos: { family: "'Golos Text', sans-serif", weights: [400, 900] },
  rethink: { family: "'Rethink Sans', sans-serif", weights: [400, 800] },
  geist: { family: "'Geist', sans-serif", weights: [100, 900] },
  mona: { family: "'Mona Sans', sans-serif", weights: [200, 900] },
};

const SIDE_BY_SCHEME = new Map([
  ['a', 'a'],
  ['b', 'b'],
  ['dark', 'a'],
  ['light', 'b'],
]);

const NUMBER_RANGES = {
  curve: [0.25, 4],
  lift: [-0.06, 0.12],
  shift: [-180, 180],
  weight: [100, 900],
  size: [12, 200],
  range: [4, 90],
  cycle: [2, 30],
};

const DISPLAY_BAR = 3;
const MAX_WORD_LENGTH = 200;

export const DEFAULT_STUDIO = {
  text: '',
  hue: DEFAULT_STATE.hue,
  start: null,
  end: null,
  curve: DEFAULT_STATE.curve,
  lift: DEFAULT_STATE.lift,
  shift: DEFAULT_STATE.shift,
  display: false,
  bar: 4.5,
  font: 'onest',
  weight: 700,
  size: 96,
  pageA: '#141416',
  pageB: '#f7f7f5',
  isAccentOn: false,
  accent: '.',
  accentColor: { light: '#18181b', dark: '#ededf0' },
  isDriftOn: false,
  range: 24,
  cycle: 10,
  side: null,
};

// A link with display on and no bar is judged at 3:1, same as the landing that sent it.
export function defaultBarFor(isDisplayOn) {
  return isDisplayOn ? DISPLAY_BAR : DEFAULT_STUDIO.bar;
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const character of text) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts;
}

const COLOR_FUNCTIONS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'color-mix',
  'calc',
]);

function hasOnlyColorFunctions(color) {
  for (const [, name] of color.matchAll(/([^\s(),/]*)\(/g)) {
    if (!COLOR_FUNCTIONS.has(name.toLowerCase())) return false;
  }
  return true;
}

function hasBalancedParens(color) {
  return color.split('(').length === color.split(')').length;
}

// CSS.supports says yes to var(), env(), attr(), if() and keywords like inherit, but none of them name a color on someone else's page. Each can hide behind a CSS escape or a comment. CSS.supports also closes an open paren for you, which Safari then refuses inside a custom property. light-dark() fails here too, because each side holds one color.
function readColor(text, isColor) {
  if (!text) return null;
  const color = text.trim();
  if (/\\|\/\*/.test(color)) return null;
  if (!hasBalancedParens(color) || !hasOnlyColorFunctions(color)) return null;
  if (/^(inherit|initial|unset|revert.*)$|currentcolor/i.test(color)) {
    return null;
  }
  return isColor(color) ? color : null;
}

function readColorPair(text, isColor) {
  if (!text) return null;
  const pairMatch = text.trim().match(/^light-dark\((.*)\)$/is);
  if (!pairMatch) {
    const color = readColor(text, isColor);
    return color && { light: color, dark: color };
  }
  const parts = splitTopLevel(pairMatch[1]);
  if (parts.length !== 2) return null;
  const light = readColor(parts[0], isColor);
  const dark = readColor(parts[1], isColor);
  return light && dark ? { light, dark } : null;
}

export function writeColorPair({ light, dark }) {
  return light === dark ? light : `light-dark(${light}, ${dark})`;
}

function readNumber(params, name) {
  const text = params.get(name);
  if (text === null || text.trim() === '') return null;
  const value = Number(text);
  const [min, max] = NUMBER_RANGES[name];
  return value >= min && value <= max ? value : null;
}

function isFlagOn(params, name) {
  const text = params.get(name);
  return text === '1' || text === 'true';
}

function readWord(text) {
  if (!text) return null;
  const word = Array.from(text).slice(0, MAX_WORD_LENGTH).join('');
  return isBlankLetter(word) ? null : word;
}

function readHue(params, start, end) {
  const hue = params.get('hue');
  if (PRESET_HUES.includes(hue)) return hue;
  if (hue === 'custom' || start || end) return 'custom';
  return null;
}

// Anything unreadable or out of range is left out, so the caller's default stands.
export function readStudioParams(search, { isColor }) {
  const params = new URLSearchParams(search);
  const state = {};

  const text = readWord(params.get('text'));
  if (text) state.text = text;

  const start = readColorPair(params.get('start'), isColor);
  const end = readColorPair(params.get('end'), isColor);
  const hue = readHue(params, start, end);
  const isCustom = hue === 'custom';
  if (hue) state.hue = hue;
  if (start) state.start = start;
  if (end) state.end = end;
  if (isCustom) state.lift = defaultLift(hue);

  for (const name of Object.keys(NUMBER_RANGES)) {
    const value = readNumber(params, name);
    if (value !== null) state[name] = value;
  }

  const isDisplayOn = isFlagOn(params, 'display') && !isCustom;
  if (isDisplayOn) state.display = true;
  if (isFlagOn(params, 'drift')) state.isDriftOn = true;

  const bar = Number(params.get('bar'));
  if (bar === 3 || bar === 4.5) state.bar = bar;
  else if (isDisplayOn) state.bar = DISPLAY_BAR;

  const font = params.get('font');
  if (Object.hasOwn(FONTS, font)) state.font = font;

  const pageA = readColor(params.get('pagea'), isColor);
  if (pageA) state.pageA = pageA;
  const pageB = readColor(params.get('pageb'), isColor);
  if (pageB) state.pageB = pageB;

  const accent = readWord(params.get('accent'));
  if (accent) {
    state.isAccentOn = true;
    state.accent = accent;
  }
  const accentColor = readColorPair(params.get('accentcolor'), isColor);
  if (accentColor) state.accentColor = accentColor;

  const side = SIDE_BY_SCHEME.get(params.get('scheme'));
  if (side) state.side = side;

  return state;
}

export function writeStudioParams(state) {
  const params = new URLSearchParams();
  const setIfChanged = (name, value, defaultValue) => {
    if (value !== defaultValue) params.set(name, value);
  };
  const isDisplayOn = state.display && state.hue !== 'custom';

  if (state.text) params.set('text', state.text);
  // With no hue, an end reads as custom. So a default hue with its own end has to say so.
  if (state.hue !== DEFAULT_STUDIO.hue || state.start || state.end) {
    params.set('hue', state.hue);
  }
  if (state.start) params.set('start', writeColorPair(state.start));
  if (state.end) params.set('end', writeColorPair(state.end));
  setIfChanged('curve', state.curve, DEFAULT_STUDIO.curve);
  setIfChanged('lift', state.lift, defaultLift(state.hue));
  setIfChanged('shift', state.shift, DEFAULT_STUDIO.shift);
  if (state.isDriftOn) params.set('drift', '1');
  if (isDisplayOn) params.set('display', '1');
  setIfChanged('bar', state.bar, defaultBarFor(isDisplayOn));
  setIfChanged('font', state.font, DEFAULT_STUDIO.font);
  setIfChanged('weight', state.weight, DEFAULT_STUDIO.weight);
  setIfChanged('size', state.size, DEFAULT_STUDIO.size);
  setIfChanged('pagea', state.pageA, DEFAULT_STUDIO.pageA);
  setIfChanged('pageb', state.pageB, DEFAULT_STUDIO.pageB);
  if (state.isAccentOn) params.set('accent', state.accent);
  setIfChanged(
    'accentcolor',
    writeColorPair(state.accentColor),
    writeColorPair(DEFAULT_STUDIO.accentColor)
  );
  setIfChanged('range', state.range, DEFAULT_STUDIO.range);
  setIfChanged('cycle', state.cycle, DEFAULT_STUDIO.cycle);
  if (state.side && params.size > 0) params.set('scheme', state.side);

  return params;
}
