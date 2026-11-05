import { codeFromPreview } from './example-code.js';
import { whenSideChanges } from './scheme.js';
import { DEFAULT_STATE, defaultLift, describeStudioLink } from './state.js';
import { fillCode } from './syntax.js';

const page = document.querySelector('wa-page');

let hasUserScrolled = false;
for (const type of ['wheel', 'pointerdown', 'keydown']) {
  addEventListener(type, () => (hasUserScrolled = true), {
    once: true,
    passive: true,
  });
}

// Web Awesome is the page's heaviest file and nothing in the first paint needs it, so the text and fonts get the network first.
await new Promise(afterRepaint);
try {
  await import('./wa.js');
} catch {
  page.classList.add('is-without-wa');
}

const sidebarLinks = [...document.querySelectorAll('.docs-nav a[href^="#"]')];
const sections = [...document.querySelectorAll('article > section')];

// The sidebar scrolls on its own and runs taller than short screens, so the current link is scrolled into its view.
function revealInSidebar(link) {
  const sidebar = page.shadowRoot?.querySelector('[part~="menu"]');
  if (!sidebar || page.view !== 'desktop') return;
  const sidebarBox = sidebar.getBoundingClientRect();
  const linkBox = link.getBoundingClientRect();
  const margin = linkBox.height * 2;
  if (linkBox.top < sidebarBox.top + margin) {
    sidebar.scrollBy({ top: linkBox.top - sidebarBox.top - margin });
  } else if (linkBox.bottom > sidebarBox.bottom - margin) {
    sidebar.scrollBy({ top: linkBox.bottom - sidebarBox.bottom + margin });
  }
}

let currentSection;

function markCurrentSection(section) {
  if (section === currentSection) return;
  currentSection = section;
  for (const link of sidebarLinks) {
    if (link.hash === `#${section.id}`) {
      link.setAttribute('aria-current', 'location');
      revealInSidebar(link);
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

// The last sections are too short to scroll up into the band, so the end of the page marks the last one.
function isAtPageEnd() {
  return innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
}

function watchSections() {
  const sectionsInBand = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) sectionsInBand.add(entry.target);
        else sectionsInBand.delete(entry.target);
      }
      const firstInBand = sections.find((section) =>
        sectionsInBand.has(section)
      );
      if (isAtPageEnd()) markCurrentSection(sections.at(-1));
      else if (firstInBand) markCurrentSection(firstInBand);
    },
    { rootMargin: '-20% 0px -70% 0px' }
  );
  for (const section of sections) observer.observe(section);
  markCurrentSection(sections[0]);
  addEventListener(
    'scroll',
    () => {
      if (isAtPageEnd()) markCurrentSection(sections.at(-1));
    },
    { passive: true }
  );
}

function createPixelIcon(name, label) {
  const icon = document.createElement('wa-icon');
  icon.setAttribute('family', 'pixel');
  icon.setAttribute('canvas', 'auto');
  icon.setAttribute('name', name);
  icon.setAttribute('label', label);
  return icon;
}

function addHeadingAnchors() {
  const headings = document.querySelectorAll('article section > :is(h2, h3)');
  for (const heading of headings) {
    const target =
      heading.localName === 'h2' ? heading.closest('section') : heading;
    const headingText = heading.textContent.trim();
    heading.setAttribute('aria-label', headingText);
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.id = `anchor-${target.id}`;
    anchor.href = `#${target.id}`;
    anchor.append(createPixelIcon('bookmark', `Link to ${headingText}`));
    heading.append(anchor);
  }
}

function addIconTooltip(target) {
  const tooltip = document.createElement('wa-tooltip');
  tooltip.setAttribute('for', target.id);
  tooltip.textContent = target.querySelector('wa-icon').getAttribute('label');
  // A hash jump can build this under a resting pointer, which never enters again to open it.
  tooltip.open = target.matches(':hover');
  document.body.append(tooltip);
}

function addIconTooltipsWhenNear() {
  const nearViewport = new IntersectionObserver(
    (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) continue;
        nearViewport.unobserve(target);
        addIconTooltip(target);
      }
    },
    { rootMargin: '100% 0px' }
  );
  for (const target of document.querySelectorAll(
    '.heading-anchor, .code-studio'
  )) {
    nearViewport.observe(target);
  }
}

