import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { after, afterEach, before, test } from 'node:test';
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

afterEach(async () => {
  for (const context of browser.contexts()) await context.close();
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

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function openHome(browser) {
  const page = await browser.newPage();
  await page.route('**/*', (route) => {
    const { href, pathname } = new URL(route.request().url());
    if (!href.startsWith(SITE_URL)) return route.abort();
    const path = `_site${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`;
    if (!existsSync(path)) return route.fulfill({ status: 404 });
    const extension = path.slice(path.lastIndexOf('.'));
    return route.fulfill({ path, contentType: CONTENT_TYPES[extension] });
  });
  await page.goto(SITE_URL);
  await page.waitForFunction(
    () => document.getElementById('markup')?.textContent
  );
  return page;
}

test('the hero writes the markup and Studio links its controls describe', async () => {
  const page = await openHome(browser);
  const read = () =>
    page.evaluate(async () => {
      const nextFrame = () =>
        new Promise((resolve) => requestAnimationFrame(resolve));
      await nextFrame();
      await nextFrame();
      const query = (id) =>
        Object.fromEntries(
          new URL(document.getElementById(id).href).searchParams
        );
      return {
        markup: document.getElementById('markup').textContent,
        studio: query('studio-link'),
        custom: query('custom-link'),
      };
    });

  assert.deepEqual(await read(), {
    markup: '<hue-hop hue="dusk">Hue Hop</hue-hop>',
    studio: { text: 'Hue Hop' },
    custom: { text: 'Hue Hop', hue: 'custom', from: 'dusk' },
  });

  await page.locator('#desk-text input').fill('Juicy');
  await page.locator('.hue-chip[data-hue="guava"]').click();
  await page.locator('#toggle-drift').click();
  await page.locator('#toggle-display').click();

  assert.deepEqual(await read(), {
    markup: '<hue-hop hue="guava" display drift>Juicy</hue-hop>',
    studio: { text: 'Juicy', hue: 'guava', drift: '1', display: '1' },
    custom: { text: 'Juicy', hue: 'custom', from: 'guava', drift: '1' },
  });
});
