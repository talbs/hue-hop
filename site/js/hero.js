import {
  LETTER_HOP,
  beatMs,
  hopLetters,
  isMotionOk,
  isSelecting,
} from './motion.js';

const title = document.querySelector('.playground-word');
const wordmark = title.querySelector('hue-hop');

await customElements.whenDefined('hue-hop');

let holdTimer;
let wasHeld = false;
let isHolding = false;

function keepHopping() {
  if (!isHolding || isSelecting()) return;
  const total = hopLetters(wordmark, LETTER_HOP);
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
  hopLetters(wordmark, LETTER_HOP);
});
