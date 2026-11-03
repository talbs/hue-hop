import { lowestLetterContrast } from './contrast.js';
import { letterRights, readSide } from './scheme.js';

import {
  LETTER_HOP,
  beatMs,
  hopLetters,
  isMotionOk,
  longestWordLength,
  segmentPitch,
  splitLetters,
} from './motion.js';
import { RAINBOW_MARKUP, paintRainbow, rainbowLine } from './rainbow.js';
import { STUDIO_URL } from './urls.js';

export const DEFAULT_STATE = {
  text: 'Halftime',
  hue: 'dusk',
  start: null,
  end: null,
  curve: 1,
  shift: 0,
  lift: 0.021,
  drift: false,
  display: false,
  accent: null,
};

// hues.css sets the lift for every hue, so only custom ends start from 0.
function defaultLift(state) {
  return state.hue ? DEFAULT_STATE.lift : 0;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function changedTuning(state) {
  const defaults = { ...DEFAULT_STATE, lift: defaultLift(state) };
  return ['curve', 'shift', 'lift'].filter(
    (name) => state[name] !== defaults[name]
  );
}

function styleFor(state) {
  return changedTuning(state)
    .map((name) => `--hop-${name}: ${state[name]}`)
    .join('; ');
}

export function writeStateTo(element, state) {
  if (element.textContent !== state.text) element.textContent = state.text;
  for (const name of ['hue', 'start', 'end']) {
    if (state[name]) element.setAttribute(name, state[name]);
    else element.removeAttribute(name);
  }
  element.toggleAttribute('drift', state.drift);
  element.toggleAttribute('display', state.display);
  const style = styleFor(state);
  if (style) element.setAttribute('style', style);
  else element.removeAttribute('style');
}

export function describeMarkup(state) {
  const parts = ['hue-hop'];
  for (const name of ['hue', 'start', 'end']) {
    if (state[name]) parts.push(`${name}="${escapeHtml(state[name])}"`);
  }
  if (state.display) parts.push('display');
  if (state.drift) parts.push('drift');
  const style = styleFor(state);
  if (style) parts.push(`style="${escapeHtml(style)}"`);
  const element = `<${parts.join(' ')}>${escapeHtml(state.text)}</hue-hop>`;
  if (!state.accent) return element;
  return `${element}<span class="accent">${escapeHtml(state.accent)}</span>`;
}

export function describeStudioLink(state) {
  const params = new URLSearchParams();
  params.set('text', state.text);
  if (state.hue !== DEFAULT_STATE.hue) params.set('hue', state.hue ?? 'custom');
  if (state.start) params.set('start', state.start);
  if (state.end) params.set('end', state.end);
  for (const name of changedTuning(state)) params.set(name, state[name]);
  if (state.drift) params.set('drift', '1');
  if (state.display) params.set('display', '1');
  if (state.accent) params.set('accent', state.accent);
  params.set('scheme', readSide());
  return `${STUDIO_URL}?${params}`;
}

const desk = document.getElementById('desk');
const live = document.getElementById('live');
const stage = document.getElementById('stage');
const stageBars = stage?.querySelector('.stage-eq');
const textField = document.getElementById('desk-text');
const sleeves = [...document.querySelectorAll('.sleeves [role="radio"]')];
const oneColor = document.getElementById('one-color');
const endSlices = [...oneColor.querySelectorAll('.end-slice')].map((slice) => ({
  slice,
  end: slice.dataset.end,
  picker: slice.querySelector('wa-color-picker'),
  auto: slice.querySelector('.end-auto'),
}));
const oneColorSample = document.getElementById('one-color-sample');
const driftSwitch = document.getElementById('drift-switch');
const displaySwitch = document.getElementById('display-switch');
const samples = document.getElementById('samples');
const sleeveSamples = [...document.querySelectorAll('.sleeve-title hue-hop')];
const ellipsisContext = document.createElement('canvas').getContext('2d');
const curveFader = document.getElementById('curve');
const shiftFader = document.getElementById('shift');
const faders = [curveFader, shiftFader];
const lamp = document.getElementById('lamp');
const stageHue = document.getElementById('stage-hue');
const lampState = document.getElementById('lamp-state');
const lampDetail = document.getElementById('lamp-detail');
const markup = document.getElementById('markup');
const studioLink = document.getElementById('studio-link');
const tryArea = document.getElementById('try');
const rainbowDoor = document.getElementById('rainbow-door');
const rainbowStageLine = document.getElementById('rainbow-line');
const rainbowNews = document.getElementById('rainbow-news');

export function readDeskState() {
  const checked = sleeves.find(
    (sleeve) => sleeve.getAttribute('aria-checked') === 'true'
  );
  const isOneColor = checked?.dataset.hue === 'custom';
  return {
    ...DEFAULT_STATE,
    text: textField.value,
    hue: isOneColor ? null : (checked?.dataset.hue ?? DEFAULT_STATE.hue),
    ...(isOneColor && { ...customEnds(), lift: 0 }),
    curve: Number(curveFader.value),
    shift: Number(shiftFader.value),
    drift: driftSwitch.getAttribute('aria-pressed') === 'true',
    display: displaySwitch.getAttribute('aria-pressed') === 'true',
  };
}

// Rainbow checks no hue, so the first one keeps the group in the Tab order. Checking any real hue ends it.
function checkSleeve(hue) {
  if (hue !== null) endRainbow();
  const hasMatch = sleeves.some((sleeve) => sleeve.dataset.hue === hue);
  for (const [index, sleeve] of sleeves.entries()) {
    const isChecked = sleeve.dataset.hue === hue;
    sleeve.setAttribute('aria-checked', String(isChecked));
    sleeve.tabIndex = isChecked || (!hasMatch && index === 0) ? 0 : -1;
  }
}

// Tomato. Side B's is darker because the same tomato fails 4.5:1 on the light background. It follows the side until someone picks their own.
const CUSTOM_DEFAULTS = {
  a: { start: '#e0582b', end: '#d6337f' },
  b: { start: '#bf4213', end: '#b43d83' },
};

function useSideDefaults() {
  const defaults = CUSTOM_DEFAULTS[readSide()];
  for (const { picker, end } of endSlices) {
    if (!picker.dataset.picked) picker.value = defaults[end];
  }
}

// Each end is a picked color or left to Hue Hop. At least one stays picked, so the last picked end's AUTO switch is disabled.
function customEnds() {
  const ends = {};
  for (const { slice, end, picker } of endSlices) {
    if (!slice.classList.contains('is-auto')) ends[end] = picker.value;
  }
  return ends;
}

function showOneColor() {
  const ends = customEnds();
  const pickedCount = Object.keys(ends).length;
  for (const { slice, end, auto } of endSlices) {
    const isAuto = slice.classList.contains('is-auto');
    if (ends[end]) oneColorSample.setAttribute(end, ends[end]);
    else oneColorSample.removeAttribute(end);
    auto.setAttribute('aria-pressed', String(isAuto));
    auto.disabled = !isAuto && pickedCount < 2;
  }
}

function showFaderValue(fader) {
  const decimals = fader.step < 1 ? 1 : 0;
  desk.querySelector(`output[for="${fader.id}"]`).textContent = Number(
    fader.value
  ).toFixed(decimals);
}

function showStudioLink(state) {
  if (isRainbow) {
    studioLink.removeAttribute('href');
    studioLink.setAttribute('aria-disabled', 'true');
    studioLink.setAttribute('aria-describedby', 'markup');
    return;
  }
  studioLink.href = describeStudioLink(state);
  studioLink.removeAttribute('aria-disabled');
  studioLink.setAttribute('aria-describedby', 'studio-caption');
}

function showContrast(state) {
  const ratio = lowestLetterContrast(
    live,
    getComputedStyle(stage).backgroundColor
  );
  if (Number.isNaN(ratio)) {
    lamp.dataset.state = 'off';
    lampState.textContent = '—';
    lampDetail.textContent = '';
    return;
  }
  const bar = state.display ? 3 : 4.5;
  const isPass = ratio >= bar;
  lamp.dataset.state = isPass ? 'pass' : 'check';
  lampState.textContent = isPass ? 'Pass' : 'Check';
  lampDetail.textContent = `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1 of ${bar}`;
}

// microlighter re-highlights every code block on the page per event, so a fader drag highlights once it pauses, not every frame.
let highlightTimer;

function showMarkup(text) {
  if (markup.textContent === text) return;
  markup.textContent = text;
  clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    markup.dispatchEvent(new Event('syntax-highlight', { bubbles: true }));
  }, beatMs() / 8);
}

