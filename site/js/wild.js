import { isMotionOk } from './motion.js';

const countdown = document.getElementById('countdown');

function readSeconds(clock) {
  const [hours, minutes, seconds] = clock.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatClock(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

if (countdown && isMotionOk()) {
  const startSeconds = readSeconds(countdown.textContent.trim());
  let secondsLeft = startSeconds;
  let ticker;
  const tick = () => {
    secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : startSeconds;
    countdown.textContent = formatClock(secondsLeft);
  };
  new IntersectionObserver(([entry]) => {
    clearInterval(ticker);
    if (entry.isIntersecting) ticker = setInterval(tick, 1000);
  }).observe(countdown);
}

function shareHueWithParent(parent) {
  const styles = getComputedStyle(parent.querySelector('hue-hop'));
  for (const name of ['--hop-start', '--hop-end']) {
    parent.style.setProperty(name, styles.getPropertyValue(name));
  }
}

const DEMO_FACES = [
  ['Piazzolla', 'piazzolla-latin-opsz-normal', { weight: '100 900' }],
  [
    'Piazzolla',
    'piazzolla-latin-wght-italic',
    { weight: '100 900', style: 'italic' },
  ],
  [
    'Saira Extra Condensed',
    'saira-extra-condensed-latin-800-normal',
    { weight: '800' },
  ],
  ['League Gothic', 'league-gothic-latin-400-normal', { weight: '400' }],
  ['League Spartan', 'league-spartan-latin-wght-normal', { weight: '100 900' }],
  [
    'Anybody',
    'anybody-latin-wdth-normal',
    { weight: '100 900', stretch: '50% 150%' },
  ],
  ['Sorts Mill Goudy', 'sorts-mill-goudy-latin-400-normal', { weight: '400' }],
  [
    'Sorts Mill Goudy',
    'sorts-mill-goudy-latin-400-italic',
    { weight: '400', style: 'italic' },
  ],
  ['Tilt Neon', 'tilt-neon-latin-400-normal', { weight: '400' }],
  ['Chivo', 'chivo-latin-wght-normal', { weight: '100 900' }],
];

function addDemoFaces() {
  for (const [family, file, descriptors] of DEMO_FACES) {
    const fontUrl = new URL(`../fonts/${file}.woff2`, import.meta.url);
    const face = new FontFace(family, `url(${fontUrl}) format('woff2')`, {
      ...descriptors,
      display: 'swap',
    });
    document.fonts.add(face);
  }
}

function loadDemoFacesOnApproach(section) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      addDemoFaces();
    },
    { rootMargin: '100% 0px' }
  );
  observer.observe(section);
}

const wildSection = document.getElementById('wild');
if (wildSection) loadDemoFacesOnApproach(wildSection);

customElements.whenDefined('hue-hop').then(() => {
  document.querySelectorAll('.hop-near').forEach(shareHueWithParent);
});
