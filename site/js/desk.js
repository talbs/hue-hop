import { whenSideChanges } from './scheme.js';

import {
  isMotionOk,
  longestWordLength,
  STAGE_BARS,
  showStepBars,
  typeOut,
} from './motion.js';
import {
  DEFAULT_STATE,
  describeCustomStudioLink,
  describeMarkup,
  describeStudioLink,
} from './state.js';
import { fillCode } from './syntax.js';
import { isPlainClick } from './word-trip.js';

const desk = document.getElementById('desk');
const live = document.getElementById('live');
const stage = document.getElementById('stage');
const stageBars = stage?.querySelector('.stage-eq');
const textField = document.getElementById('desk-text');
const hueChips = [...document.querySelectorAll('#desk .hue-chip')];
const samples = document.getElementById('samples');
const stageHue = document.getElementById('stage-hue');
const markup = document.getElementById('markup');
const studioLink = document.getElementById('studio-link');
const customLink = document.getElementById('custom-link');
const toggles = [...document.querySelectorAll('#desk .toggle')];

function checkedHue() {
  return hueChips.find((chip) => chip.getAttribute('aria-checked') === 'true')
    ?.dataset.hue;
}

function isToggleOn(name) {
  const toggle = toggles.find((each) => each.name === name);
  return toggle?.getAttribute('aria-pressed') === 'true';
}

function readDeskState() {
  return {
    ...DEFAULT_STATE,
    text: textField.value,
    hue: checkedHue() ?? DEFAULT_STATE.hue,
    drift: isToggleOn('drift'),
    display: isToggleOn('display'),
  };
}

function checkHueChip(hue) {
  for (const chip of hueChips) {
    const isChecked = chip.dataset.hue === hue;
    chip.setAttribute('aria-checked', String(isChecked));
    chip.tabIndex = isChecked ? 0 : -1;
  }
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
    live.toggleAttribute('drift', state.drift);
    live.toggleAttribute('display', state.display);
    fillCode(markup, describeMarkup(state));
    stage.style.setProperty('--letters', longestWordLength(state.text));
    studioLink.href = describeStudioLink(state);
    customLink.href = describeCustomStudioLink(state);
    stageHue.textContent = state.hue;
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
  for (const toggle of toggles) {
    toggle.addEventListener('click', () => {
      const isOn = toggle.getAttribute('aria-pressed') === 'true';
      toggle.setAttribute('aria-pressed', String(!isOn));
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
  whenSideChanges(render);
  showStepBars(stageBars, STAGE_BARS);
  render();
}
