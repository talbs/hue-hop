import { isColorModeOn } from './contrast.js';
import { whenSideChanges } from './scheme.js';

import {
  isMotionOk,
  revealLetters,
  STAGE_BARS,
  showStepBars,
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
const wordLine = live?.closest('.playground-word');
const stage = document.getElementById('stage');
const stageBars = stage?.querySelector('.stage-eq');
const stepStrip = stage?.querySelector('.step-strip');
const stepStripRow = stage?.querySelector('.step-strip-row');
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

let wordFit = 1;

function setWordFit(fit) {
  wordFit = fit;
  stage.style.setProperty('--word-fit', fit);
}

// The size may be mid-glide, so this works from the width per pixel of size and the size before the fit, neither of which glides.
function fitWordToStage(text) {
  if (live.textContent !== text) return;
  const width = live.getBoundingClientRect().width;
  if (width === 0) return;
  const lineStyle = getComputedStyle(wordLine);
  const widthPerSizePixel = width / parseFloat(lineStyle.fontSize);
  const unfitSize = parseFloat(lineStyle.getPropertyValue('--word-base'));
  const fit = Math.min(
    wordLine.clientWidth / (widthPerSizePixel * unfitSize),
    1
  );
  if (Math.abs(fit - wordFit) >= 0.001) setWordFit(fit);
  if (lineStyle.transitionDuration === '0s') trimOverflow();
}

// Width doesn't scale exactly with size, so once the word sits at its fitted size it is measured again.
function trimOverflow() {
  const overflow = live.getBoundingClientRect().width / wordLine.clientWidth;
  if (overflow > 1) setWordFit(wordFit / overflow);
}

const MAX_STEP_WIDTH = 16;
const BAR_GAP = 1;

function readStepColors() {
  return Array.from(
    { length: live.hops ?? 0 },
    (_, step) => getComputedStyle(live, `::highlight(hue-hop-${step})`).color
  );
}

// The strip may take the stage's width less 5rem, which keeps it clear of the hue name, and less its START and END labels.
function roomForSteps() {
  const labels = [...stepStrip.children].filter(
    (child) => child !== stepStripRow
  );
  const gap = parseFloat(getComputedStyle(stepStrip).columnGap);
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  let room = wordLine.clientWidth - 5 * remPx - gap * labels.length;
  for (const label of labels) room -= label.offsetWidth;
  return room;
}

function paintStepStrip() {
  const colors = isColorModeOn.matches ? readStepColors() : [];
  stepStrip.hidden = colors.length === 0;
  if (colors.length === 0) return;

  const room = roomForSteps();
  const roomPerStep = (room - (colors.length - 1) * BAR_GAP) / colors.length;
  const stepWidth = Math.min(MAX_STEP_WIDTH, Math.max(2, roomPerStep));
  stepStripRow.style.setProperty('--bar', `${stepWidth.toFixed(1)}px`);

  // Chips that stay are recolored in place so the color glides. Only new ones drop in.
  while (stepStripRow.children.length > colors.length) {
    stepStripRow.lastElementChild.remove();
  }
  for (const [index, color] of colors.entries()) {
    let chip = stepStripRow.children[index];
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'fit-swatch is-new';
      stepStripRow.append(chip);
    }
    chip.style.setProperty('--swatch', color);
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
    stopTyping();
    const isRevealing = shouldTypeText && isMotionOk() && state.text;
    // A swapped word takes its new size at once, so the reveal measures the letters where they land.
    if (isRevealing) wordLine.classList.add('is-swapping');
    fitWordToStage(state.text);
    studioLink.href = describeStudioLink(state);
    customLink.href = describeCustomStudioLink(state);
    stageHue.textContent = state.hue;
    if (isRevealing) {
      stopTyping = revealLetters(wordLine, live, state.text);
    }
    shouldTypeText = false;
    // The element re-steps its colors on the next frame.
    requestAnimationFrame(paintStepStrip);
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
  for (const link of [studioLink, customLink]) {
    link.addEventListener('click', (event) => {
      if (!isPlainClick(event)) return;
      stopTyping();
      shouldTypeText = false;
      live.textContent = textField.value;
    });
  }
  wordLine.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'font-size') trimOverflow();
  });
  new ResizeObserver(() => {
    fitWordToStage(textField.value);
    paintStepStrip();
  }).observe(stage);
  document.fonts.ready.then(() => fitWordToStage(textField.value));
  isColorModeOn.addEventListener('change', paintStepStrip);
  whenSideChanges(render);
  showStepBars(stageBars, STAGE_BARS);
  render();
}
