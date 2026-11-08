import formula from './formula.css';
import hues from './hues.css';

const hasSupport = typeof CSS !== 'undefined' && 'highlights' in CSS;

const segmenter =
  hasSupport && new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const forcedColors = hasSupport && matchMedia('(forced-colors: active)');
const elementData = new WeakMap();
const rootStyles = new WeakMap();
const connectedHops = new Set();
// Page CSS beats a :host rule even from inside a cascade layer, and a :host rule beats inherited values.
const hueSheet = hasSupport && new CSSStyleSheet();
// Safari 26.6 never paints a range added while its text has no box (display: none, content-visibility, a closed details) until it's added again.
const boxWatcher =
  hasSupport &&
  new IntersectionObserver((entries) => {
    for (const { target, boundingClientRect, isIntersecting } of entries) {
      const data = elementData.get(target);
      // A hop with no box never intersects. Safari can report one on screen at width 0 when its skipped container hadn't sized it yet.
      const hasBox = isIntersecting || boundingClientRect.width > 0;
      if (hasBox) {
        if (data.hadNoBox) paint(target);
        boxWatcher.unobserve(target);
      }
      data.hadNoBox = !hasBox;
    }
  });

const colorAttributes = ['start', 'end'];
const mostRulesPerRoot = 256;
// Each restyle costs about the square of the step count in Chromium and Safari, so longer text shares steps.
const mostHops = 64;

const isBlank = /^[\s\p{Default_Ignorable_Code_Point}]*$/u;

function highlightName(step) {
  return `hue-hop-${step}`;
}

function highlightAt(step) {
  const name = highlightName(step);
  let highlight = CSS.highlights.get(name);
  if (!highlight) {
    highlight = new Highlight();
    highlight.priority = -1;
    CSS.highlights.set(name, highlight);
  }
  return highlight;
}

function hopsFor(letterCount) {
  return Math.min(letterCount, mostHops);
}

function stepAt(index, letterCount) {
  return Math.floor((index * hopsFor(letterCount)) / letterCount);
}

function clearRanges(data) {
  const letterCount = data.ranges.length;
  for (const [index, range] of data.ranges.entries()) {
    highlightAt(stepAt(index, letterCount)).delete(range);
  }
  data.ranges = [];
}

function ownTextNodes(element) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // An inner element of the same tag may not be upgraded yet, so instanceof alone misses it.
        const isNestedHop =
          node.localName === element.localName || node instanceof HueHop;
        if (isNestedHop) return NodeFilter.FILTER_REJECT;
        if (node.nodeType === Node.ELEMENT_NODE) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function sheetText(longest) {
  const stepRules = [];
  const stepSelectors = [];
  for (let step = 0; step < longest; step++) {
    const name = `::highlight(${highlightName(step)})`;
    const selector = `[hops]${name},[hops] *${name}`;
    stepRules.push(
      `${selector}{--_hop-i:${step}}`,
      `[hops='${step + 1}']{--_hop-n:${step + 1}}`
    );
    stepSelectors.push(selector);
  }
  return (
    '@media (forced-colors: none) and (prefers-contrast: no-preference){' +
    stepRules.join('') +
    formula.replace('::highlight(hue-hop-K)', stepSelectors.join(',')) +
    '}'
  );
}

function adoptOnce(root, sheet) {
  if (!root.adoptedStyleSheets.includes(sheet)) {
    root.adoptedStyleSheets.push(sheet);
  }
}

function rootStyleFor(root) {
  let rootStyle = rootStyles.get(root);
  if (!rootStyle) {
    rootStyle = {
      sheet: new CSSStyleSheet(),
      attributeSheet: new CSSStyleSheet(),
      selectors: new Set(),
      tags: new Set(),
      longest: 0,
    };
    rootStyles.set(root, rootStyle);
  }
  // Some hosts reassign adoptedStyleSheets on update, dropping the sheets.
  for (const sheet of [rootStyle.sheet, rootStyle.attributeSheet]) {
    adoptOnce(root, sheet);
  }
  return rootStyle;
}

function adoptHues(element) {
  let root = element.shadowRoot;
  if (!root) {
    try {
      root = element.attachShadow({ mode: 'open' });
    } catch {
      // A subclass's closed root can't be reached, so it goes without the hues.
      return;
    }
    root.append(document.createElement('slot'));
  }
  adoptOnce(root, hueSheet);
}

