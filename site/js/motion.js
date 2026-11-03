// Shared by every scripted animation: the beat comes from the --tempo token, so CSS and JS motion stay on the same grid.
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const blankPattern = /^[\s\p{Default_Ignorable_Code_Point}]*$/u;

export function isBlankLetter(text) {
  return blankPattern.test(text);
}

export function isSelecting() {
  return !document.getSelection().isCollapsed;
}

export function isMotionOk() {
  return matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

export function beatMs() {
  const tempo = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--tempo')
  );
  return 60000 / tempo;
}

// One hop rhythm for every stepped effect: each step starts a 32nd note after the last and moves for a third of a beat, landing on an ease-out.
export const HOP_EASING = 'ease-out';

export function hopTiming(count, length = beatMs() / 3) {
  const beat = beatMs();
  const step = Math.min(beat / 8, beat / Math.max(count, 1));
  return { step, length, total: step * Math.max(count - 1, 0) + length };
}

// A dropped slat: it speeds up as it falls, hits bottom at FALL_IMPACT, bounces back 6% and lands again.
export const FALL_IMPACT = 0.7;

export function fallAndBounce(progress) {
  if (progress < FALL_IMPACT) return (progress / FALL_IMPACT) ** 2;
  const bounce = (progress - FALL_IMPACT) / (1 - FALL_IMPACT);
  return 1 - 0.24 * bounce * (1 - bounce);
}

// Squash and stretch pivot on the baseline, so a letter crouches before it jumps, eases into the top of the arc, falls faster as it drops, and squashes when it lands.
export const LETTER_HOP = {
  beats: 0.6,
  keyframes: [
    { translate: '0 0', scale: '1 1', easing: 'ease-in-out' },
    { translate: '0 0', scale: '1.1 0.88', offset: 0.18, easing: 'ease-out' },
    {
      translate: '0 -0.13em',
      scale: '0.93 1.09',
      offset: 0.32,
      easing: 'ease-out',
    },
    { translate: '0 -0.22em', scale: '1 1', offset: 0.5, easing: 'ease-in' },
    { translate: '0 0', scale: '0.95 1.06', offset: 0.7, easing: 'ease-out' },
    {
      translate: '0 0',
      scale: '1.08 0.92',
      offset: 0.82,
      easing: 'ease-in-out',
    },
    {
      translate: '0 0',
      scale: '0.99 1.02',
      offset: 0.92,
      easing: 'ease-in-out',
    },
    { translate: '0 0', scale: '1 1' },
  ],
};

export const LETTER_DROP = {
  beats: 0.7,
  keyframes: [
    { translate: '0 -0.5em', scale: '0.9 1.14', opacity: 0, easing: 'ease-in' },
    {
      translate: '0 0',
      scale: '0.93 1.1',
      opacity: 1,
      offset: 0.5,
      easing: 'ease-out',
    },
    { translate: '0 0', scale: '1.13 0.87', offset: 0.64, easing: 'ease-out' },
    {
      translate: '0 -0.04em',
      scale: '0.98 1.03',
      offset: 0.8,
      easing: 'ease-in',
    },
    {
      translate: '0 0',
      scale: '1.02 0.98',
      offset: 0.9,
      easing: 'ease-in-out',
    },
    { translate: '0 0', scale: '1 1' },
  ],
};

// Splits a hue-hop into one span per letter so each can move, then puts the plain text back. A selection made mid-hop keeps the spans, since swapping the text would drop it.
function splitIntoLetters(hop) {
  const spans = splitLetters(hop.textContent.trim()).map(({ letter }) => {
    const span = document.createElement('span');
    span.className = 'hop-letter';
    span.textContent = letter;
    return span;
  });
  hop.replaceChildren(...spans);
  return spans;
}

function restoreTextAfter(hop, spans, animations) {
  const text = spans.map((span) => span.textContent).join('');
  Promise.all(animations.map((animation) => animation.finished)).then(() => {
    if (hop.firstElementChild === spans[0] && !isSelecting()) {
      hop.textContent = text;
    }
  });
}

export function hopLetters(hop, { keyframes, beats }) {
  const spans = splitIntoLetters(hop);
  const duration = beatMs() * beats;
  const { step, total } = hopTiming(spans.length, duration);
  const hops = spans.map((span, index) =>
    span.animate(keyframes, {
      duration,
      delay: index * step,
      fill: 'backwards',
    })
  );
  restoreTextAfter(hop, spans, hops);
  document.dispatchEvent(new CustomEvent('letterhop'));
  return total;
}

export function lightLetters(wordmark) {
  const letters = [...wordmark.querySelectorAll('path')];
  const { step, length } = hopTiming(letters.length);
  for (const [index, letter] of letters.entries()) {
    letter.animate([{ filter: 'grayscale(1)' }, { filter: 'none' }], {
      duration: length,
      delay: index * step,
      easing: HOP_EASING,
      fill: 'backwards',
    });
  }
}

export function longestWordLength(text) {
  const words = text.split(/\s+/).map((word) => splitLetters(word).length);
  return Math.max(1, ...words);
}

export function segmentPitch(element) {
  const style = getComputedStyle(element);
  return (
    parseFloat(style.getPropertyValue('--segment')) +
    parseFloat(style.getPropertyValue('--segment-gap'))
  );
}

// Letters as hue-hop counts them: graphemes, with blank ones marked so callers can skip them.
export function splitLetters(text) {
  return [...graphemes.segment(text)].map(({ index, segment }) => ({
    index,
    letter: segment,
    isBlank: isBlankLetter(segment),
  }));
}
