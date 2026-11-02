import { lowestLetterContrast } from './contrast.js';
import { readSide } from './scheme.js';

import {
  LETTER_HOP,
  beatMs,
  hopLetters,
  isMotionOk,
  splitLetters,
} from './motion.js';
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
const textField = document.getElementById('desk-text');
const sleeves = [...document.querySelectorAll('.sleeve[role="radio"]')];
const customLink = document.getElementById('custom-link');
const driftSwitch = document.getElementById('drift-switch');
const displaySwitch = document.getElementById('display-switch');
const samples = document.getElementById('samples');
const sleeveSamples = [...document.querySelectorAll('.sleeve-title hue-hop')];
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
  return {
    ...DEFAULT_STATE,
    text: textField.value,
    hue: checked?.dataset.hue ?? DEFAULT_STATE.hue,
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

function render() {
  if (hasPendingRender) return;
  hasPendingRender = true;
  requestAnimationFrame(() => {
    hasPendingRender = false;
    const state = readDeskState();
    writeStateTo(live, state);
    showTextInSleeves(state.text);
    showMarkup(describeMarkup(state));
    studioLink.href = describeStudioLink(state);
    customLink.href = describeStudioLink({
      ...state,
      hue: null,
      start: 'darkorange',
      end: 'crimson',
      display: false,
      lift: 0,
    });
    stageHue.textContent = state.hue;
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
  checkSleeve(state.hue);
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
    ['wa-input', 'wa-slider', 'wa-random-content'].map((tag) =>
      customElements.whenDefined(tag)
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
  for (const fader of faders) {
    fader.addEventListener('input', () => {
      showFaderValue(fader);
      render();
    });
  }
  document.addEventListener('sidechange', render);
  render();
}
