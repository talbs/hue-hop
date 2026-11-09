import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium, firefox, webkit } from 'playwright';
import { PAGES, readFills, renderPage } from '../scripts/pages.js';

const SITE_URL = 'https://huehop.dev/';

const pages = [
  ['_site/index.html', SITE_URL],
  ['_site/docs/index.html', `${SITE_URL}docs/`],
  ['_site/studio/index.html', `${SITE_URL}studio/`],
];

const engine = { chromium, firefox, webkit }[process.env.BROWSER ?? 'chromium'];

let browser;

before(async () => {
  execFileSync('node', ['scripts/site.js']);
  browser = await engine.launch();
});

after(async () => {
  await browser.close();
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

test('?stats=off opts a browser out of Umami, and ?stats=on puts it back', async () => {
  const page = await browser.newPage();
  await page.route('**/js/track.js', (route) =>
    route.fulfill({ path: 'site/js/track.js', contentType: 'text/javascript' })
  );
  await page.route(`${SITE_URL}docs/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<script type="module" src="/js/track.js"></script>',
    })
  );
  const readOptOut = () =>
    page.evaluate(() => localStorage.getItem('umami.disabled'));

  await page.goto(`${SITE_URL}docs/?stats=off#stats`);
  assert.equal(await readOptOut(), '1');
  assert.equal(page.url(), `${SITE_URL}docs/#stats`);

  await page.goto(`${SITE_URL}docs/?stats=on`);
  assert.equal(await readOptOut(), null);
  assert.equal(page.url(), `${SITE_URL}docs/`);
});
