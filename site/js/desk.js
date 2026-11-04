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
import {
  DEFAULT_STATE,
  describeMarkup,
  describeStudioLink,
  styleFor,
} from './state.js';
import { fillCode } from './syntax.js';

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

function checkSleeve(hue) {
  for (const sleeve of sleeves) {
    const isChecked = sleeve.dataset.hue === hue;
    sleeve.setAttribute('aria-checked', String(isChecked));
    sleeve.tabIndex = isChecked ? 0 : -1;
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
    showTextInSleeves(state.text);
    sleeveSamples.forEach((hop) => colorEllipsis(hop.parentElement));
    fillCode(markup, describeMarkup(state));
    stage.style.setProperty('--letters', longestWordLength(state.text));
    showStepBars(state);
    studioLink.href = describeStudioLink(state);
    stageHue.textContent = state.hue ?? 'custom';
    showContrast(state);
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
