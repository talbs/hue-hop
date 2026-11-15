// Shared by every scripted animation: the beat comes from the --tempo token, so CSS and JS motion stay on the same grid.
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const blankPattern = /^[\s\p{Default_Ignorable_Code_Point}]*$/u;

export function isBlankLetter(text) {
  return blankPattern.test(text);
}

// Only a drag catches, so arrow keys can still step through the stop.
export function catchSoftStop(fader, stop, reach) {
  if (!fader.matches(':state(dragging)')) return;
  if (Math.abs(Number(fader.value) - stop) <= reach) fader.value = stop;
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

// Each letter holds its old color with two identical keyframes, then snaps to the new one as it leaves the ground.
export function hopLettersIn(letters, restingFills) {
  const duration = beatMs() * LETTER_HOP.beats;
  const { step } = hopTiming(letters.length, duration);
  const crouch = duration * LETTER_HOP.keyframes[1].offset;
  for (const [index, letter] of letters.entries()) {
    const restingFill = { fill: restingFills[index] };
    letter.animate([restingFill, restingFill], {
      duration: index * step + crouch,
    });
    letter.animate(LETTER_HOP.keyframes, { duration, delay: index * step });
  }
  document.dispatchEvent(new CustomEvent('letterhop'));
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

// A step's bar runs from a fifth of the meter at the first letter to all of it at the last, spaced by the same curve as the colors.
export function stepLevel(index, count, curve = 1) {
  const progress = index / Math.max(count - 1, 1);
  return 0.2 + 0.8 * progress ** curve;
}

// Landing and Studio show the same meter, so the word's trip between them lands on a matching stage.
export const STAGE_BARS = 16;

function stepNearBar(barIndex, barCount, stepTotal) {
  return Math.round((barIndex / Math.max(barCount - 1, 1)) * (stepTotal - 1));
}

export function showStepBars(meter, count, curve = 1) {
  if (meter.children.length !== count) {
    meter.replaceChildren(
      ...Array.from({ length: count }, () => document.createElement('span'))
    );
  }
  for (const [index, bar] of [...meter.children].entries()) {
    bar.style.setProperty('--level', stepLevel(index, count, curve));
  }
}

export function tintStepBars(meter, stepColors) {
  const bars = [...meter.children];
  for (const [index, bar] of bars.entries()) {
    const step = stepNearBar(index, bars.length, stepColors.length);
    const color = stepColors[step];
    if (color) bar.style.setProperty('--step-color', color);
    else bar.style.removeProperty('--step-color');
  }
  meter.toggleAttribute('data-tinted', stepColors.length > 0);
}

// Letters as hue-hop counts them: graphemes, with blank ones marked so callers can skip them.
export function splitLetters(text) {
  return [...graphemes.segment(text)].map(({ index, segment }) => ({
    index,
    letter: segment,
    isBlank: isBlankLetter(segment),
  }));
}

const runningReveals = new WeakMap();

// The word stays one plain run of text, so its colors and kerning are final from the first frame. A clip steps open from one letter's edge to the next at typeOut's pace. The line must hold one line that never wraps.
export function revealLetters(line, word, text) {
  line.classList.add('is-swapping');
  const stopSwapping = () => line.classList.remove('is-swapping');
  if (!isMotionOk() || word.firstChild?.data !== text) {
    stopSwapping();
    return () => {};
  }
  const isRtl = getComputedStyle(line).direction === 'rtl';
  const lineBox = line.getBoundingClientRect();
  const letterRange = document.createRange();
  const insets = [];
  for (const { index, letter } of splitLetters(text)) {
    letterRange.setStart(word.firstChild, index);
    letterRange.setEnd(word.firstChild, index + letter.length);
    const letterBox = letterRange.getBoundingClientRect();
    const hidden = isRtl
      ? letterBox.left - lineBox.left
      : lineBox.right - letterBox.right;
    insets.push(Math.max(hidden, 0));
  }
  const frames = insets.map((hidden, index) => ({
    clipPath: isRtl
      ? `inset(-25% -5% -25% ${hidden}px)`
      : `inset(-25% ${hidden}px -25% -5%)`,
    offset: index / insets.length,
    easing: 'step-end',
  }));
  frames.push({ clipPath: 'inset(-25% -5% -25% -5%)', offset: 1 });
  const reveal = line.animate(frames, {
    duration: (beatMs() / 16) * insets.length,
  });
  runningReveals.set(line, reveal);
  // A cancelled reveal settles after the next one has started, so only the latest one may end the swap.
  reveal.finished
    .catch(() => {})
    .finally(() => {
      if (runningReveals.get(line) === reveal) stopSwapping();
    });
  return () => reveal.cancel();
}

// One letter per 64th note, so the stage types on the same beat as the rest of the motion.
export function typeOut(element, text, onFinish) {
  const letters = splitLetters(text).map(({ letter }) => letter);
  const letterMs = beatMs() / 16;
  let shownCount = 0;
  let nextLetterTimer;
  const typeNext = () => {
    shownCount += 1;
    element.textContent = letters.slice(0, shownCount).join('');
    if (shownCount < letters.length) {
      nextLetterTimer = setTimeout(typeNext, letterMs);
    } else {
      onFinish?.();
    }
  };
  element.textContent = '';
  typeNext();
  return () => clearTimeout(nextLetterTimer);
}
