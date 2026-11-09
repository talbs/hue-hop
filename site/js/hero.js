import {
  LETTER_DROP,
  LETTER_HOP,
  beatMs,
  hopLetters,
  hopTiming,
  isMotionOk,
  isSelecting,
  splitLetters,
} from './motion.js';

const title = document.querySelector('.hero-title');
const wordmark = title.querySelector('hue-hop');
const bankFaders = [...document.querySelectorAll('.fader-bank wa-slider')];

// One fader per character of the wordmark, so each cap rides its letter's hop on the same delay and curve. Caps stay inside their slots.
function echoInFaders(motion) {
  if (!bankFaders[0]?.offsetParent) return;
  const { keyframes, beats } = motion;
  const isFilled = motion === LETTER_HOP;
  const duration = beatMs() * beats;
  const letters = splitLetters(wordmark.textContent.trim());
  const { step } = hopTiming(letters.length, duration);
  const fontSize = parseFloat(getComputedStyle(wordmark).fontSize);
  bankFaders.forEach((fader, index) => {
    const cap = fader.shadowRoot?.querySelector('#thumb');
    const track = fader.shadowRoot?.querySelector('#track');
    const fill = fader.shadowRoot?.querySelector('#indicator');
    if (!cap || !track || !fill) return;
    const restShare = 1 - Number(fader.value);
    const room = restShare * track.offsetHeight;
    const capFrames = [];
    const fillFrames = [];
    for (const { translate, offset, easing } of keyframes) {
      const lift = Math.max(
        parseFloat(translate.split(' ')[1]) * fontSize,
        -room
      );
      capFrames.push({ translate: `0 ${lift}px`, offset, easing });
      fillFrames.push({
        top: `calc(${restShare * 100}% + ${lift}px)`,
        offset,
        easing,
      });
    }
    const timing = { duration, delay: index * step, fill: 'backwards' };
    cap.animate(capFrames, timing);
    if (!isFilled || letters[index]?.isBlank) return;
    // The indicator rests at zero height on the cap, so moving its top edge with the cap fills the travel.
    fill.animate(fillFrames, timing);
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
});
