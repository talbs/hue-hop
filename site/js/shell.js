import {
  HOP_EASING,
  beatMs,
  hopTiming,
  isMotionOk,
  lightLetters,
  segmentPitch,
} from './motion.js';
import { readSide, setSide, slatTiming } from './scheme.js';

const sideToggle = document.getElementById('side-toggle');

function markSide(side) {
  sideToggle.setAttribute('aria-checked', String(side === 'b'));
}

sideToggle.addEventListener('click', () => {
  const side = document.documentElement.dataset.side === 'a' ? 'b' : 'a';
  setSide(side);
  markSide(side);
});

markSide(readSide());

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

for (const mark of document.querySelectorAll('.hop-quiet')) {
  const wordmark = mark.querySelector('.wordmark');
  const lightUp = () => {
    if (isMotionOk()) lightLetters(wordmark);
  };
  mark.addEventListener('pointerenter', lightUp);
  mark.addEventListener('focus', () => {
    if (mark.matches(':focus-visible')) lightUp();
  });
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