function writeAttributeRules(element, rootStyle) {
  const { attributeSheet, selectors } = rootStyle;
  for (const name of colorAttributes) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const selector = `${element.localName}[${name}="${CSS.escape(value)}"]`;
    if (selectors.has(selector)) continue;
    selectors.add(selector);
    const index = attributeSheet.insertRule(
      `${selector}{}`,
      attributeSheet.cssRules.length
    );
    attributeSheet.cssRules[index].style.setProperty(`--hop-${name}`, value);
  }
}

function applyColorAttributes(element) {
  const root = element.getRootNode();
  const rootStyle = rootStyleFor(root);
  rootStyle.tags.add(element.localName);
  // Every old value left in the sheet slows each later restyle, so rebuild from the live elements.
  if (rootStyle.selectors.size >= mostRulesPerRoot) {
    rootStyle.selectors.clear();
    rootStyle.attributeSheet.replaceSync('');
    const liveHops = root.querySelectorAll([...rootStyle.tags].join());
    for (const hop of liveHops) writeAttributeRules(hop, rootStyle);
  }
  writeAttributeRules(element, rootStyle);
}

// A framework can set el.start before the element is defined. That leaves an own property hiding the setter.
function replayEarlyProperty(element, name) {
  if (!element.hasOwnProperty(name)) return;
  const value = element[name];
  delete element[name];
  element[name] = value;
}

function setOrRemoveAttribute(element, name, value) {
  if (value == null) element.removeAttribute(name);
  else element.setAttribute(name, String(value));
}

function paint(element) {
  const data = elementData.get(element);
  const previousHops = hopsFor(data.ranges.length);
  clearRanges(data);

  for (const node of ownTextNodes(element)) {
    for (const { segment, index } of segmenter.segment(node.data)) {
      if (isBlank.test(segment)) continue;
      data.ranges.push(
        new StaticRange({
          startContainer: node,
          startOffset: index,
          endContainer: node,
          endOffset: index + segment.length,
        })
      );
    }
  }

  const letterCount = data.ranges.length;
  // Under forced colors Chromium boxes every registered range in the system Highlight color, and no CSS can override it.
  if (!forcedColors.matches) {
    for (const [index, range] of data.ranges.entries()) {
      highlightAt(stepAt(index, letterCount)).add(range);
    }
  }

  const hops = hopsFor(letterCount);
  // Output only: never read or observed, so writing it can't trigger a repaint.
  if (hops !== previousHops) element.setAttribute('hops', String(hops));

  const rootStyle = rootStyleFor(element.getRootNode());
  if (hops > rootStyle.longest) {
    rootStyle.longest = hops;
    rootStyle.sheet.replaceSync(sheetText(hops));
  }

  boxWatcher.observe(element);
}

// Server renderers import components without a DOM, so the class needs a base that exists there.
const BaseElement = globalThis.HTMLElement ?? class {};

export class HueHop extends BaseElement {
  static get observedAttributes() {
    return colorAttributes;
  }

  get hops() {
    return hopsFor(elementData.get(this)?.ranges.length ?? 0);
  }

  get start() {
    return this.getAttribute('start');
  }

  set start(value) {
    setOrRemoveAttribute(this, 'start', value);
  }

  get end() {
    return this.getAttribute('end');
  }

  set end(value) {
    setOrRemoveAttribute(this, 'end', value);
  }

  attributeChangedCallback() {
    if (hasSupport && this.isConnected) applyColorAttributes(this);
  }

  connectedCallback() {
    for (const name of colorAttributes) replayEarlyProperty(this, name);
    if (!hasSupport) return;
    adoptHues(this);
    let data = elementData.get(this);
    if (!data) {
      data = {
        observer: new MutationObserver(() => paint(this)),
        ranges: [],
      };
      elementData.set(this, data);
    }
    applyColorAttributes(this);
    paint(this);
    connectedHops.add(this);
    data.observer.observe(this, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  disconnectedCallback() {
    const data = elementData.get(this);
    if (!data) return;
    data.observer.disconnect();
    boxWatcher.unobserve(this);
    data.hadNoBox = false;
    connectedHops.delete(this);
    clearRanges(data);
  }
}

if (hasSupport) {
  hueSheet.replaceSync(hues);
  forcedColors.addEventListener('change', () => {
    for (const hop of connectedHops) paint(hop);
  });
}

if (globalThis.customElements && !customElements.get('hue-hop')) {
  customElements.define('hue-hop', HueHop);
}
