import {
  HOP_EASING,
  beatMs,
  hopLettersIn,
  hopTiming,
  isMotionOk,
  segmentPitch,
} from './motion.js';
import { setSide, slatTiming } from './scheme.js';
import { track } from './track.js';

const sideToggle = document.getElementById('side-toggle');

function markSide(side) {
  sideToggle.setAttribute('aria-checked', String(side === 'b'));
}

sideToggle.addEventListener('click', () => {
  const side = document.documentElement.dataset.side === 'a' ? 'b' : 'a';
  setSide(side);
  markSide(side);
});

markSide(document.documentElement.dataset.side);

// Pixel icons come from the Font Awesome kit. If it refuses (a blocked or unlisted domain, offline), fall back to Web Awesome's built-in set so no button goes blank.
// The system set draws copy only as regular and the rest only as solid; asking for a missing variant shows a question mark.
const SYSTEM_FALLBACKS = {
  clone: { name: 'copy', variant: 'regular' },
  check: { name: 'check', variant: 'solid' },
  xmark: { name: 'xmark', variant: 'solid' },
  bars: { name: 'bars', variant: 'solid' },
  minus: { name: 'minus', variant: 'solid' },
  bookmark: { name: 'bookmark', variant: 'solid' },
  sliders: { name: 'sliders', variant: 'solid' },
  lightbulb: { name: 'lightbulb', variant: 'solid' },
  key: { name: 'key', variant: 'solid' },
  'triangle-exclamation': { name: 'triangle-exclamation', variant: 'solid' },
  'comment-dots': { name: 'comment-dots', variant: 'solid' },
  'angle-down': { name: 'chevron-down', variant: 'solid' },
  'arrow-right-arrow-left': { name: 'up-down', variant: 'solid' },
  link: { name: 'thumbtack', variant: 'solid' },
};

document.addEventListener('wa-error', (event) => {
  const icon = event.target;
  const fallback = SYSTEM_FALLBACKS[icon.getAttribute?.('name')];
  if (icon.localName !== 'wa-icon' || icon.library === 'system' || !fallback) {
    return;
  }
  icon.removeAttribute('family');
  icon.setAttribute('library', 'system');
  icon.setAttribute('variant', fallback.variant);
  icon.setAttribute('name', fallback.name);
});

// After the slats land, the lit LEDs relight left to right on the same hop rhythm, like a desk coming on.
const LIT_LEDS =
  ':is(.is-lit, [aria-pressed="true"], [aria-checked="true"], [aria-selected="true"], [data-state="pass"], [data-state="check"]) .led';

document.addEventListener('sidechange', () => {
  if (!isMotionOk()) return;
  const leds = [...document.querySelectorAll(LIT_LEDS)]
    .map((led) => ({ led, box: led.getBoundingClientRect() }))
    .sort((a, b) => a.box.left - b.box.left || a.box.top - b.box.top);
  const slats = slatTiming();
  const { step, length } = hopTiming(leds.length);
  leds.forEach(({ led }, index) => {
    led.animate(
      [
        { opacity: 0.15, scale: 0.6 },
        { opacity: 1, scale: 1.5, offset: 0.4 },
        { opacity: 1, scale: 0.9, offset: 0.7 },
        { opacity: 1, scale: 1 },
      ],
      {
        duration: length,
        delay: slats.total + index * step,
        easing: HOP_EASING,
        fill: 'backwards',
      }
    );
  });
});

// Every letter squashes on the shared baseline, so the p's descender doesn't pull it lower than its neighbours.
function pinToBaseline(letters) {
  const boxes = letters.map((letter) => letter.getBBox());
  const baseline = Math.min(...boxes.map((box) => box.y + box.height));
  for (const [index, letter] of letters.entries()) {
    const box = boxes[index];
    letter.style.transformOrigin = `${box.x + box.width / 2}px ${baseline}px`;
  }
}

for (const mark of document.querySelectorAll('.hop-quiet')) {
  const hop = mark.querySelector('hue-hop');
  const restingHue = hop.getAttribute('hue');
  const letters = [...mark.querySelectorAll('.wordmark path')];
  pinToBaseline(letters);
  const isEngaged = () => mark.matches(':hover, :focus-visible');
  const lightUp = () => {
    const restingFills = letters.map((letter) => getComputedStyle(letter).fill);
    const isHopping = letters.some((letter) => letter.getAnimations().length);
    hop.hue = 'dusk';
    if (isMotionOk() && !isHopping) hopLettersIn(letters, restingFills);
  };
  const settleUnlessEngaged = () => {
    if (!isEngaged()) hop.hue = restingHue;
  };
  // A touch only enters the mark as it taps it, and the page leaves before the hop can finish.
  mark.addEventListener('pointerenter', ({ pointerType }) => {
    if (pointerType !== 'touch') lightUp();
  });
  mark.addEventListener('focus', () => {
    if (mark.matches(':focus-visible')) lightUp();
  });
  mark.addEventListener('pointerleave', settleUnlessEngaged);
  mark.addEventListener('blur', settleUnlessEngaged);
}

const meter = document.querySelector('.eq-meter');
const meterBars = [...document.querySelectorAll('.eq-meter span')];
let isMeterVisible = false;

if (meter) {
  new IntersectionObserver(([entry]) => {
    isMeterVisible = entry.isIntersecting;
  }).observe(meter);
}

function kickMeter() {
  if (!isMeterVisible || !isMotionOk()) return;
  const { step } = hopTiming(meterBars.length);
  const segment = segmentPitch(meter);
  const segmentsTall = Math.round(meter.clientHeight / segment);
  meterBars.forEach((bar, index) => {
    const rest = Math.round(bar.offsetHeight / segment);
    const peak = Math.min(
      segmentsTall,
      rest + 1 + Math.floor(Math.random() * 3)
    );
    const climb = Math.max(peak - rest, 1);
    // Stepped easing moves the bar a whole segment at a time, the way an LED meter jumps.
    bar.animate(
      [
        {
          height: `${rest * segment}px`,
          easing: `steps(${climb}, jump-start)`,
        },
        {
          height: `${peak * segment}px`,
          offset: 0.2,
          easing: `steps(${climb})`,
        },
        { height: `${rest * segment}px` },
      ],
      {
        duration: beatMs() * 1.5,
        delay: (index * step) / 2,
      }
    );
  });
}

for (const type of ['letterhop', 'sidechange']) {
  document.addEventListener(type, kickMeter);
}
meter?.addEventListener('click', kickMeter);

// A browser won't scroll to a focused link that's already partly showing, which would leave a clipped nav link half hidden.
document
  .querySelector('.site-nav')
  .addEventListener('focusin', ({ target }) => {
    target.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });

// A tab group activates its first panel as it scrolls into view, so only a switch after that gets to animate.
document.addEventListener('wa-tab-show', ({ target, detail }) => {
  target.toggleAttribute('data-ready', true);
  if (target.matches('.install-tabs')) {
    track('install-tab', { tab: detail.name });
  }
});

document.addEventListener('wa-copy', ({ target }) => {
  track('copy-code', { code: target.getAttribute('from') });
});