const STEP_BARS = 12;

function showStepBars(state) {
  if (stageBars.children.length !== STEP_BARS) {
    stageBars.replaceChildren(
      ...Array.from({ length: STEP_BARS }, () => document.createElement('span'))
    );
  }
  // Heights snap to whole segments, so no bar ends in a sliver of an LED.
  const segment = segmentPitch(stageBars);
  const segmentsTall = Math.floor(stageBars.clientHeight / segment);
  [...stageBars.children].forEach((bar, index) => {
    const progress = index / (STEP_BARS - 1);
    const lit = Math.max(
      1,
      Math.round(segmentsTall * (0.2 + 0.8 * progress ** state.curve))
    );
    bar.style.height = `${lit * segment}px`;
  });
}

let isRainbow = false;
let wasDriftOn = false;

function showRainbowLine() {
  const line = isRainbow ? rainbowLine(lamp.dataset.state) : '';
  if (rainbowStageLine.textContent === line) return;
  rainbowStageLine.textContent = line;
  rainbowStageLine.hidden = !line;
}

// The lamp's own live region would say Pass on top of the line, so it stays quiet until this one has spoken.
function announceRainbow() {
  const line = rainbowStageLine.textContent;
  rainbowNews.textContent = line ? `Rainbow. ${line}` : 'Rainbow.';
  setTimeout(() => lampState.setAttribute('aria-live', 'polite'), beatMs());
}

