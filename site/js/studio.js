import {
  clipToScreen,
  contrastRatio,
  luminance,
  parseComputedColor,
} from './color.js';
import { floorRatio, isColorModeOn } from './contrast.js';
import { beatMs, isBlankLetter, splitLetters } from './motion.js';
import { whenSideChanges } from './scheme.js';
import { escapeHtml } from './state.js';
import {
  autoPartnerOf,
  formatOklch,
  letterColors,
  otherEndOf,
  planFit,
  solvePartner,
  stepCount,
  stepOfLetter,
  toHex,
} from './studio-color.js';
import {
  defaultBarFor,
  defaultLiftFor,
  DEFAULT_STUDIO,
  FONTS,
  readStudioParams,
  writeColorPair,
  writeStudioParams,
} from './studio-url.js';
import { fillCode } from './syntax.js';

const SCHEMES = ['dark', 'light'];
const ENDS = ['start', 'end'];
const SCHEME_OF_SIDE = { a: 'dark', b: 'light' };
const SIDE_NAME = { dark: 'A', light: 'B' };
const COPIED_MS = 1500;
const ADDRESS_DELAY_MS = 250;
// A dotted eighth, about 500ms, so a fader drag speaks once it stops.
const SPOKEN_DELAY_MS = beatMs() * 0.75;

const studio = document.querySelector('.studio');
const stageArt = document.querySelector('.stage-art');
const wordmark = document.getElementById('wordmark');
const hop = document.getElementById('hop');
const accentMark = document.getElementById('accent-mark');
const colorReader = document.getElementById('color-reader');
const probes = {
  light: document.querySelector('.probes hue-hop[data-scheme="light"]'),
  dark: document.querySelector('.probes hue-hop[data-scheme="dark"]'),
};
const samples = document.getElementById('samples');
const meters = document.getElementById('meters');
const metersEmpty = document.getElementById('meters-empty');
const head = document.querySelector('.head');
const bridgeStrips = document.querySelector('.bridge-strips');
const lampReadings = {
  dark: document.getElementById('lamp-a'),
  light: document.getElementById('lamp-b'),
};
const lampSpoken = document.getElementById('lamp-spoken');
const restBadge = document.getElementById('rest-badge');
const shiftNote = document.getElementById('shift-note');
const fitButton = document.getElementById('fit-button');
const fitMessage = document.getElementById('fit-message');
const fitResult = document.getElementById('fit-result');
const undoButton = document.getElementById('undo-fit');
const displayHint = document.getElementById('display-hint');
const hueChips = [...studio.querySelectorAll('.hue-chip')];
const accentIdeas = document.getElementById('accent-ideas');
const codeDrawer = document.getElementById('code-drawer');
const codeFormat = document.getElementById('code-format');
const codeNote = document.getElementById('code-note');
const htmlSnippet = document.getElementById('snippet-html');
const cssSnippet = document.getElementById('snippet-css');
const codeWells = {
  html: document.getElementById('code-html'),
  css: document.getElementById('code-css'),
};
const copyHtmlButton = document.getElementById('copy-html');
const copyLinkButton = document.getElementById('copy-link');
const COPY_LABELS = new Map([
  [copyHtmlButton, 'Copy HTML'],
  [copyLinkButton, 'Copy Link'],
]);

function control(name) {
  return studio.querySelector(`[name="${name}"]`);
}

function rowOf(element) {
  return element.closest('.row');
}

const accentRows = [
  rowOf(control('accent')),
  rowOf(accentIdeas),
  rowOf(control('accentColor')),
];
const driftRows = [rowOf(control('range')), rowOf(control('cycle'))];

const state = structuredClone(DEFAULT_STUDIO);
let links = null;
let setAsideCustom = null;
let sampleWord = null;
let lastFit = null;
let fitNotice = null;

const colorsRead = new Map();
const presetEndsRead = new Map();

function readCssColor(text) {
  if (colorsRead.has(text)) return colorsRead.get(text);
  let color = null;
  if (CSS.supports('color', text)) {
    colorReader.style.color = text;
    color = parseComputedColor(getComputedStyle(colorReader).color);
    if (!color) {
      // Browsers hand lab, lch, xyz and rec2020 back as written, and the parser can't read those. A mix hands back oklch.
      colorReader.style.color = `color-mix(in oklch, ${text}, ${text})`;
      color = parseComputedColor(getComputedStyle(colorReader).color);
    }
  }
  if (colorsRead.size >= 256) colorsRead.clear();
  colorsRead.set(text, color);
  return color;
}

function isPreset() {
  return state.hue !== 'custom';
}

function isDisplayOn() {
  return isPreset() && state.display;
}

function shownScheme() {
  return SCHEME_OF_SIDE[state.side];
}

function otherScheme(scheme) {
  return scheme === 'light' ? 'dark' : 'light';
}

function pageColorOf(scheme) {
  return scheme === 'light' ? state.pageB : state.pageA;
}

function pageLuminanceOf(scheme) {
  const page = readCssColor(pageColorOf(scheme));
  return page ? luminance(clipToScreen(page)) : null;
}

function tuning() {
  return { curve: state.curve, lift: state.lift, shift: state.shift };
}

function wordInUse() {
  return sampleWord ?? state.text;
}

function lettersOfWord() {
  const letters = [];
  for (const { letter, isBlank } of splitLetters(wordInUse())) {
    if (!isBlank) letters.push(letter);
  }
  return letters;
}