addHeadingAnchors();
watchSections();

let pendingHash = '';

page.addEventListener('click', (event) => {
  const sidebarLink = event.target.closest('.docs-nav a[href^="#"]');
  const isPlainClick = !(
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
  if (!sidebarLink || page.view !== 'mobile' || !isPlainClick) return;
  event.preventDefault();
  pendingHash = sidebarLink.hash;
  page.hideNavigation();
});

// The drawer hands focus back to its toggle on a timer after it closes. Jumping after that lets the jump set where the next Tab starts, so it starts at the section.
page.addEventListener('wa-after-hide', (event) => {
  if (event.target !== page || !pendingHash) return;
  const hash = pendingHash;
  pendingHash = '';
  setTimeout(() => {
    if (location.hash === hash) {
      document.getElementById(hash.slice(1)).scrollIntoView();
    } else {
      location.hash = hash;
    }
  });
});

// The browser ends a style it writes with a semicolon and Prettier strips it from the authored previews, so the code drops it to keep one shape.
const TRAILING_STYLE_SEMICOLON = /(\sstyle="[^"]*?);\s*"/g;

function refreshCode(figure) {
  const preview = figure.querySelector('.example-preview');
  const code = codeFromPreview(preview.innerHTML).replace(
    TRAILING_STYLE_SEMICOLON,
    '$1"'
  );
  fillCode(figure.querySelector('pre > code.language-html'), code);
}

function previewHopIn(figure) {
  return figure.querySelector('.example-preview hue-hop');
}

function decimalsIn(step) {
  return String(step).split('.')[1]?.length ?? 0;
}

function wireFader(figure) {
  const name = figure.dataset.control;
  const fader = figure.querySelector('.fader wa-slider');
  const readout = figure.querySelector('output.fader-value');
  const hop = previewHopIn(figure);
  fader.addEventListener('input', () => {
    const value = Number(fader.value).toFixed(decimalsIn(fader.step));
    readout.textContent = value;
    hop.style.setProperty(`--hop-${name}`, String(Number(value)));
    refreshCode(figure);
  });
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function wireDriftSwitch(figure) {
  const toggle = figure.querySelector('.lit-button');
  const note = figure.querySelector('[data-drift-note]');
  const hop = previewHopIn(figure);
  toggle.addEventListener('click', () => {
    const isOn = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(isOn));
    hop.toggleAttribute('drift', isOn);
    refreshCode(figure);
  });
  const showMotionNote = () => {
    note.textContent = reducedMotion.matches
      ? 'Reduced motion is on, so the hues hold still.'
      : '';
  };
  reducedMotion.addEventListener('change', showMotionNote);
  showMotionNote();
}

