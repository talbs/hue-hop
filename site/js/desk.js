import { floorRatio, lowestLetterContrast } from './contrast.js';
import { whenSideChanges } from './scheme.js';

import {
  isMotionOk,
  longestWordLength,
  segmentPitch,
  typeOut,
} from './motion.js';
import { DEFAULT_STATE, describeMarkup, describeStudioLink } from './state.js';
import { fillCode } from './syntax.js';
import { isPlainClick } from './word-trip.js';

const desk = document.getElementById('desk');
const live = document.getElementById('live');
const stage = document.getElementById('stage');
const stageBars = stage?.querySelector('.stage-eq');
const textField = document.getElementById('desk-text');
const hueChips = [...document.querySelectorAll('#desk .hue-chip')];
const samples = document.getElementById('samples');
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

function readDeskState() {
  return {
    ...DEFAULT_STATE,
    text: textField.value,
    hue: checkedHue() ?? DEFAULT_STATE.hue,
  };
}

function checkHueChip(hue) {
  for (const chip of hueChips) {
    const isChecked = chip.dataset.hue === hue;
    chip.setAttribute('aria-checked', String(isChecked));
    chip.tabIndex = isChecked ? 0 : -1;
  }
}

const CONTRAST_FLOOR = 4.5;

function showContrast() {
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
  const isPass = ratio >= CONTRAST_FLOOR;
  lamp.dataset.state = isPass ? 'pass' : 'check';
  lampState.textContent = isPass ? 'Pass' : 'Check';
  lampDetail.textContent = `${floorRatio(ratio)}:1 of ${CONTRAST_FLOOR}`;
}

const STEP_BARS = 12;

function showStepBars() {
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
    const lit = Math.max(1, Math.round(segmentsTall * (0.2 + 0.8 * progress)));
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
    const state = readDeskState();
    if (live.textContent !== state.text) live.textContent = state.text;
    if (live.getAttribute('hue') !== state.hue)
      live.setAttribute('hue', state.hue);
    fillCode(markup, describeMarkup(state));
    stage.style.setProperty('--letters', longestWordLength(state.text));
    studioLink.href = describeStudioLink(state);
    stageHue.textContent = state.hue;
    showContrast();
    stopTyping();
    if (shouldTypeText && isMotionOk() && state.text) {
      stopTyping = typeOut(live, state.text);
    }
    shouldTypeText = false;
  });
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
    ['wa-input', 'wa-random-content'].map((tag) =>
      customElements.whenDefined(tag)
    )
  );
  textField.value = shownSample();
  textField.addEventListener('input', render);
  document.getElementById('shuffle').addEventListener('click', () => {
    samples.randomize();
    textField.value = shownSample();
    shouldTypeText = true;
    render();
  });
  for (const chip of hueChips) {
    chip.addEventListener('click', () => {
      checkHueChip(chip.dataset.hue);
      render();
    });
    chip.addEventListener('keydown', moveHueFocus);
  }
  // The word's trip can't leave with half a word on the stage.
  studioLink.addEventListener('click', (event) => {
    if (!isPlainClick(event)) return;
    stopTyping();
    shouldTypeText = false;
    live.textContent = textField.value;
  });
  whenSideChanges(render);
  showStepBars();
  render();
}
