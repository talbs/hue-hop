import { SITE_URL } from './urls.js';

const STAGE_CAP = 48;

const stage = document.getElementById('stage');
const stageHue = document.getElementById('stage-hue');
const lostPath = document.getElementById('lost-path');
const trackPath = document.getElementById('track-path');
const shuffle = document.getElementById('shuffle');
const pills = [...document.querySelectorAll('#hue-pills [role="radio"]')];

function readLostPath() {
  const basePath = new URL(SITE_URL).pathname;
  let path = location.pathname;
  if (path.startsWith(basePath)) path = `/${path.slice(basePath.length)}`;
  return path === '/' ? '/404' : path;
}

function showPathOnStage(path) {
  const stageCopy =
    path.length > STAGE_CAP ? `…${path.slice(-(STAGE_CAP - 1))}` : path;
  const segments = stageCopy.split('/');
  const remainder = segments.pop();
  lostPath.replaceChildren();
  for (const segment of segments) {
    lostPath.append(`${segment}/`, document.createElement('wbr'));
  }
  lostPath.append(remainder);

  const longestSegment = Math.max(
    remainder.length,
    ...segments.map((segment) => segment.length)
  );
  stage.style.setProperty('--letters', longestSegment + 1);
  trackPath.textContent = path;
}

function pickHue(pill) {
  for (const other of pills) {
    other.setAttribute('aria-checked', String(other === pill));
    other.tabIndex = other === pill ? 0 : -1;
  }
  lostPath.setAttribute('hue', pill.dataset.hue);
  stageHue.textContent = pill.dataset.hue;
}

function moveRadioFocus(event) {
  const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  let next;
  const index = pills.indexOf(event.currentTarget);
  if (event.key in steps) {
    const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const isHorizontal =
      event.key.startsWith('ArrowL') || event.key.startsWith('ArrowR');
    const step = steps[event.key] * (isRtl && isHorizontal ? -1 : 1);
    next = pills[(index + step + pills.length) % pills.length];
  } else if (event.key === 'Home') {
    next = pills[0];
  } else if (event.key === 'End') {
    next = pills.at(-1);
  } else {
    return;
  }
  event.preventDefault();
  pickHue(next);
  next.focus();
}

function pickRandomOtherHue() {
  const others = pills.filter(
    (pill) => pill.getAttribute('aria-checked') !== 'true'
  );
  pickHue(others[Math.floor(Math.random() * others.length)]);
}

showPathOnStage(readLostPath());
pickHue(pills.find((pill) => pill.getAttribute('aria-checked') === 'true'));
for (const pill of pills) {
  pill.addEventListener('click', () => pickHue(pill));
  pill.addEventListener('keydown', moveRadioFocus);
}
shuffle.addEventListener('click', pickRandomOtherHue);
