import { readFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { readSide, showSide } from '../site/js/scheme.js';
import { escapeHtml } from '../site/js/state.js';
import { DOCS_URL, REPO_URL, SITE_URL, STUDIO_URL } from '../site/js/urls.js';
import { AGENT_RULES, ASSISTANT_PROMPT, DOCS_GROUPS } from './copy.js';
import { compileExamples, fillCopyButtons } from './examples.js';
import {
  attributeRows,
  cssPropertyRows,
  listedHues,
  propertyRows,
} from './manifest.js';
import { keepGroupsOnTransform } from './page-move-boot.js';
import { SOCIAL_IMAGE_SIZE } from './social-image.js';

// Keep the kit restricted to huehop.dev and localhost: the code ships in public HTML.
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
  {
    source: 'index.html',
    output: 'index.html',
    root: './',
    navName: 'home',
    stylesheets: ['chips.css', 'desk.css', 'wild.css', 'quickstart.css'],
    url: SITE_URL,
    title: 'Hue Hop',
    description:
      'Give each letter of a heading or name its own color, stepped from one color to another.',
  },
  {
    source: 'docs.html',
    output: 'docs/index.html',
    root: '../',
    navName: 'docs',
    stylesheets: ['docs.css'],
    url: `${SITE_URL}docs/`,
    title: 'Hue Hop Docs',
    description:
      'How to load Hue Hop, color a heading, tune the steps, and fit it into your app.',
  },
  {
    source: 'studio.html',
    output: 'studio/index.html',
    root: '../',
    navName: 'studio',
    stylesheets: ['chips.css', 'studio.css'],
    url: `${SITE_URL}studio/`,
    title: 'Hue Hop Studio',
    description:
      'Make a pair of your own, check every letter on your light and dark pages, and copy the code.',
  },
  {
    source: '404.html',
    output: '404.html',
    root: SITE_URL,
    navName: '404',
    stylesheets: ['desk.css', 'lost.css'],
    title: 'Not Found · Hue Hop',
    description: 'This page doesn’t exist. The hues do.',
    fills: { 'element-script': '{{inline-element-script}}', 'link-card': '' },
  },
];

const SHARED_STYLESHEETS = [
  'tokens.css',
  'base.css',
  'shell.css',
  'syntax.css',
  'controls.css',
];

export const SOCIAL_IMAGE_FILE = 'social.jpg';
const SOCIAL_IMAGE_ALT =
  'The Hue Hop wordmark, each letter one step from sky blue to violet, over faint equalizer bars that step through the same colors.';

export const read = (path) => readFileSync(path, 'utf8');

// Inline, the map's relative URL would resolve against whatever page is showing.
const withoutSourceMapComment = (code) =>
  code.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '');

