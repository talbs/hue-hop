import { floorRatio, lowestLetterContrast } from './contrast.js';
import { readSide, whenSideChanges } from './scheme.js';

import {
  catchSoftStop,
  isMotionOk,
  longestWordLength,
  segmentPitch,
  typeOut,
} from './motion.js';
import {
  DEFAULT_STATE,
  decimalsIn,
  defaultLift,
  describeMarkup,
  describeStudioLink,
  styleFor,
} from './state.js';
import { fillCode } from './syntax.js';
import { isPlainClick } from './word-trip.js';

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
const hueChips = [...document.querySelectorAll('#desk .hue-chip')];
const customEndsRow = document.getElementById('custom-ends');
const customEndControls = [
  ...customEndsRow.querySelectorAll('.custom-end'),
].map((control) => ({
  control,
  end: control.dataset.end,
  picker: control.querySelector('wa-color-picker'),
  auto: control.querySelector('.end-auto'),
}));
const driftSwitch = document.getElementById('drift-switch');
const displaySwitch = document.getElementById('display-switch');
const samples = document.getElementById('samples');
const curveFader = document.getElementById('curve');
const shiftFader = document.getElementById('shift');
const liftFader = document.getElementById('lift');
const faders = [curveFader, shiftFader, liftFader];
const lamp = document.getElementById('lamp');
const stageHue = document.getElementById('stage-hue');
const lampState = document.getElementById('lamp-state');
const lampDetail = document.getElementById('lamp-detail');
const markup = document.getElementById('markup');
const studioLink = document.getElementById('studio-link');

function checkedHue() {
  return hueChips.find((chip) => chip.getAttribute('aria-checked') === 'true')
    ?.dataset.hue;
}

function readLift() {
  return Number(Number(liftFader.value).toFixed(3));
}

export function readDeskState() {
  const hue = checkedHue();
  const isCustom = hue === 'custom';
  return {
    ...DEFAULT_STATE,
    text: textField.value,
    hue: isCustom ? null : (hue ?? DEFAULT_STATE.hue),
    ...(isCustom && customEnds()),
    curve: Number(curveFader.value),
    shift: Number(shiftFader.value),
    lift: readLift(),
    drift: driftSwitch.getAttribute('aria-pressed') === 'true',
    display: displaySwitch.getAttribute('aria-pressed') === 'true',
  };
}

// A hue rests at its own lift and custom ends at 0, so a lift nobody moved follows the switch and stays out of the markup.
function moveLiftToRest(hue) {
  const currentHue = checkedHue();
  if (hue === currentHue || readLift() !== defaultLift(currentHue)) return;
  liftFader.value = defaultLift(hue);
  showFaderValue(liftFader);
}

function checkHueChip(hue) {
  moveLiftToRest(hue);
  for (const chip of hueChips) {
    const isChecked = chip.dataset.hue === hue;
    chip.setAttribute('aria-checked', String(isChecked));
    chip.tabIndex = isChecked ? 0 : -1;
  }
  customEndsRow.hidden = hue !== 'custom';
}

// Tomato. Side B's is darker because the same tomato fails 4.5:1 on the light background. It follows the side until someone picks their own.
const CUSTOM_DEFAULTS = {
  a: { start: '#e0582b', end: '#d6337f' },
  b: { start: '#bf4213', end: '#b43d83' },
};

function useSideDefaults() {
  const defaults = CUSTOM_DEFAULTS[readSide()];
  for (const { picker, end } of customEndControls) {
    if (!picker.dataset.picked) picker.value = defaults[end];
  }
}

// Each end is a picked color or left to Hue Hop. At least one stays picked, so the last picked end's AUTO switch is disabled.
function customEnds() {
  const ends = {};
  for (const { control, end, picker } of customEndControls) {
    if (!control.classList.contains('is-auto')) ends[end] = picker.value;
  }
  return ends;
}