function hopWhenScrolled() {
  if (!isMotionOk()) return;
  const hop = () => hopLetters(live, LETTER_HOP);
  const box = tryArea.getBoundingClientRect();
  const isScrolling = 'onscrollend' in window && Math.abs(box.top) > 1;
  if (isScrolling) addEventListener('scrollend', hop, { once: true });
  else hop();
}

function startRainbow() {
  if (!isRainbow) {
    isRainbow = true;
    wasDriftOn = driftSwitch.getAttribute('aria-pressed') === 'true';
  }
  paintRainbow();
  driftSwitch.setAttribute('aria-pressed', 'false');
  driftSwitch.disabled = true;
  checkSleeve(null);
  rainbowNews.textContent = '';
  lampState.setAttribute('aria-live', 'off');
  render();
  requestAnimationFrame(announceRainbow);
  stage.focus({ preventScroll: true });
  tryArea.scrollIntoView();
  hopWhenScrolled();
}

function endRainbow() {
  if (!isRainbow) return;
  isRainbow = false;
  driftSwitch.disabled = false;
  driftSwitch.setAttribute('aria-pressed', String(wasDriftOn));
}

let typingRun = 0;
let shouldTypeText = false;

function hopSleeve(sleeve) {
  if (!isMotionOk()) return;
  hopLetters(sleeve.querySelector('.sleeve-title hue-hop'), LETTER_HOP);
}

// One letter per 64th note, so the stage types on the same beat as the rest of the motion.
function typeOut(element, text, run) {
  const letters = splitLetters(text).map(({ letter }) => letter);
  const letterMs = beatMs() / 16;
  let shownCount = 0;
  const typeNext = () => {
    if (run !== typingRun) return;
    shownCount += 1;
    element.textContent = letters.slice(0, shownCount).join('');
    if (shownCount < letters.length) setTimeout(typeNext, letterMs);
  };
  element.textContent = '';
  typeNext();
}

let hasPendingRender = false;

// A truncated title draws its ellipsis in the title's own color, so it borrows the painted color of the first letter it hides.
function colorEllipsis(title) {
  title.style.removeProperty('color');
  if (title.scrollWidth <= title.clientWidth) return;
  const hop = title.querySelector('hue-hop');
  const titleStyle = getComputedStyle(title);
  ellipsisContext.font = titleStyle.font;
  const ellipsisStart =
    title.getBoundingClientRect().right -
    parseFloat(titleStyle.paddingInlineEnd) -
    ellipsisContext.measureText('…').width;
  const rights = letterRights(hop);
  const hiddenIndex = rights.findIndex((right) => right > ellipsisStart);
  if (hiddenIndex < 0) return;
  const step = Math.floor((hiddenIndex * hop.hops) / rights.length);
  title.style.color = getComputedStyle(
    hop,
    `::highlight(hue-hop-${step})`
  ).color;
}

function render() {
  if (hasPendingRender) return;
  hasPendingRender = true;
  requestAnimationFrame(() => {
    hasPendingRender = false;
    showOneColor();
    const state = readDeskState();
    writeStateTo(live, state);
    live.toggleAttribute('data-rainbow', isRainbow);
    showTextInSleeves(state.text);
    sleeveSamples.forEach((hop) => colorEllipsis(hop.parentElement));
    showMarkup(isRainbow ? RAINBOW_MARKUP : describeMarkup(state));
    stage.style.setProperty('--letters', longestWordLength(state.text));
    showStepBars(state);
    showStudioLink(state);
    stageHue.textContent = isRainbow ? 'Rainbow' : (state.hue ?? 'custom');
    showContrast(state);
    showRainbowLine();
    typingRun += 1;
    if (shouldTypeText && isMotionOk() && state.text) {
      typeOut(live, state.text, typingRun);
    }
    shouldTypeText = false;
  });
}

