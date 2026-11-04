import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import * as esbuild from 'esbuild';
import { readSide, showSide } from '../site/js/scheme.js';
import { escapeHtml } from '../site/js/state.js';
import { DOCS_URL, REPO_URL, SITE_URL, STUDIO_URL } from '../site/js/urls.js';
import { checkAnchors } from './anchors.js';
import {
  AGENT_RULES,
  ASSISTANT_PROMPT,
  DOCS_GROUPS,
  DOCS_LINKS,
  LLMS_RULES,
} from './copy.js';
import { compileExamples, fillCopyButtons } from './examples.js';
import {
  attributeRows,
  cssPropertyRows,
  llmsText,
  propertyRows,
} from './manifest.js';

// Keep the kit restricted to talbs.github.io and localhost: the code ships in public HTML.
const FA_KIT = '7ce624a355';

const SERVE_PORT = 4174;

const PAGES = [
  { source: 'index.html', output: 'index.html', root: './', navName: 'home' },
  {
    source: 'docs.html',
    output: 'docs/index.html',
    root: '../',
    navName: 'docs',
  },
  { source: '404.html', output: '404.html', root: SITE_URL, navName: '404' },
];

const WA_THEME =
  'node_modules/@awesome.me/webawesome/dist/styles/themes/default.css';
const WA_SCALE_TOKEN =
  /--wa-(?:space|border-radius|line-height)-[\w-]+:[^;]+;/g;
const FONT_FACE = /@font-face\s*\{[^}]*\}\s*/g;

const read = (path) => readFileSync(path, 'utf8');

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

function readFills(manifest) {
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
    'side-boot': `<script>\n${readSide}\n${showSide}\nshowSide(readSide());\n</script>`,
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

async function buildSite() {
  rmSync('_site', { recursive: true, force: true });
  mkdirSync('_site');

  const manifest = JSON.parse(read('custom-elements.json'));
  const fills = readFills(manifest);
  const builtPages = {};
  for (const { source, output, root, navName } of PAGES) {
    const outputPath = `_site/${output}`;
    mkdirSync(dirname(outputPath), { recursive: true });
    const page = closeUpPunctuation(
      fillPage(read(`site/${source}`), navName, { ...fills, root })
    );
    builtPages[source] = fillCopyButtons(compileExamples(page));
    writeFileSync(outputPath, builtPages[source]);
    console.log('wrote', outputPath);
  }

  const llms = llmsText({
    manifest,
    version: fills.version,
    cdnVersion: fills['cdn-version'],
    siteUrl: SITE_URL,
    studioUrl: STUDIO_URL,
    rules: LLMS_RULES,
    docsLinks: DOCS_LINKS,
  });
  writeFileSync('_site/llms.txt', llms);
  console.log('wrote _site/llms.txt');

  cpSync('site/css', '_site/css', { recursive: true });
  cpSync('site/js', '_site/js', {
    recursive: true,
    filter: (path) => !path.endsWith('wa.js'),
  });
  cpSync('site/fonts', '_site/fonts', { recursive: true });
  cpSync('site/icons', '_site/icons', { recursive: true });
  cpSync('dist', '_site/dist', { recursive: true });
  cpSync('node_modules/microlighter/dist', '_site/js/microlighter', {
    recursive: true,
    filter: (path) => !path.endsWith('.d.ts'),
  });

  await esbuild.build({
    entryPoints: ['site/js/wa.js'],
    outfile: '_site/js/wa.js',
    bundle: true,
    format: 'esm',
    minify: true,
    logLevel: 'warning',
  });

  // No native.css: it would restyle the desk's own buttons and inputs.
  await esbuild.build({
    stdin: {
      contents: [
        "@import '@awesome.me/webawesome/dist/styles/layers.css';",
        "@import '@awesome.me/webawesome/dist/styles/themes/default.css';",
        "@import '@awesome.me/webawesome/dist/styles/utilities.css';",
      ].join('\n'),
      resolveDir: '.',
      loader: 'css',
    },
    outfile: '_site/css/webawesome.css',
    bundle: true,
    minify: true,
    logLevel: 'warning',
  });

  console.log('wrote _site/css, _site/js, _site/fonts, _site/dist');

  const { 'docs.html': docsHtml, ...otherPages } = builtPages;
  const anchorCount = checkAnchors({
    docsHtml,
    pages: Object.values(otherPages),
    llmsText: llms,
    readmeText: read('README.md'),
    siteUrl: SITE_URL,
  });
  console.log(`checked ${anchorCount} docs anchors`);
}

async function serveAndWatch() {
  const context = await esbuild.context({});
  await context.serve({
    servedir: '_site',
    host: '127.0.0.1',
    port: SERVE_PORT,
  });
  console.log(
    `serving http://localhost:${SERVE_PORT}/ (reload after each rebuild)`
  );

  let pending;
  const rebuildAfter = (isElementChange) => {
    clearTimeout(pending);
    pending = setTimeout(async () => {
      try {
        if (isElementChange)
          execFileSync('node', ['scripts/build.js'], { stdio: 'inherit' });
        await buildSite();
      } catch (error) {
        console.error(error.message);
      }
    }, 100);
  };
  watch('site', { recursive: true }, () => rebuildAfter(false));
  watch('src', { recursive: true }, () => rebuildAfter(true));
}

await buildSite();
if (process.argv.includes('--serve')) await serveAndWatch();