function lettersPerStep(letters) {
  const shown = [];
  for (const [index, letter] of letters.entries()) {
    if (stepOfLetter(index, letters.length) === shown.length) {
      shown.push(letter);
    }
  }
  return shown;
}

function readPresetEnds(scheme) {
  const key = `${state.hue} ${state.display} ${scheme}`;
  if (presetEndsRead.has(key)) return presetEndsRead.get(key);
  const probe = probes[scheme];
  probe.setAttribute('hue', state.hue);
  probe.toggleAttribute('display', state.display);
  const ends = {};
  for (const which of ENDS) {
    const end = probe.querySelector(`[data-end="${which}"]`);
    ends[which] = parseComputedColor(getComputedStyle(end).color);
  }
  presetEndsRead.set(key, ends);
  return ends;
}

// Null when a set end can't be read. Whether an end is Auto comes only from the state, never from a failed read.
function readEnds(scheme) {
  if (isPreset()) return readPresetEnds(scheme);
  const start = state.start && readCssColor(state.start[scheme]);
  const end = state.end && readCssColor(state.end[scheme]);
  if (start && end) return { start, end };
  if (start && state.end === null) return { start, end: autoPartnerOf(start) };
  if (end && state.start === null) return { start: autoPartnerOf(end), end };
  return null;
}

function measureSide(scheme, stepTotal) {
  if (!isColorModeOn.matches || stepTotal === 0) return null;
  const ends = readEnds(scheme);
  const pageLuminance = pageLuminanceOf(scheme);
  if (!ends || pageLuminance === null) return null;
  const readings = [];
  for (const color of letterColors(ends, stepTotal, tuning())) {
    const linear = clipToScreen(color);
    const ratio = contrastRatio(luminance(linear), pageLuminance);
    readings.push({
      hex: toHex(linear),
      ratio,
      isPassing: ratio >= state.bar,
    });
  }
  return readings;
}

function sideFails(scheme) {
  const stepTotal = stepCount(lettersOfWord().length);
  const readings = measureSide(scheme, stepTotal);
  return Boolean(readings?.some((reading) => !reading.isPassing));
}

function freshLink() {
  return { isLinked: true, source: null, picked: null };
}

function seedEndsFromPreset() {
  const seeded = { start: {}, end: {} };
  for (const scheme of SCHEMES) {
    const ends = readPresetEnds(scheme);
    for (const which of ENDS) seeded[which][scheme] = formatOklch(ends[which]);
  }
  state.start = seeded.start;
  state.end = seeded.end;
  links = { start: freshLink(), end: freshLink() };
}

function switchToCustom() {
  if (!isPreset()) return;
  seedEndsFromPreset();
  setAsideCustom = null;
  state.hue = 'custom';
}

function pickHue(hue) {
  if (hue === 'custom') {
    if (!isPreset()) return;
    if (setAsideCustom) {
      ({ start: state.start, end: state.end, links } = setAsideCustom);
      state.hue = 'custom';
      return;
    }
    switchToCustom();
    return;
  }
  if (!isPreset()) {
    setAsideCustom = { start: state.start, end: state.end, links };
    state.start = null;
    state.end = null;
    links = null;
  }
  state.hue = hue;
}

function takeSnapshot() {
  return structuredClone({
    hue: state.hue,
    start: state.start,
    end: state.end,
    links,
    setAsideCustom,
  });
}

function restoreSnapshot(snapshot) {
  state.hue = snapshot.hue;
  state.start = snapshot.start;
  state.end = snapshot.end;
  links = snapshot.links;
  setAsideCustom = snapshot.setAsideCustom;
}

function forgetFit() {
  lastFit = null;
  fitNotice = null;
}

// A partner comes from the color picked by hand, so moving a page color never drags it further from what was picked.
function makePartner(which) {
  const link = links[which];
  if (!link.source) return;
  const partnerScheme = otherScheme(link.source);
  const sourceText = link.picked ?? state[which][link.source];
  const source = readCssColor(sourceText);
  const pageLuminance = pageLuminanceOf(partnerScheme);
  if (!source || pageLuminance === null) return;

  const otherPair = state[otherEndOf(which)];
  const other = otherPair ? readCssColor(otherPair[partnerScheme]) : null;
  if (otherPair && !other) {
    state[which][partnerScheme] = sourceText;
    return;
  }
  const partner = solvePartner({
    which,
    source,
    other,
    pageLuminance,
    bar: state.bar,
    letterTotal: lettersOfWord().length,
    tuning: tuning(),
  });
  state[which][partnerScheme] = partner.isMoved ? partner.text : sourceText;
}

function pickEnd(which, value) {
  switchToCustom();
  const scheme = shownScheme();
  if (state[which] === null) {
    state[which] = { light: value, dark: value };
    links[which] = freshLink();
  }
  const link = links[which];
  if (link.isLinked && link.source && link.source !== scheme) {
    link.isLinked = false;
  } else if (link.isLinked) {
    link.source = scheme;
  }
  if (link.source === scheme) link.picked = value;
  state[which][scheme] = value;
  if (link.isLinked) makePartner(which);
}

function makeEndAuto(which) {
  switchToCustom();
  if (state[otherEndOf(which)] === null) return;
  state[which] = null;
}

function toggleLink(which) {
  const link = links[which];
  if (link.isLinked) {
    link.isLinked = false;
    return;
  }
  link.isLinked = true;
  link.source ??= shownScheme();
  link.picked = state[which][link.source];
  makePartner(which);
}

function remakeLinkedPartners() {
  if (isPreset()) return;
  for (const which of ENDS) {
    if (state[which] && links[which].isLinked) makePartner(which);
  }
}