function showCustomEnds() {
  const ends = customEnds();
  const pickedCount = Object.keys(ends).length;
  for (const { control, end, auto } of customEndControls) {
    const isAuto = control.classList.contains('is-auto');
    auto.setAttribute('aria-pressed', String(isAuto));
    auto.disabled = !isAuto && pickedCount < 2;
  }
}

function showFaderValue(fader) {
  desk.querySelector(`output[for="${fader.id}"]`).textContent = Number(
    fader.value
  ).toFixed(decimalsIn(fader.step));
}

function softStopOf(fader) {
  if (fader === curveFader) return [1, 0.1];
  if (fader === liftFader) return [defaultLift(checkedHue()), 0.004];
  return [0, 4];
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
  const bar = state.hue && state.display ? 3 : 4.5;
  const isPass = ratio >= bar;
  lamp.dataset.state = isPass ? 'pass' : 'check';
  lampState.textContent = isPass ? 'Pass' : 'Check';
  lampDetail.textContent = `${floorRatio(ratio)}:1 of ${bar}`;
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

let stopTyping = () => {};
let shouldTypeText = false;

let hasPendingRender = false;

function render() {
  if (hasPendingRender) return;
  hasPendingRender = true;
  requestAnimationFrame(() => {
    hasPendingRender = false;
    showCustomEnds();
    const state = readDeskState();
    writeStateTo(live, state);
    fillCode(markup, describeMarkup(state));
    stage.style.setProperty('--letters', longestWordLength(state.text));
    showStepBars(state);
    studioLink.href = describeStudioLink(state);
    stageHue.textContent = state.hue ?? 'custom';
    showContrast(state);
    stopTyping();
    if (shouldTypeText && isMotionOk() && state.text) {
      stopTyping = typeOut(live, state.text);
    }
    shouldTypeText = false;
  });
}

export function applyDeskState(state) {
  textField.value = state.text;
  liftFader.value = state.lift;
  checkHueChip(state.hue ?? 'custom');
  if (!state.hue) {
    for (const { control, end, picker } of customEndControls) {
      control.classList.toggle('is-auto', !state[end]);
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

function shownSample() {
  return [...samples.children].find((sample) => !sample.hidden).textContent;
}

function moveHueFocus(event) {
  const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  let next;
  const index = hueChips.indexOf(event.currentTarget);
  if (event.key in steps) {
    const isRtl = getComputedStyle(desk).direction === 'rtl';
    const isHorizontal =
      event.key.startsWith('ArrowL') || event.key.startsWith('ArrowR');
    const step = steps[event.key] * (isRtl && isHorizontal ? -1 : 1);
    next = hueChips[(index + step + hueChips.length) % hueChips.length];
  } else if (event.key === 'Home') {
    next = hueChips[0];
  } else if (event.key === 'End') {
    next = hueChips.at(-1);
  } else {
    return;
  }
  event.preventDefault();
  checkHueChip(next.dataset.hue);
  next.focus();
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
  for (const chip of hueChips) {
    chip.addEventListener('click', () => {
      checkHueChip(chip.dataset.hue);
      render();
    });
    chip.addEventListener('keydown', moveHueFocus);
  }
  for (const { control, picker, auto } of customEndControls) {
    for (const type of ['input', 'change']) {
      picker.addEventListener(type, () => {
        picker.dataset.picked = 'true';
        control.classList.remove('is-auto');
        checkHueChip('custom');
        render();
      });
    }
    auto.addEventListener('click', () => {
      control.classList.toggle('is-auto');
      checkHueChip('custom');
      render();
    });
  }
  // The word's trip can't leave with half a word on the stage.
  studioLink.addEventListener('click', (event) => {
    if (!isPlainClick(event)) return;
    stopTyping();
    shouldTypeText = false;
    live.textContent = textField.value;
  });
  useSideDefaults();
  for (const fader of faders) {
    fader.addEventListener('input', () => {
      const [stop, reach] = softStopOf(fader);
      catchSoftStop(fader, stop, reach);
      showFaderValue(fader);
      render();
    });
  }
  document.addEventListener('sidechange', useSideDefaults);
  whenSideChanges(render);
  render();
}