const readDarkSurface = () =>
  read('site/css/tokens.css').match(/--surface: (#\w+);/)[1];

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

export function readFills(manifest) {
  const version = JSON.parse(read('package.json')).version;
  const [major, minor] = version.split('.');
  return {
    head: read('site/partials/head.html'),
    'skip-link': read('site/partials/skip-link.html'),
    header: read('site/partials/header.html'),
    footer: read('site/partials/footer.html'),
    wordmark: read('site/partials/wordmark.html'),
    'sample-titles': read('site/partials/sample-titles.html'),
    'wordmark-steps': wordmarkSteps(),
    'link-card': read('site/partials/link-card.html'),
    'dark-surface': readDarkSurface(),
    'social-image-url': `${SITE_URL}${SOCIAL_IMAGE_FILE}`,
    'social-image-width': String(SOCIAL_IMAGE_SIZE.width),
    'social-image-height': String(SOCIAL_IMAGE_SIZE.height),
    'social-image-alt': escapeHtml(SOCIAL_IMAGE_ALT),
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
    'hue-end-tabs': hueEndTabs(listedHues(manifest)),
    'element-script':
      '<script type="module" src="{{root}}dist/hue-hop.js"></script>',
    // The 404's stage renders even if a module request to the site is slow.
    'inline-element-script': `<script type="module">\n${withoutSourceMapComment(read('dist/hue-hop.js'))}\n</script>`,
    'side-boot': `<script>\n${readSide}\n${showSide}\nshowSide(readSide());\n${keepGroupsOnTransform}\naddEventListener('pagereveal', keepGroupsOnTransform);\n</script>\n${VIEW_TRANSITION_RULE}`,
  };
}

const HUE_ENDS =
  /:where\(hue-hop\[hue='(\w+)'\]\)\s*\{\s*--hop-start:\s*([^;]+);\s*--hop-end:\s*([^;]+);/g;

// Read from the element's own hue rules, so the docs can't fall behind a retuned hue.
function hueEndTabs(listed) {
  const hues = [...read('src/hues.css').matchAll(HUE_ENDS)].filter(([, name]) =>
    listed.includes(name)
  );
  if (hues.length === 0) {
    throw new Error('src/hues.css no longer has hue rules this can read');
  }
  const tabs = [];
  const panels = [];
  for (const [index, [, name, start, end]] of hues.entries()) {
    const active = index === 0 ? ' active' : '';
    const id = `docs-hue-ends-${name}`;
    const code = `.playlist {\n  --hop-start: ${start};\n  --hop-end: ${end};\n}`;
    tabs.push(`<wa-tab slot="nav" panel="${name}"${active}>${name}</wa-tab>`);
    panels.push(
      [
        `<wa-tab-panel name="${name}"${active}>`,
        '<div class="code-well">',
        '<p class="code-label readout-label">In your CSS</p>',
        `<pre class="code-block"><code class="language-css" id="${id}">${escapeHtml(code)}</code></pre>`,
        `<wa-copy-button class="code-copy" from="${id}" copy-label="Copy CSS"></wa-copy-button>`,
        '</div>',
        '</wa-tab-panel>',
      ].join('\n')
    );
  }
  return `<wa-tab-group class="install-tabs">\n${tabs.join('\n')}\n${panels.join('\n')}\n</wa-tab-group>`;
}

// A fill can hold placeholders of its own (a partial, or {{root}} in the docs URL), so fill until nothing changes.
function fillPage(html, navName, fills) {
  let page = html;
  let previous;
  while (page !== previous) {
    previous = page;
    for (const [name, text] of Object.entries(fills)) {
      // A function, because a fill can be minified JavaScript, and a string replacement would read its $ sequences as patterns.
      page = page.replaceAll(`{{${name}}}`, () => text);
    }
  }
  const leftover = page.match(/\{\{[\w-]+\}\}/);
  if (leftover) throw new Error(`Unfilled placeholder ${leftover[0]}`);
  return page.replace(
    `data-nav="${navName}"`,
    `data-nav="${navName}" aria-current="page"`
  );
}

// Vector art marked data-hop-steps (the wordmark, the social card's bars) takes its fills from the element's own formula, so it steps, drifts and switches sides like live text.
function wordmarkSteps() {
  const formula = read('src/formula.css');
  const placeholder = '::highlight(hue-hop-K)';
  if (!formula.includes(placeholder)) {
    throw new Error(`src/formula.css no longer has ${placeholder}`);
  }
  const steps = formula.replace(placeholder, '[data-hop-steps] path');
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

// Inline, so a first paint waits on one stylesheet instead of several. The sheets' font paths are relative to site/css, which an inlined copy no longer is.
function pageCss(stylesheets) {
  const sources = [...SHARED_STYLESHEETS, ...stylesheets].map((file) =>
    read(`site/css/${file}`)
  );
  const { code } = esbuild.transformSync(sources.join('\n'), {
    loader: 'css',
    minify: true,
  });
  return code.replaceAll('../fonts/', '{{root}}fonts/');
}

export function renderPage(entry, fills) {
  const source = read(`site/${entry.source}`);
  const page = fillPage(source, entry.navName, {
    ...fills,
    root: entry.root,
    'page-css': pageCss(entry.stylesheets),
    'page-url': entry.url,
    'page-title': escapeHtml(entry.title),
    'page-description': escapeHtml(entry.description),
    ...entry.fills,
  });
  return fillCopyButtons(compileExamples(closeUpPunctuation(page)));
}
