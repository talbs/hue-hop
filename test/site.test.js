import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { before, test } from 'node:test';
import { PAGES, readFills, renderPage } from '../scripts/pages.js';

const SITE_URL = 'https://talbs.github.io/hue-hop/';

const pages = [
  ['_site/index.html', SITE_URL],
  ['_site/docs/index.html', `${SITE_URL}docs/`],
  ['_site/studio/index.html', `${SITE_URL}studio/`],
];

before(() => {
  execFileSync('node', ['scripts/site.js']);
});

function readMeta(html, property) {
  const pattern = new RegExp(
    `<meta\\s+property="${property}"\\s+content="([^"]+)"`
  );
  return html.match(pattern)?.[1];
}

test('link unfurlers get absolute urls for each page', () => {
  for (const [path, pageUrl] of pages) {
    const html = readFileSync(path, 'utf8');
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);

    assert.equal(canonical?.[1], pageUrl, `${path} canonical`);
    assert.equal(readMeta(html, 'og:url'), pageUrl, `${path} og:url`);

    const imageUrl = readMeta(html, 'og:image');
    assert.ok(imageUrl?.startsWith(SITE_URL), `${path} og:image is absolute`);
    assert.ok(
      existsSync(`_site/${imageUrl.slice(SITE_URL.length)}`),
      `${path} og:image is built`
    );
  }
});

test('the 404 renders the element from any path', () => {
  const manifest = JSON.parse(readFileSync('custom-elements.json', 'utf8'));
  const entry = PAGES.find((page) => page.source === '404.html');
  const html = renderPage(entry, readFills(manifest));
  assert.doesNotMatch(html, /(?:href|src)="\.\.?\//);
  assert.match(html, /<hue-hop[\s>]/);
  assert.match(
    html,
    /<script type="module">[\s\S]*?customElements\.define\(["']hue-hop["']/
  );
  assert.doesNotMatch(html, /src="[^"]*dist\/hue-hop\.js"/);
});