// The element recounts its letters in a mutation observer, which runs only after the handler that set the text returns, so the count is read after that.
function afterRepaint(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function wireHopsReadout(figure) {
  const field = figure.querySelector('wa-input');
  const shuffle = figure.querySelector('.lit-button');
  const samples = figure.querySelector('wa-random-content');
  const readout = figure.querySelector('output.fader-value');
  const hop = previewHopIn(figure);
  const showHops = () => {
    const hopCount = String(hop.hops ?? 0);
    if (readout.textContent.trim() !== hopCount) readout.textContent = hopCount;
  };
  const showFieldText = () => {
    hop.textContent = field.value;
    afterRepaint(() => {
      showHops();
      refreshCode(figure);
    });
  };
  field.addEventListener('input', showFieldText);
  shuffle.addEventListener('click', () => {
    let sample = field.value;
    while (sample === field.value) {
      const [shownSample] = samples.randomize();
      sample = shownSample.textContent;
    }
    field.value = sample;
    showFieldText();
  });
  customElements.whenDefined('hue-hop').then(() => afterRepaint(showHops));
}

const METER_SEGMENTS = 7;
const METER_SEGMENT_PITCH = 14;

function wireHopMeter(figure) {
  const meter = figure.querySelector('.hop-meter');
  const fader = figure.querySelector('.fader wa-slider');
  const hop = previewHopIn(figure);
  const letters = [...hop.textContent.trim()];
  const steps = [];
  for (const letter of letters) {
    const step = document.createElement('span');
    step.className = 'hop-meter-step';
    const bar = document.createElement('span');
    bar.className = 'hop-meter-bar';
    const label = document.createElement('span');
    label.className = 'hop-meter-letter';
    label.textContent = letter;
    step.append(bar, label);
    meter.append(step);
    steps.push({ step, bar });
  }
  const paintMeter = () => {
    const curve = Number(fader.value);
    for (let index = 0; index < steps.length; index++) {
      const { step, bar } = steps[index];
      const progress = (index / (steps.length - 1)) ** curve;
      const litSegments = Math.round(METER_SEGMENTS * (0.2 + 0.8 * progress));
      bar.style.blockSize = `${litSegments * METER_SEGMENT_PITCH}px`;
      step.style.color = getComputedStyle(
        hop,
        `::highlight(hue-hop-${index})`
      ).color;
    }
  };
  fader.addEventListener('input', paintMeter);
  whenSideChanges(paintMeter);
  customElements.whenDefined('hue-hop').then(() => afterRepaint(paintMeter));
}

function readTuning(hop, name, fallback) {
  const value = hop.style.getPropertyValue(`--hop-${name}`);
  return value === '' ? fallback : Number(value);
}

function studioLinkFor(hop) {
  const hue = hop.getAttribute('hue');
  return describeStudioLink({
    ...DEFAULT_STATE,
    text: hop.textContent.trim(),
    hue,
    start: hop.getAttribute('start'),
    end: hop.getAttribute('end'),
    curve: readTuning(hop, 'curve', DEFAULT_STATE.curve),
    shift: readTuning(hop, 'shift', DEFAULT_STATE.shift),
    lift: readTuning(hop, 'lift', defaultLift({ hue })),
    drift: hop.hasAttribute('drift'),
    display: hop.hasAttribute('display'),
  });
}

function addStudioLink(figure, index) {
  const hop = previewHopIn(figure);
  const hasColors = ['hue', 'start', 'end'].some((name) =>
    hop.hasAttribute(name)
  );
  if (!hasColors) return;
  const link = document.createElement('a');
  link.className = 'code-studio';
  link.id = `studio-link-${index}`;
  link.append(createPixelIcon('sliders', 'Open in Studio'));
  const pointLinkAtExample = () => {
    link.href = studioLinkFor(hop);
  };
  pointLinkAtExample();
  link.addEventListener('pointerenter', pointLinkAtExample);
  link.addEventListener('focus', pointLinkAtExample);
  figure.querySelector('.code-copy').before(link);
}

document.addEventListener('click', (event) => {
  if (event.target.closest('.example-preview a')) event.preventDefault();
});

// Named colors are left out: `orchid` is a hue name here and `window` is a global, and both read as colors to CSS.
const COLOR_LITERAL =
  /^(?:#[0-9a-f]{3,8}|(?:oklch|oklab|lch|lab|rgba?|hsla?|hwb|color)\(.+\))$/i;

function isColorValue(text) {
  return COLOR_LITERAL.test(text) && CSS.supports('color', text);
}

// Code blocks are skipped: their highlighter paints ranges over a single text node, which a swatch would split.
function addColorSwatches() {
  for (const code of document.querySelectorAll('article code:not(pre code)')) {
    const value = code.textContent.trim();
    if (!isColorValue(value)) continue;
    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.setProperty('--color-swatch', value);
    code.prepend(swatch);
  }
}

addColorSwatches();

const figures = document.querySelectorAll('figure.example');
figures.forEach((figure, index) => addStudioLink(figure, index));
addIconTooltipsWhenNear();

for (const figure of document.querySelectorAll('figure[data-control]')) {
  const control = figure.dataset.control;
  if (control === 'drift') wireDriftSwitch(figure);
  else if (control === 'hops') wireHopsReadout(figure);
  else wireFader(figure);
  if ('meter' in figure.dataset) wireHopMeter(figure);
}

// Web Awesome's upgrades change the page's height after the browser has already jumped to the linked section.
function reachLinkedSection() {
  const target = document.getElementById(location.hash.slice(1));
  if (target && !hasUserScrolled)
    target.scrollIntoView({ behavior: 'instant' });
}

const { type: navigationType } = performance.getEntriesByType('navigation')[0];
if (navigationType === 'navigate') afterRepaint(reachLinkedSection);
