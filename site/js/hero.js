import {
  LETTER_DROP,
  LETTER_HOP,
  beatMs,
  hopLetters,
  hopTiming,
  isMotionOk,
  isSelecting,
  longestWordLength,
  splitLetters,
} from './motion.js';
import { readSide } from './scheme.js';

const title = document.querySelector('.hero-title');
const wordmark = title.querySelector('hue-hop');
const bankFaders = [...document.querySelectorAll('.fader-bank wa-slider')];

// One fader per character of the wordmark, so each cap rides its letter's hop on the same delay and curve. Caps stay inside their slots.
function echoInFaders({ keyframes, beats }) {
  const duration = beatMs() * beats;
  const letterCount = splitLetters(wordmark.textContent.trim()).length;
  const { step } = hopTiming(letterCount, duration);
  const fontSize = parseFloat(getComputedStyle(wordmark).fontSize);
  bankFaders.forEach((fader, index) => {
    const cap = fader.shadowRoot?.querySelector('#thumb');
    const track = fader.shadowRoot?.querySelector('#track');
    if (!cap || !track) return;
    const room = (1 - Number(fader.value)) * track.offsetHeight;
    const frames = keyframes.map(({ translate, offset, easing }) => {
      const lift = parseFloat(translate.split(' ')[1]) * fontSize;
      return { translate: `0 ${Math.max(lift, -room)}px`, offset, easing };
    });
    cap.animate(frames, {
      duration,
      delay: index * step,
      fill: 'backwards',
    });
  });
}

function hopWordmark(motion) {
  echoInFaders(motion);
  return hopLetters(wordmark, motion);
}

await Promise.all(
  ['hue-hop', 'wa-slider'].map((tag) => customElements.whenDefined(tag))
);
await Promise.all(bankFaders.map((fader) => fader.updateComplete));
if (isMotionOk()) hopWordmark(LETTER_DROP);
title.classList.add('is-landed');

let holdTimer;
let wasHeld = false;
let isHolding = false;

function keepHopping() {
  if (!isHolding || isSelecting()) return;
  const total = hopWordmark(LETTER_HOP);
  setTimeout(keepHopping, total);
}

function stopHolding() {
  clearTimeout(holdTimer);
  isHolding = false;
}

title.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !isMotionOk()) return;
  wasHeld = false;
  holdTimer = setTimeout(() => {
    wasHeld = true;
    isHolding = true;
    keepHopping();
  }, beatMs() / 2);
});

for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
  title.addEventListener(type, stopHolding);
}

// Only a plain single click hops, so double-clicking or dragging to select the text still works.
title.addEventListener('click', (event) => {
  if (event.detail !== 1 || wasHeld || isSelecting() || !isMotionOk()) return;
  hopWordmark(LETTER_HOP);
  skipDemoAhead();
});

// The hero stage steps through the desk's sample words, one hue each, every four beats. It holds still on hover, off screen and under reduced motion.
const demo = document.querySelector('.hero-demo');
const demoWord = document.getElementById('hero-demo-word');
const demoHue = document.getElementById('hero-demo-hue');
const sampleWords = [...document.querySelectorAll('#samples span')].map(
  (sample) => sample.textContent.trim()
);
const demoLeds = [...document.querySelectorAll('.hero-demo-led')];
const hasDemo = Boolean(demo && sampleWords.length && demoLeds.length);
let demoStep = 1;
let demoTimer;
let isDemoVisible = false;

// Custom ends far apart on the wheel, which no preset spans. Each holds 4.5:1 across the whole word; Side B's are darker for the light background.
const CUSTOM_PAIRS = [
  { a: ['#f9875e', '#709afb'], b: ['#ad4216', '#3357b1'] },
  { a: ['#00c8c0', '#de75b4'], b: ['#007973', '#8b2868'] },
  { a: ['#d6a20a', '#de75b4'], b: ['#905e00', '#943171'] },
  { a: ['#80bf59', '#4ba3f7'], b: ['#3f7b04', '#005fae'] },
];

let shownSample;

function showSample(step) {
  const shownLed = demoLeds[step % demoLeds.length];
  const { hue, pair } = shownLed.dataset;
  const word = sampleWords[step % sampleWords.length];
  const [start, end] = hue ? [null, null] : CUSTOM_PAIRS[pair][readSide()];
  shownSample = { text: word, hue: hue ?? null, start, end };
  for (const name of ['hue', 'start', 'end']) {
    if (shownSample[name]) demoWord.setAttribute(name, shownSample[name]);
    else demoWord.removeAttribute(name);
  }
  demoHue.textContent = hue ?? `${start} → ${end}`;
  demoWord.textContent = word;
  demo.style.setProperty('--letters', longestWordLength(word));
  for (const led of demoLeds) {
    led.classList.toggle('is-lit', led === shownLed);
  }
}

function stepDemo() {
  demoStep += 1;
  showSample(demoStep);
  hopLetters(demoWord, LETTER_DROP);
}

function showNextSample() {
  if (document.hidden || !isMotionOk()) return;
  stepDemo();
  demoTimer = setTimeout(showNextSample, beatMs() * 4);
}

function playDemo(isOn) {
  clearTimeout(demoTimer);
  if (isOn && isMotionOk()) {
    demoTimer = setTimeout(showNextSample, beatMs() * 4);
  }
}

// Restarting the timer gives the clicked sample its full four beats.
function skipDemoAhead() {
  if (!hasDemo) return;
  stepDemo();
  playDemo(isDemoVisible);
}

if (hasDemo) {
  showSample(demoStep);
  document.addEventListener('sidechange', () => showSample(demoStep));
  demo.addEventListener('click', () => {
    document.dispatchEvent(
      new CustomEvent('trysample', { detail: shownSample })
    );
  });
  new IntersectionObserver(([entry]) => {
    isDemoVisible = entry.isIntersecting;
    playDemo(isDemoVisible);
  }).observe(demo);
  demo.addEventListener('pointerenter', () => playDemo(false));
  demo.addEventListener('pointerleave', () => playDemo(isDemoVisible));
  document.addEventListener('visibilitychange', () =>
    playDemo(isDemoVisible && !document.hidden)
  );
}