export function applyDeskState(state) {
  textField.value = state.text;
  checkSleeve(state.hue ?? 'custom');
  if (!state.hue) {
    for (const { slice, end, picker } of endSlices) {
      slice.classList.toggle('is-auto', !state[end]);
      if (!state[end]) continue;
      picker.value = state[end];
      picker.dataset.picked = 'true';
    }
  }
  curveFader.value = state.curve;
  shiftFader.value = state.shift;
  faders.forEach(showFaderValue);
  driftSwitch.setAttribute('aria-pressed', String(state.drift));
  displaySwitch.setAttribute('aria-pressed', String(state.display));
  render();
}

function showTextInSleeves(text) {
  const sample = text.trim() || 'Hue Hop';
  for (const element of sleeveSamples) {
    if (element.textContent !== sample) element.textContent = sample;
  }
}

function shownSample() {
  return [...samples.children].find((sample) => !sample.hidden).textContent;
}

function moveSleeveFocus(event) {
  const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  let next;
  const index = sleeves.indexOf(event.currentTarget);
  if (event.key in steps) {
    const isRtl = getComputedStyle(desk).direction === 'rtl';
    const isHorizontal =
      event.key.startsWith('ArrowL') || event.key.startsWith('ArrowR');
    const step = steps[event.key] * (isRtl && isHorizontal ? -1 : 1);
    next = sleeves[(index + step + sleeves.length) % sleeves.length];
  } else if (event.key === 'Home') {
    next = sleeves[0];
  } else if (event.key === 'End') {
    next = sleeves.at(-1);
  } else {
    return;
  }
  event.preventDefault();
  checkSleeve(next.dataset.hue);
  hopSleeve(next);
  next.focus();
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  render();
}

if (desk) {
  await Promise.all(
    ['wa-color-picker', 'wa-input', 'wa-slider', 'wa-random-content'].map(
      (tag) => customElements.whenDefined(tag)
    )
  );
  const firstText = shownSample();
  textField.value = firstText;
  textField.addEventListener('input', render);
  document.getElementById('shuffle').addEventListener('click', () => {
    samples.randomize();
    textField.value = shownSample();
    shouldTypeText = true;
    render();
  });
  for (const toggle of [driftSwitch, displaySwitch]) {
    toggle.addEventListener('click', () => {
      const isOn = toggle.getAttribute('aria-pressed') === 'true';
      toggle.setAttribute('aria-pressed', String(!isOn));
      render();
    });
  }
  document.addEventListener('trysample', (event) => {
    endRainbow();
    shouldTypeText = true;
    applyDeskState({ ...readDeskState(), ...event.detail });
  });
  document.getElementById('reset').addEventListener('click', () => {
    shouldTypeText = true;
    applyDeskState({ ...DEFAULT_STATE, text: firstText });
  });
  for (const sleeve of sleeves) {
    sleeve.addEventListener('click', () => {
      checkSleeve(sleeve.dataset.hue);
      hopSleeve(sleeve);
      render();
    });
    sleeve.addEventListener('keydown', moveSleeveFocus);
  }
  for (const { slice, picker, auto } of endSlices) {
    for (const type of ['input', 'change']) {
      picker.addEventListener(type, () => {
        picker.dataset.picked = 'true';
        slice.classList.remove('is-auto');
        checkSleeve('custom');
        render();
      });
    }
    auto.addEventListener('click', () => {
      slice.classList.toggle('is-auto');
      checkSleeve('custom');
      render();
    });
  }
  rainbowDoor.addEventListener('click', startRainbow);
  useSideDefaults();
  const titleSizes = new ResizeObserver((entries) => {
    for (const { target } of entries) colorEllipsis(target);
  });
  sleeveSamples.forEach((hop) => titleSizes.observe(hop.parentElement));
  for (const fader of faders) {
    fader.addEventListener('input', () => {
      showFaderValue(fader);
      render();
    });
  }
  document.addEventListener('sidechange', () => {
    useSideDefaults();
    render();
  });
  render();
}