function autoEndNow() {
  if (state.start === null) return 'start';
  if (state.end === null) return 'end';
  return null;
}

function describeUnreached(schemes, hasChanges) {
  const pages = schemes.map(
    (scheme) => `Side ${SIDE_NAME[scheme]} (${pageColorOf(scheme)})`
  );
  const ending = hasChanges ? '' : ' Nothing changed.';
  return `Can’t reach ${state.bar}:1 on ${pages.join(' or ')}.${ending}`;
}

function fitFailingSides() {
  const snapshot = takeSnapshot();
  const isSwitched = isPreset();
  switchToCustom();

  const letterTotal = lettersOfWord().length;
  const changes = [];
  const unreached = [];
  for (const scheme of SCHEMES) {
    if (!sideFails(scheme)) continue;
    const before = readEnds(scheme);
    const plan = planFit({
      ends: before,
      pageLuminance: pageLuminanceOf(scheme),
      bar: state.bar,
      letterTotal,
      tuning: tuning(),
      autoEnd: autoEndNow(),
    });
    if (!plan) {
      unreached.push(scheme);
      continue;
    }
    for (const which of ENDS) {
      if (!plan[which].isMoved) continue;
      changes.push({
        scheme,
        which,
        oldText: state[which][scheme],
        newText: plan[which].text,
        oldLightness: before[which].lightness,
        newLightness: plan[which].color.lightness,
      });
      state[which][scheme] = plan[which].text;
    }
  }

  if (changes.length > 0) {
    lastFit = { changes, isSwitched, snapshot };
  } else if (!lastFit) {
    restoreSnapshot(snapshot);
  }
  fitNotice = unreached.length
    ? describeUnreached(unreached, Boolean(lastFit))
    : null;
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function writeAttribute(element, name, value) {
  if (value === null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function setHidden(element, isHidden) {
  if (element.hidden !== isHidden) element.hidden = isHidden;
}

// Only what differs from Hue Hop's defaults, so the copied code stays short.
function styleText() {
  const lines = [];
  if (state.curve !== DEFAULT_STUDIO.curve) {
    lines.push(`--hop-curve: ${state.curve}`);
  }
  if (state.lift !== defaultLiftFor(state.hue)) {
    lines.push(`--hop-lift: ${state.lift}`);
  }
  if (state.shift !== DEFAULT_STUDIO.shift) {
    lines.push(`--hop-shift: ${state.shift}`);
  }
  if (state.isDriftOn && state.range !== DEFAULT_STUDIO.range) {
    lines.push(`--hop-drift-range: ${state.range}`);
  }
  if (state.isDriftOn && state.cycle !== DEFAULT_STUDIO.cycle) {
    lines.push(`--hop-drift-cycle: ${state.cycle}`);
  }
  return lines.join('; ');
}

function showHueOnHop() {
  writeAttribute(hop, 'hue', isPreset() ? state.hue : null);
  writeAttribute(hop, 'display', isDisplayOn() ? '' : null);
  for (const which of ENDS) {
    const pair = isPreset() ? null : state[which];
    writeAttribute(hop, which, pair ? writeColorPair(pair) : null);
  }
}

function weightAsked() {
  const [lightest, heaviest] = FONTS[state.font].weights;
  return Math.min(Math.max(state.weight, lightest), heaviest);
}

let wordFit = 1;

// Preview only: the copied code keeps the real size, the stage just shrinks it to fit.
function fitWordToStage() {
  const width = wordmark.getBoundingClientRect().width;
  if (width === 0) return;
  const fit = Math.min(stageArt.clientWidth / (width / wordFit), 1);
  if (Math.abs(fit - wordFit) < 0.001) return;
  wordFit = fit;
  wordmark.style.setProperty('--word-fit', fit);
}

let wordLookShown = null;

function showWord() {
  const word = wordInUse();
  setText(hop, word);
  writeAttribute(hop, 'drift', state.isDriftOn ? '' : null);
  showHueOnHop();
  writeAttribute(hop, 'style', styleText() || null);
  setHidden(accentMark, !state.isAccentOn);
  setText(accentMark, state.accent);
  accentMark.style.color = writeColorPair(state.accentColor);

  const wordLook = [
    word,
    state.font,
    weightAsked(),
    state.size,
    state.isAccentOn,
    state.accent,
  ].join(' ');
  if (wordLook === wordLookShown) return;
  wordLookShown = wordLook;
  wordmark.style.fontFamily = FONTS[state.font].family;
  wordmark.style.fontWeight = weightAsked();
  wordmark.style.setProperty('--word-size', `${state.size}px`);
  fitWordToStage();
}

let pageColorsShown = null;

function showPageColors() {
  const pageColors = `${state.pageA} ${state.pageB}`;
  if (pageColors === pageColorsShown) return;
  pageColorsShown = pageColors;
  head.style.setProperty('--page-dark', state.pageA);
  head.style.setProperty('--page-light', state.pageB);
}

function makeSpan(className, { text = '', isDecorative = false } = {}) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  if (isDecorative) span.setAttribute('aria-hidden', 'true');
  return span;
}

function buildMeterLed(scheme) {
  const led = makeSpan('meter-led');
  const value = makeSpan('led-value', { isDecorative: true });
  const spoken = makeSpan('wa-visually-hidden');
  led.append(
    makeSpan('led-key', { text: SIDE_NAME[scheme], isDecorative: true }),
    makeSpan('led', { isDecorative: true }),
    value,
    spoken
  );
  return { led, value, spoken };
}

function buildMeter() {
  const meter = document.createElement('li');
  meter.className = 'meter';
  const letter = makeSpan('meter-letter');
  const hex = makeSpan('meter-hex');
  const leds = { dark: buildMeterLed('dark'), light: buildMeterLed('light') };
  const ledGroup = makeSpan('meter-leds');
  ledGroup.append(leds.dark.led, leds.light.led);
  const bar = makeSpan('meter-bar', { isDecorative: true });
  meter.append(letter, bar, hex, ledGroup);
  return { meter, letter, bar, hex, leds, color: '' };
}

function showMeterLed({ led, value, spoken }, scheme, reading) {
  const sideName = `Side ${SIDE_NAME[scheme]}`;
  if (!reading) {
    writeAttribute(led, 'data-state', 'off');
    setText(value, '—');
    setText(spoken, `${sideName} not measured`);
    return;
  }
  const ratioText = floorRatio(reading.ratio);
  writeAttribute(led, 'data-state', reading.isPassing ? 'pass' : 'check');
  setText(value, ratioText);
  setText(
    spoken,
    reading.isPassing
      ? `${sideName} ${ratioText}, passes`
      : `${sideName} ${ratioText}, fails ${state.bar}`
  );
}

// Set on the letter and bar directly: a custom property on the meter restyles its whole subtree, and that dropped a fader drag on a long word below 50fps.
function showMeterColor(parts, lightHex, darkHex) {
  const color =
    lightHex && darkHex
      ? writeColorPair({ light: lightHex, dark: darkHex })
      : '';
  if (color === parts.color) return;
  parts.color = color;
  parts.letter.style.color = color;
  parts.bar.style.background = color;
}

let meterParts = [];
let meterWordShown = null;

function showStripScroll() {
  const isOverflowing = bridgeStrips.scrollWidth > bridgeStrips.clientWidth + 1;
  writeAttribute(bridgeStrips, 'tabindex', isOverflowing ? '0' : null);
}

function showMeters(stepLetters, readings) {
  if (meterParts.length !== stepLetters.length) {
    meterParts = Array.from(stepLetters, buildMeter);
    meters.replaceChildren(...meterParts.map((parts) => parts.meter));
    setHidden(metersEmpty, stepLetters.length > 0);
  }
  const scheme = shownScheme();
  for (const [index, parts] of meterParts.entries()) {
    const light = readings.light?.[index];
    const dark = readings.dark?.[index];
    setText(parts.letter, stepLetters[index]);
    setText(parts.hex, readings[scheme]?.[index].hex ?? '');
    showMeterColor(parts, light?.hex, dark?.hex);
    showMeterLed(parts.leds.dark, 'dark', dark);
    showMeterLed(parts.leds.light, 'light', light);
  }
  const meterWord = stepLetters.join('');
  if (meterWord === meterWordShown) return;
  meterWordShown = meterWord;
  // Last, because measuring forces a style pass, and new meters styled before their readings go on would fade their LEDs in.
  showStripScroll();
}

function lowestRatio(readings) {
  let lowest = Infinity;
  for (const { ratio } of readings) lowest = Math.min(lowest, ratio);
  return lowest;
}

let lampSentence = null;
let lampSpeechTimer = null;

function writeLampSpoken(sentence) {
  if (lampSpoken.textContent.trim() !== sentence) {
    lampSpoken.textContent = sentence;
  }
}

// Keeps the output true for someone browsing to it, without reading it out again. The region stays off for a frame either side, because screen readers pick up changes a little after they happen.
function writeLampSpokenQuietly(sentence) {
  if (lampSpoken.textContent.trim() === sentence) return;
  lampSpoken.setAttribute('aria-live', 'off');
  requestAnimationFrame(() => {
    lampSpoken.textContent = sentence;
    requestAnimationFrame(() => {
      lampSpoken.setAttribute('aria-live', 'polite');
    });
  });
}

function speakLampSoon(sentence) {
  if (sentence === lampSentence) return;
  const isFirstPaint = lampSentence === null;
  lampSentence = sentence;
  if (isFirstPaint) {
    writeLampSpokenQuietly(sentence);
    return;
  }
  clearTimeout(lampSpeechTimer);
  lampSpeechTimer = setTimeout(() => {
    lampSpeechTimer = null;
    writeLampSpoken(lampSentence);
  }, SPOKEN_DELAY_MS);
}

function showLamp(readings) {
  const spokenSides = [];
  for (const scheme of SCHEMES) {
    const reading = lampReadings[scheme];
    const text = reading.querySelector('.lamp-text');
    const sideName = `side ${SIDE_NAME[scheme]}`;
    if (!readings[scheme]) {
      writeAttribute(reading, 'data-state', 'off');
      setText(text, `${SIDE_NAME[scheme]} —`);
      spokenSides.push(`${sideName} not measured`);
      continue;
    }
    const lowest = lowestRatio(readings[scheme]);
    const isPassing = lowest >= state.bar;
    const ratioText = floorRatio(lowest);
    writeAttribute(reading, 'data-state', isPassing ? 'pass' : 'check');
    setText(
      text,
      `${SIDE_NAME[scheme]} ${isPassing ? 'Pass' : 'Check'} ${ratioText}`
    );
    spokenSides.push(
      isPassing
        ? `${sideName} passes at ${ratioText}`
        : `${sideName} fails at ${ratioText} of ${state.bar}`
    );
  }
  speakLampSoon(`Contrast: ${spokenSides.join(', ')}.`);
}

function showBridgeNotes() {
  setHidden(restBadge, !state.isDriftOn);
  setHidden(shiftNote, state.shift === 0);
  setText(shiftNote, `Shift ${state.shift}°: hues differ from your ends.`);
}

function writeFitChange(change) {
  const line = makeSpan('fit-change');
  const before = makeSpan('fit-swatch', { isDecorative: true });
  before.style.background = change.oldText;
  const after = makeSpan('fit-swatch', { isDecorative: true });
  after.style.background = change.newText;
  line.append(
    `Side ${SIDE_NAME[change.scheme]} ${change.which} `,
    before,
    ' → ',
    after,
    ` L ${change.oldLightness.toFixed(3)} → ${change.newLightness.toFixed(3)}`
  );
  return line;
}

let fitNoticeShown = null;
let lastFitShown = null;

// A live region that's filled in the same tick it's unhidden often goes unannounced, so the words arrive a frame after it shows.
function writeFitWords() {
  fitMessage.textContent = fitNotice ?? '';
  if (!lastFit) {
    fitResult.replaceChildren();
    return;
  }
  const lines = lastFit.changes.map(writeFitChange);
  if (lastFit.isSwitched) lines.unshift('Switched to Custom.');
  fitResult.replaceChildren(...lines);
}

function showFitControls(hasFailure) {
  const hadFitFocus = document.activeElement === fitButton;
  const hadUndoFocus = document.activeElement === undoButton;
  fitButton.disabled = !hasFailure;
  setHidden(fitMessage, !fitNotice);
  setHidden(fitResult, !lastFit);
  setHidden(undoButton, !lastFit);
  if (hadFitFocus && fitButton.disabled && lastFit) {
    undoButton.focus({ preventScroll: true });
  }
  if (hadUndoFocus && !lastFit && !fitButton.disabled) {
    fitButton.focus({ preventScroll: true });
  }
  if (fitNotice === fitNoticeShown && lastFit === lastFitShown) return;
  fitNoticeShown = fitNotice;
  lastFitShown = lastFit;
  if (fitNotice || lastFit) requestAnimationFrame(writeFitWords);
  else writeFitWords();
}

function showPickerColor(picker, color) {
  const hex = toHex(clipToScreen(color));
  // Marked so the picker's own echo of a value set here isn't read as a pick.
  writeAttribute(picker, 'data-shown', hex);
  if (picker.value !== hex) picker.value = hex;
  return hex;
}

function showPickerText(name, text) {
  const color = readCssColor(text);
  if (color) showPickerColor(control(name), color);
}

function showOutput(name, text) {
  setText(studio.querySelector(`output[data-for="${name}"]`), text);
}

function showEndPickers() {
  const scheme = shownScheme();
  const ends = readEnds(scheme);
  const sideName = `side ${SIDE_NAME[scheme]}`;
  for (const which of ENDS) {
    const isAuto = !isPreset() && state[which] === null;
    const isOtherAuto = !isPreset() && state[otherEndOf(which)] === null;
    const endName = which === 'start' ? 'Start' : 'End';
    const picker = control(which);
    const color = ends?.[which];
    showOutput(which, color ? showPickerColor(picker, color) : '');
    writeAttribute(
      picker,
      'label',
      isAuto
        ? `${endName} color, picked by Hue Hop, ${sideName}`
        : `${endName} color, ${sideName}`
    );
    setHidden(studio.querySelector(`.auto-tag[data-end="${which}"]`), !isAuto);
    const autoButton = studio.querySelector(
      `.auto-button[data-end="${which}"]`
    );
    setHidden(autoButton, isAuto);
    writeAttribute(autoButton, 'aria-disabled', String(isOtherAuto));
    writeAttribute(
      autoButton,
      'title',
      isOtherAuto ? 'One end has to stay set.' : null
    );
    writeAttribute(
      autoButton,
      'aria-describedby',
      isOtherAuto ? 'auto-reason' : null
    );
  }
  writeAttribute(control('accentColor'), 'label', `Accent color, ${sideName}`);
}

function showLinkToggles() {
  for (const which of ENDS) {
    const toggle = studio.querySelector(`.link-toggle[data-end="${which}"]`);
    const isShown = !isPreset() && state[which] !== null;
    setHidden(toggle, !isShown);
    if (!isShown) continue;
    const { isLinked, source } = links[which];
    const sourceScheme = source ?? shownScheme();
    const partnerSide = `Side ${SIDE_NAME[otherScheme(sourceScheme)]}`;
    const sourceSide = `side ${SIDE_NAME[sourceScheme]}`;
    const icon = toggle.querySelector('wa-icon');
    writeAttribute(icon, 'name', isLinked ? 'link' : 'minus');
    writeAttribute(
      icon,
      'label',
      isLinked
        ? `${partnerSide} ${which} linked to ${sourceSide}`
        : `${partnerSide} ${which} unlinked from ${sourceSide}`
    );
    writeAttribute(toggle, 'data-linked', String(isLinked));
  }
}

function showControlStates() {
  for (const chip of hueChips) {
    const isChecked = chip.dataset.hue === state.hue;
    writeAttribute(chip, 'aria-checked', String(isChecked));
    const tabIndex = isChecked ? 0 : -1;
    if (chip.tabIndex !== tabIndex) chip.tabIndex = tabIndex;
  }
  const displayToggle = control('display');
  displayToggle.disabled = !isPreset();
  writeAttribute(displayToggle, 'aria-pressed', String(isDisplayOn()));
  writeAttribute(control('accentOn'), 'aria-pressed', String(state.isAccentOn));
  writeAttribute(control('drift'), 'aria-pressed', String(state.isDriftOn));
  setHidden(displayHint, isPreset());
  for (const row of accentRows) setHidden(row, !state.isAccentOn);
  for (const row of driftRows) setHidden(row, !state.isDriftOn);
  const barGroup = control('bar');
  if (barGroup.value !== String(state.bar)) barGroup.value = String(state.bar);
}

function showReadouts() {
  const scheme = shownScheme();
  showOutput('weight', String(weightAsked()));
  showOutput('size', `${state.size}px`);
  showOutput('curve', `×${state.curve.toFixed(2)}`);
  showOutput('lift', state.lift.toFixed(3));
  showOutput('shift', `${state.shift}°`);
  showOutput('range', `±${state.range}°`);
  showOutput('cycle', `${state.cycle}s`);
  showOutput('darkPage', state.pageA);
  showOutput('lightPage', state.pageB);
  showOutput('accentColor', state.accentColor[scheme]);
  showPickerText('darkPage', state.pageA);
  showPickerText('lightPage', state.pageB);
  showPickerText('accentColor', state.accentColor[scheme]);
}

function writeHopHtml() {
  const attributes = [];
  if (isPreset()) {
    attributes.push(`hue="${state.hue}"`);
    if (state.display) attributes.push('display');
  } else {
    for (const which of ENDS) {
      if (state[which]) {
        attributes.push(
          `${which}="${escapeHtml(writeColorPair(state[which]))}"`
        );
      }
    }
  }
  if (state.isDriftOn) attributes.push('drift');
  const style = styleText();
  if (style) attributes.push(`style="${style}"`);

  const tag = ['hue-hop', ...attributes].join(' ');
  const hopHtml = `<${tag}>${escapeHtml(wordInUse())}</hue-hop>`;
  if (!state.isAccentOn) return hopHtml;
  const accentColor = escapeHtml(writeColorPair(state.accentColor));
  return `${hopHtml}<span class="accent" style="color: ${accentColor}">${escapeHtml(state.accent)}</span>`;
}

function endPairForCss(which) {
  if (!isPreset()) return state[which];
  return {
    light: formatOklch(readPresetEnds('light')[which]),
    dark: formatOklch(readPresetEnds('dark')[which]),
  };
}

function writeHopCss() {
  const lines = ['color-scheme: light dark;'];
  for (const which of ENDS) {
    const pair = endPairForCss(which);
    lines.push(
      pair
        ? `--hop-${which}: ${writeColorPair(pair)};`
        : `/* --hop-${which} not set: Hue Hop picks it from the other end. */`
    );
  }
  lines.push(
    `--hop-curve: ${state.curve};`,
    `--hop-lift: ${state.lift};`,
    `--hop-shift: ${state.shift};`
  );
  if (state.isDriftOn) {
    lines.push(
      `--hop-drift-range: ${state.range};`,
      `--hop-drift-cycle: ${state.cycle};`
    );
  }
  return `:root {\n  ${lines.join('\n  ')}\n}`;
}

function writeCodeNote() {
  const addOns = [];
  if (isPreset()) addOns.push('hue-hop/hues.css');
  if (state.isDriftOn) addOns.push('hue-hop/drift.css');
  const needs = ['hue-hop', ...addOns].join(' and ');
  const cssTab = isPreset()
    ? 'The CSS tab sets the same colors without hues.css.'
    : 'The CSS tab sets the same colors on :root or your tokens.';
  return `Needs ${needs}. ${cssTab} Your page needs color-scheme: light dark, or it only shows the light colors.`;
}

function showCode() {
  fillCode(htmlSnippet, writeHopHtml());
  fillCode(cssSnippet, writeHopCss());
  setText(codeNote, writeCodeNote());
}

function paint() {
  // First, because reading a color after the writes below would force a style pass.
  const stepLetters = lettersPerStep(lettersOfWord());
  const readings = {};
  for (const scheme of SCHEMES) {
    readings[scheme] = measureSide(scheme, stepLetters.length);
  }

  showWord();
  showPageColors();
  showMeters(stepLetters, readings);
  showLamp(readings);
  showBridgeNotes();
  const hasFailure = SCHEMES.some((scheme) =>
    readings[scheme]?.some((reading) => !reading.isPassing)
  );
  showFitControls(hasFailure);
  showEndPickers();
  showLinkToggles();
  showControlStates();
  showReadouts();
  if (codeDrawer.open) showCode();
}

let hasPendingRender = false;

function render() {
  if (hasPendingRender) return;
  hasPendingRender = true;
  requestAnimationFrame(() => {
    hasPendingRender = false;
    paint();
  });
}

// The sample word stays out of the state, so a link has to ask for the word on screen by name.
function shareParams() {
  return writeStudioParams({ ...state, text: wordInUse() });
}

function queryOf(params) {
  return params.size > 0 ? `?${params}` : '';
}

function replaceAddress(params) {
  const query = queryOf(params);
  if (query === location.search) return;
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${query}${location.hash}`
  );
}

let addressTimer = null;

function hasOwnSetup() {
  return writeStudioParams(state).size > 0;
}

function writeAddress() {
  addressTimer = null;
  replaceAddress(hasOwnSetup() ? shareParams() : new URLSearchParams());
}

function writeAddressSoon() {
  clearTimeout(addressTimer);
  addressTimer = setTimeout(writeAddress, ADDRESS_DELAY_MS);
}

function flushAddress() {
  if (addressTimer === null) return;
  clearTimeout(addressTimer);
  writeAddress();
}

function showEdit() {
  render();
  writeAddressSoon();
}

// isPreset() ignores ends, so a hue with its own end has to become custom ends before anything reads it. Seeding from the hue's real colors keeps the look the link described.
function settleLinkedEnds() {
  const linkedEnds = { start: state.start, end: state.end };
  const hasLinkedEnd = Boolean(linkedEnds.start || linkedEnds.end);
  if (state.hue === 'custom' && !hasLinkedEnd) {
    state.hue = DEFAULT_STUDIO.hue;
    switchToCustom();
    return;
  }
  if (!hasLinkedEnd) return;
  if (isPreset()) switchToCustom();
  else links = { start: freshLink(), end: freshLink() };
  for (const which of ENDS) {
    if (!linkedEnds[which]) continue;
    state[which] = linkedEnds[which];
    links[which].isLinked = false;
  }
}

function readLink() {
  const linked = readStudioParams(location.search, {
    isColor: (text) => CSS.supports('color', text),
  });
  Object.assign(state, linked);
  settleLinkedEnds();
}

function showWeightRange() {
  const [lightest, heaviest] = FONTS[state.font].weights;
  const weightSlider = control('weight');
  weightSlider.min = lightest;
  weightSlider.max = heaviest;
  weightSlider.value = weightAsked();
}

function writeFieldsFromState() {
  control('text').value = wordInUse();
  control('font').value = state.font;
  control('size').value = state.size;
  control('curve').value = Math.log2(state.curve);
  control('lift').value = state.lift;
  control('shift').value = state.shift;
  control('accent').value = state.accent;
  control('range').value = state.range;
  control('cycle').value = state.cycle;
  showWeightRange();
}

const FIELD_WRITERS = {
  text(value) {
    state.text = value;
    sampleWord = null;
  },
  accent(value) {
    if (!isBlankLetter(value)) state.accent = value;
  },
  font(value) {
    state.font = value;
    showWeightRange();
  },
  bar(value) {
    state.bar = Number(value);
  },
  curve(value) {
    state.curve = Number((2 ** Number(value)).toFixed(2));
  },
  lift(value) {
    state.lift = Number(Number(value).toFixed(3));
  },
};

for (const name of ['weight', 'size', 'shift', 'range', 'cycle']) {
  FIELD_WRITERS[name] = (value) => {
    state[name] = Number(value);
  };
}

const DISCRETE_CONTROLS = ['wa-radio-group', 'wa-select'];

function pickColor(name, value) {
  if (name === 'start' || name === 'end') {
    pickEnd(name, value);
  } else if (name === 'accentColor') {
    state.accentColor[shownScheme()] = value;
  } else {
    if (name === 'darkPage') state.pageA = value;
    else state.pageB = value;
    remakeLinkedPartners();
  }
}

function updateSetting(event) {
  const field = event.target.closest('[name]');
  if (!field) return;
  const name = field.getAttribute('name');
  if (DISCRETE_CONTROLS.includes(field.localName) && event.type === 'input') {
    return;
  }

  if (field.localName === 'wa-color-picker') {
    if (field.value === field.dataset.shown) return;
    if (!CSS.supports('color', field.value)) return;
    pickColor(name, field.value);
  } else if (name in FIELD_WRITERS) {
    FIELD_WRITERS[name](field.value);
    if (name === 'accent' && event.type === 'change') {
      field.value = state.accent;
    }
  } else {
    return;
  }
  forgetFit();
  showEdit();
}

function toggleSetting(name) {
  if (name === 'display') {
    state.display = !state.display;
    state.bar = defaultBarFor(state.display);
  } else if (name === 'accentOn') {
    state.isAccentOn = !state.isAccentOn;
  } else {
    state.isDriftOn = !state.isDriftOn;
  }
}

function shownSample() {
  return [...samples.children].find((sample) => !sample.hidden).textContent;
}

function shuffleWord() {
  samples.randomize();
  state.text = shownSample();
  sampleWord = null;
  control('text').value = state.text;
}

function applyClickedEdit(target) {
  const hueChip = target.closest('.hue-chip');
  const markChip = target.closest('.chip-mark');
  const autoButton = target.closest('.auto-button');
  const linkToggle = target.closest('.link-toggle');
  const toggle = target.closest('.toggle');
  if (hueChip) {
    pickHue(hueChip.dataset.hue);
  } else if (markChip) {
    state.accent = markChip.dataset.accent;
    control('accent').value = state.accent;
  } else if (autoButton) {
    if (autoButton.getAttribute('aria-disabled') === 'true') return false;
    makeEndAuto(autoButton.dataset.end);
    if (document.activeElement === autoButton) {
      control(autoButton.dataset.end).focus();
    }
  } else if (linkToggle) {
    toggleLink(linkToggle.dataset.end);
  } else if (toggle) {
    toggleSetting(toggle.getAttribute('name'));
  } else if (target.closest('#shuffle')) {
    shuffleWord();
  } else if (target.closest('#undo-fit')) {
    restoreSnapshot(lastFit.snapshot);
  } else {
    return false;
  }
  return true;
}

function handleClick(event) {
  const { target } = event;
  if (target.closest('[data-shuffle]')) {
    accentIdeas.randomize();
    return;
  }
  if (target.closest('#fit-button')) {
    fitFailingSides();
    showEdit();
    return;
  }
  if (!applyClickedEdit(target)) return;
  forgetFit();
  showEdit();
}

const HUE_KEY_STEPS = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

function moveHueChoice(event) {
  const chip = event.target.closest('.hue-chip');
  if (!chip) return;
  let index = hueChips.indexOf(chip);
  if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = hueChips.length - 1;
  else if (event.key in HUE_KEY_STEPS) {
    index =
      (index + HUE_KEY_STEPS[event.key] + hueChips.length) % hueChips.length;
  } else return;
  event.preventDefault();
  hueChips[index].focus();
  hueChips[index].click();
}

function resetStudio() {
  Object.assign(state, structuredClone(DEFAULT_STUDIO), { side: state.side });
  links = null;
  setAsideCustom = null;
  forgetFit();
  samples.randomize();
  sampleWord = shownSample();
  writeFieldsFromState();
  showEdit();
}

let copiedTimer;
let copiedButton = null;

function restoreCopiedButton() {
  if (!copiedButton) return;
  copiedButton.textContent = COPY_LABELS.get(copiedButton);
  copiedButton.style.minInlineSize = '';
  copiedButton = null;
}

function confirmCopy(button, shownLabel, spoken) {
  clearTimeout(copiedTimer);
  restoreCopiedButton();
  copiedButton = button;
  button.style.minInlineSize = `${button.offsetWidth}px`;
  button.textContent = shownLabel;
  clearTimeout(lampSpeechTimer);
  lampSpeechTimer = null;
  lampSpoken.textContent = `${spoken} ${lampSentence}`;
  copiedTimer = setTimeout(() => {
    restoreCopiedButton();
    if (lampSpeechTimer === null) writeLampSpokenQuietly(lampSentence);
  }, COPIED_MS);
}

async function copyHtml() {
  try {
    await navigator.clipboard.writeText(writeHopHtml());
  } catch {
    codeDrawer.open = true;
    return;
  }
  confirmCopy(copyHtmlButton, 'Copied', 'HTML copied.');
}

async function copyLink() {
  flushAddress();
  const params = shareParams();
  try {
    await navigator.clipboard.writeText(
      `${location.origin}${location.pathname}${queryOf(params)}`
    );
  } catch {
    replaceAddress(params);
    confirmCopy(
      copyLinkButton,
      'Copy failed',
      'Couldn’t copy. The link is in the address bar.'
    );
    return;
  }
  confirmCopy(copyLinkButton, 'Copied', 'Link copied.');
}

// Keeps a control focused from below out from behind the pinned head. Fit's messages can make the head any height, and CSS can't read it.
function keepFocusClearOfHead() {
  const isPinned = getComputedStyle(head).position === 'sticky';
  document.documentElement.style.scrollPaddingBlockStart = isPinned
    ? `calc(${head.offsetHeight}px + 1rem)`
    : '';
}

function showCodeFormat() {
  codeWells.html.hidden = codeFormat.value !== 'html';
  codeWells.css.hidden = codeFormat.value !== 'css';
}

function flyWordIn({ detail: tripFrom }) {
  const rest = hop.getBoundingClientRect();
  const scale = tripFrom.width / rest.width;
  const top = tripFrom.top + (tripFrom.height - rest.height * scale) / 2;
  const translate = `${tripFrom.left - rest.left * scale}px ${top - rest.top * scale}px`;
  document.documentElement.animate(
    { translate: [translate, '0 0'], scale: [String(scale), '1'] },
    {
      duration: beatMs(),
      easing: getComputedStyle(document.documentElement).getPropertyValue(
        '--ease-bounce'
      ),
      fill: 'backwards',
      pseudoElement: '::view-transition-group(studio-word)',
    }
  );
}

document.addEventListener('wordtrip', flyWordIn);

await Promise.all(
  [
    'wa-color-picker',
    'wa-input',
    'wa-select',
    'wa-slider',
    'wa-radio-group',
    'wa-random-content',
    'wa-drawer',
  ].map((tag) => customElements.whenDefined(tag))
);

readLink();
state.side = document.documentElement.dataset.side;
if (!state.text) sampleWord = hop.textContent;
writeFieldsFromState();

studio.addEventListener('input', updateSetting);
studio.addEventListener('change', updateSetting);
studio.addEventListener('click', handleClick);
studio.addEventListener('keydown', moveHueChoice);
document
  .getElementById('controls')
  .addEventListener('submit', (event) => event.preventDefault());
document.getElementById('reset').addEventListener('click', resetStudio);
copyHtmlButton.addEventListener('click', copyHtml);
copyLinkButton.addEventListener('click', copyLink);
codeFormat.addEventListener('change', showCodeFormat);
codeDrawer.addEventListener('wa-show', showCode);
isColorModeOn.addEventListener('change', render);

document.addEventListener('sidechange', ({ detail }) => {
  state.side = detail.side;
  writeAddressSoon();
});
addEventListener('pagehide', flushAddress);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushAddress();
});
whenSideChanges(render);

// A frame later, because resizing the word from inside the observer resizes what it's watching.
new ResizeObserver(() => requestAnimationFrame(fitWordToStage)).observe(
  stageArt
);
new ResizeObserver(showStripScroll).observe(bridgeStrips);
new ResizeObserver(keepFocusClearOfHead).observe(head);
document.fonts.addEventListener('loadingdone', fitWordToStage);

paint();
studio.toggleAttribute('data-painted', true);
// A link with no word of its own would show a different random one on every reload.
if (sampleWord && hasOwnSetup()) replaceAddress(shareParams());
// Rows open at load shouldn't grow in. Only rows revealed afterwards animate.
setTimeout(() => studio.toggleAttribute('data-ready', true));
