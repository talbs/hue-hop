import { readFileSync } from 'node:fs';
import { readSide, showSide } from '../site/js/scheme.js';
import { escapeHtml } from '../site/js/state.js';
import { DOCS_URL, REPO_URL, SITE_URL, STUDIO_URL } from '../site/js/urls.js';
import { AGENT_RULES, ASSISTANT_PROMPT, DOCS_GROUPS } from './copy.js';
import { compileExamples, fillCopyButtons } from './examples.js';
import { attributeRows, cssPropertyRows, propertyRows } from './manifest.js';
import {
  isStudioUrl,
  keepGroupsOnTransform,
  markStudioMoveArriving,
  markStudioMoveLeaving,
  rememberClickedLink,
} from './page-move-boot.js';

// Keep the kit restricted to talbs.github.io and localhost: the code ships in public HTML.
const FA_KIT = '7ce624a355';

// Inline: a page can reach its first paint before a stylesheet's copy of this rule registers, and then it gets no transition.
const VIEW_TRANSITION_RULE = `<style>
  @media (prefers-reduced-motion: no-preference) {
    @view-transition {
      navigation: auto;
      types: page-move;
    }
  }
</style>`;

export const PAGES = [
  { source: 'index.html', output: 'index.html', root: './', navName: 'home' },
  {
    source: 'docs.html',
    output: 'docs/index.html',
    root: '../',
    navName: 'docs',
  },
  {
    source: 'studio.html',
    output: 'studio/index.html',
    root: '../',
    navName: 'studio',
  },
  { source: '404.html', output: '404.html', root: SITE_URL, navName: '404' },
];

const WA_THEME =
  'node_modules/@awesome.me/webawesome/dist/styles/themes/default.css';
const WA_SCALE_TOKEN =
  /--wa-(?:space|border-radius|line-height)-[\w-]+:[^;]+;/g;
const FONT_FACE = /@font-face\s*\{[^}]*\}\s*/g;

export const read = (path) => readFileSync(path, 'utf8');

function docsNav(groups) {
  const groupBlocks = [];
  for (const [label, links] of groups) {
    const items = links.map(
      ([title, hash]) =>
        `<li><a class="hop-link is-quiet" href="${hash}">${escapeHtml(title)}</a></li>`
    );
    groupBlocks.push(
      `<div class="wa-stack wa-gap-xs">\n<p class="readout-label">${escapeHtml(label)}</p>\n<ul class="wa-list-plain">\n${items.join('\n')}\n</ul>\n</div>`
    );
  }
  return groupBlocks.join('\n');
}

// For the 404 page, which loads no stylesheets or fonts: GitHub Pages serves it at any path, so a relative link can't resolve. tokens.css aliases Web Awesome's scale, which normally arrives with webawesome.css.
function inlineCss() {
  const waScale = read(WA_THEME).match(WA_SCALE_TOKEN).join('\n');
  const tokens = read('site/css/tokens.css').replace(FONT_FACE, '');
  const base = read('site/css/base.css');
  return `<style>\n:root {\n${waScale}\n}\n${tokens}\n${base}</style>`;
}

export function readFills(manifest) {
  const version = JSON.parse(read('package.json')).version;
  const [major, minor] = version.split('.');
  return {
    head: read('site/partials/head.html'),
    header: read('site/partials/header.html'),
    footer: read('site/partials/footer.html'),
    wordmark: read('site/partials/wordmark.html'),
    'sample-titles': read('site/partials/sample-titles.html'),
    'wordmark-steps': wordmarkSteps(),
    'fa-kit': FA_KIT,
    version,
    'cdn-version': `hue-hop@${major}.${minor}`,
    'docs-url': DOCS_URL,
    'repo-url': REPO_URL,
    'studio-url': STUDIO_URL,
    'attribute-rows': attributeRows(manifest),
    'property-rows': propertyRows(manifest),
    'css-property-rows': cssPropertyRows(manifest),
    'assistant-prompt': escapeHtml(ASSISTANT_PROMPT),
    'agent-rules': escapeHtml(AGENT_RULES),
    'docs-nav': docsNav(DOCS_GROUPS),
    'inline-css': inlineCss(),
    'side-boot': `<script>\n${readSide}\n${showSide}\nshowSide(readSide());\n${isStudioUrl}\n${rememberClickedLink}\n${markStudioMoveLeaving}\n${markStudioMoveArriving}\n${keepGroupsOnTransform}\naddEventListener('click', rememberClickedLink, true);\naddEventListener('pageswap', markStudioMoveLeaving);\naddEventListener('pagereveal', markStudioMoveArriving);\naddEventListener('pagereveal', keepGroupsOnTransform);\n</script>\n${VIEW_TRANSITION_RULE}`,
  };
}

// A fill can hold placeholders of its own (a partial, or {{root}} in the docs URL), so fill until nothing changes.
function fillPage(html, navName, fills) {
  let page = html;
  let previous;
  while (page !== previous) {
    previous = page;
    for (const [name, text] of Object.entries(fills)) {
      page = page.replaceAll(`{{${name}}}`, text);
    }
  }
  const leftover = page.match(/\{\{[\w-]+\}\}/);
  if (leftover) throw new Error(`Unfilled placeholder ${leftover[0]}`);
  return page.replace(
    `data-nav="${navName}"`,
    `data-nav="${navName}" aria-current="page"`
  );
}

// The vector wordmark's letters take their fills from the element's own formula, so they step, drift and switch sides like live text.
function wordmarkSteps() {
  const formula = read('src/formula.css');
  const placeholder = '::highlight(hue-hop-K)';
  if (!formula.includes(placeholder)) {
    throw new Error(`src/formula.css no longer has ${placeholder}`);
  }
  const steps = formula.replace(placeholder, '.wordmark path');
  return `@media (forced-colors: none) and (prefers-contrast: no-preference) {\n${steps}}`;
}

// Prettier puts inline tags on their own lines, and that line break renders as a space before trailing punctuation.
const SPACE_BEFORE_PUNCTUATION =
  /(<\/(?:a|code|strong|em|hue-hop)>)\s+(?=[.,;:!?)])/g;
const SPACE_AFTER_PAREN = /\(\s+(?=<(?:a|code|strong|em|hue-hop)[\s>])/g;

// Prettier breaks long tags across lines, and that space would stretch a link's underline past its words, sit before punctuation, or widen the gap before a heading's anchor.
const SPACE_INSIDE_TAG_START = /(<(?:a|hue-hop)\b[^>]*>)\s+(?=[^<\s]|<code\b)/g;
const SPACE_INSIDE_TAG_END =
  /(?:(?<=[^>\s])|(?<=<\/code>))\s+(<\/(?:a|hue-hop|h2|h3)>)/g;

function closeUpPunctuation(html) {
  return html
    .replace(SPACE_BEFORE_PUNCTUATION, '$1')
    .replace(SPACE_AFTER_PAREN, '(')
    .replace(SPACE_INSIDE_TAG_START, '$1')
    .replace(SPACE_INSIDE_TAG_END, '$1');
}

export function renderPage(entry, fills) {
  const source = read(`site/${entry.source}`);
  const page = fillPage(source, entry.navName, { ...fills, root: entry.root });
  return fillCopyButtons(compileExamples(closeUpPunctuation(page)));
}
