import {
  beatMs,
  FALL_IMPACT,
  fallAndBounce,
  hopTiming,
  isBlankLetter,
  isMotionOk,
  splitLetters,
} from './motion.js';

// The build inlines readSide and showSide into each page's <head> so the saved side paints first. They can't use imports or outer variables.
export function readSide() {
  try {
    return localStorage.getItem('hue-hop-side') === 'b' ? 'b' : 'a';
  } catch {
    return 'a';
  }
}

export function showSide(side) {
  const root = document.documentElement;
  root.dataset.side = side;
  root.classList.toggle('wa-dark', side === 'a');
  root.classList.toggle('wa-light', side === 'b');
}

const SLAT_COUNT = 7;
const FRAME_COUNT = 48;

// A slat needs longer than a letter hop to fall, bounce and land, so it keeps the hop's stagger but gets its own length.
export function slatTiming() {
  return hopTiming(SLAT_COUNT, beatMs() * 0.6);
}

// Seven slats, one per hue, drop in left to right on the shared hop rhythm, like seven letters landing.
function slatFrames({ step, length, total }) {
  const frames = [];
  for (let frame = 0; frame <= FRAME_COUNT; frame++) {
    const now = (frame / FRAME_COUNT) * total;
    const points = ['0% 0%', '100% 0%'];
    for (let slat = SLAT_COUNT - 1; slat >= 0; slat--) {
      const progress = Math.min(Math.max((now - slat * step) / length, 0), 1);
      const height = fallAndBounce(progress) * 100;
      const right = ((slat + 1) / SLAT_COUNT) * 100;
      const left = (slat / SLAT_COUNT) * 100;
      points.push(`${right}% ${height}%`, `${left}% ${height}%`);
    }
    frames.push({ clipPath: `polygon(${points.join(', ')})` });
  }
  return frames;
}

// Each letter's right edge, as a share of the wordmark's box, so the reveal steps between letters and never cuts through one.
function letterEdges(wordmark) {
  const hop = wordmark?.querySelector('hue-hop');
  if (!hop) return [];
  const box = wordmark.getBoundingClientRect();
  if (box.width === 0) return [];
  return letterRights(hop).map((right) => (right - box.left) / box.width);
}

export function letterRights(hop) {
  const letters = [...hop.querySelectorAll('.hop-letter')];
  if (letters.length) {
    return letters
      .filter((letter) => !isBlankLetter(letter.textContent))
      .map((letter) => letter.getBoundingClientRect().right);
  }
  const text = hop.firstChild;
  if (!text || text.nodeType !== Node.TEXT_NODE) return [];
  const range = document.createRange();
  const rights = [];
  for (const { index, letter, isBlank } of splitLetters(text.data)) {
    if (isBlank) continue;
    range.setStart(text, index);
    range.setEnd(text, index + letter.length);
    rights.push(range.getBoundingClientRect().right);
  }
  return rights;
}

// The wordmark takes each letter's new colors as that letter's slat hits bottom, on the same rhythm as the slats.
function letterFrames(edges, { step, length, total }) {
  const frames = [
    { clipPath: 'inset(0 100% 0 0)', offset: 0, easing: 'step-end' },
  ];
  edges.forEach((edge, index) => {
    frames.push({
      clipPath: `inset(0 ${(1 - edge) * 100}% 0 0)`,
      offset: Math.min((index * step + length * FALL_IMPACT) / total, 1),
      easing: 'step-end',
    });
  });
  frames.push({ clipPath: 'inset(0 0 0 0)', offset: 1 });
  return frames;
}

// sidechange fires before an animated flip puts the new side on, so anything that reads colors or reports the side waits for this.
export function whenSideChanges(callback) {
  new MutationObserver(callback).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-side'],
  });
}

export function setSide(side) {
  if (document.startViewTransition && isMotionOk()) {
    const edges = letterEdges(document.querySelector('.hero-title'));
    const transition = document.startViewTransition(() => showSide(side));
    const timing = slatTiming();
    transition.ready.then(() => {
      document.documentElement.animate(slatFrames(timing), {
        duration: timing.total,
        easing: 'linear',
        fill: 'forwards',
        pseudoElement: '::view-transition-new(root)',
      });
      if (edges.length) {
        document.documentElement.animate(letterFrames(edges, timing), {
          duration: timing.total,
          fill: 'forwards',
          pseudoElement: '::view-transition-new(hero-wordmark)',
        });
      }
    });
  } else {
    showSide(side);
  }
  try {
    localStorage.setItem('hue-hop-side', side);
  } catch {}
  document.dispatchEvent(new CustomEvent('sidechange', { detail: { side } }));
}
