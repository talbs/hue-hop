import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

let browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
});

async function openPage(html) {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.addScriptTag({ path: 'dist/hue-hop.js', type: 'module' });
  return page;
}

async function rangesOf(page, selector) {
  return page.evaluate(async (selector) => {
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    await nextFrame();
    await nextFrame();

    const element = document.querySelector(selector);
    const found = [];
    for (const [name, highlight] of CSS.highlights) {
      const match = /^hue-hop-(\d+)$/.exec(name);
      if (!match) continue;
      for (const range of highlight) {
        const container = range.startContainer;
        if (container.parentElement?.closest('hue-hop') !== element) continue;
        found.push({
          index: Number(match[1]),
          text: container.data.slice(range.startOffset, range.endOffset),
        });
      }
    }
    found.sort((a, b) => a.index - b.index);

    return {
      hops: element.hops,
      hopsAttribute: element.getAttribute('hops'),
      indexes: found.map((entry) => entry.index),
      texts: found.map((entry) => entry.text),
    };
  }, selector);
}

test('accessible name is the text, read once', async () => {
  const page = await openPage('<h1><hue-hop>Brian Talbot</hue-hop></h1>');
  assert.equal(
    await page.locator('h1').ariaSnapshot(),
    '- heading "Brian Talbot" [level=1]'
  );
});

test('steps graphemes into shared highlights', async () => {
  const rows = [
    ['ascii', 'Brian', ['B', 'r', 'i', 'a', 'n']],
    ['combining mark', 'Cafe\u0301', ['C', 'a', 'f', 'e\u0301']],
    ['flag', 'Hi 🇯🇵', ['H', 'i', '🇯🇵']],
    [
      'zwj emoji',
      '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}!',
      ['\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', '!'],
    ],
    ['inner whitespace', 'A  B\tC', ['A', 'B', 'C']],
    ['inline element', 'Br<b>ia</b>n', ['B', 'r', 'i', 'a', 'n']],
    [
      'invisible characters',
      'Ex\u200Btra\u00ADlong',
      ['E', 'x', 't', 'r', 'a', 'l', 'o', 'n', 'g'],
    ],
    ['nested hue-hop', 'ab<hue-hop>cd</hue-hop>e', ['a', 'b', 'e']],
    [
      'past 64 letters, two per step',
      'ab'.repeat(64),
      [...'ab'.repeat(64)],
      Array.from({ length: 128 }, (_, index) => Math.floor(index / 2)),
    ],
  ];
  for (const [name, html, expected, expectedIndexes] of rows) {
    const steps = expectedIndexes ?? expected.map((_, index) => index);
    const stepCount = steps.at(-1) + 1;
    const page = await openPage(`<hue-hop id="t">${html}</hue-hop>`);
    const { hops, hopsAttribute, indexes, texts } = await rangesOf(page, '#t');
    assert.deepEqual(texts, expected, name);
    assert.equal(hops, stepCount, name);
    assert.deepEqual(indexes, steps, name);
    assert.equal(hopsAttribute, String(stepCount), name);
  }
});

test('content changes re-step and leave no old ranges', async () => {
  const rows = [
    [
      'edit in place',
      (el) => {
        el.firstChild.data = 'Echo';
      },
      ['E', 'c', 'h', 'o'],
    ],
    [
      'replace the node',
      (el) => {
        el.replaceChildren('Bravo Charlie');
      },
      ['B', 'r', 'a', 'v', 'o', 'C', 'h', 'a', 'r', 'l', 'i', 'e'],
    ],
    [
      'remove, re-append, then edit',
      async (el) => {
        const parent = el.parentNode;
        el.remove();
        parent.append(el);
        await new Promise((resolve) => setTimeout(resolve));
        el.firstChild.data = 'Golf';
      },
      ['G', 'o', 'l', 'f'],
    ],
    [
      'hostile start, then edit',
      (el) => {
        el.setAttribute('start', 'red} x{color:red"');
        el.firstChild.data = 'Echo';
      },
      ['E', 'c', 'h', 'o'],
    ],
  ];
  for (const [name, change, expected] of rows) {
    const page = await openPage('<h2><hue-hop id="t">Alpha</hue-hop></h2>');
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.evaluate(`(${change})(document.getElementById('t'))`);
    const { hops, hopsAttribute, texts } = await rangesOf(page, '#t');
    assert.deepEqual(texts, expected, name);
    assert.equal(hops, expected.length, name);
    assert.equal(hopsAttribute, String(expected.length), name);
    const stale = await page.evaluate(
      () =>
        [...CSS.highlights]
          .flatMap(([, h]) => [...h])
          .filter((r) => !r.startContainer.isConnected).length
    );
    assert.equal(stale, 0, name);
    assert.deepEqual(pageErrors, [], name);
  }
});
