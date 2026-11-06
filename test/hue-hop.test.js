import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, firefox, webkit } from 'playwright';

const engine = { chromium, firefox, webkit }[process.env.BROWSER ?? 'chromium'];

let browser;

before(async () => {
  browser = await engine.launch();
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

test('a hue colors the element with only the script loaded', async () => {
  const rows = [
    ['hue-hop', 'Nas', false],
    ['my-hop', 'Nas', false],
    ['hue-hop', '<svg></svg>', false],
    ['own-root', 'Nas', true],
  ];
  for (const [tag, content, hasOwnRoot] of rows) {
    const page = await openPage(
      `<${tag} id="t" hue="dusk">${content}</${tag}>`
    );
    const ends = await page.evaluate(
      async ([tag, hasOwnRoot]) => {
        if (!customElements.get(tag)) {
          class Subclass extends customElements.get('hue-hop') {
            constructor() {
              super();
              if (hasOwnRoot) {
                this.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>';
              }
            }
          }
          customElements.define(tag, Subclass);
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const style = getComputedStyle(document.getElementById('t'));
        return [
          style.getPropertyValue('--hop-start'),
          style.getPropertyValue('--hop-end'),
        ];
      },
      [tag, hasOwnRoot]
    );
    assert.ok(ends[0].includes('oklch'), `${tag} ${content} start: ${ends[0]}`);
    assert.ok(ends[1].includes('oklch'), `${tag} ${content} end: ${ends[1]}`);
  }
});

test('page css beats a hue, and a hue beats inherited values', async () => {
  const hop = '<hue-hop id="t" class="x" hue="dusk">Nas</hue-hop>';
  const rows = [
    ['layered rule', '@layer theme { hue-hop { --hop-start: red } }', 'red'],
    ['layered utility', '@layer utilities { .x { --hop-start: red } }', 'red'],
    ['unlayered rule', 'hue-hop { --hop-start: red }', 'red'],
    ['unlayered :root', ':root { --hop-start: red }', 'oklch'],
    ['layered :root', '@layer theme { :root { --hop-start: red } }', 'oklch'],
  ];
  for (const [name, css, expected] of rows) {
    const page = await openPage(`<style>${css}</style>${hop}`);
    const start = await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return getComputedStyle(document.getElementById('t')).getPropertyValue(
        '--hop-start'
      );
    });
    assert.ok(start.includes(expected), `${name}: ${start}`);
  }
});

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

test('forced colors holds back every range until it turns off', async () => {
  const page = await openPage('<hue-hop id="t">Alpha</hue-hop>');

  await page.emulateMedia({ forcedColors: 'active' });
  const whenTurnedOn = await rangesOf(page, '#t');
  assert.deepEqual(whenTurnedOn.texts, []);
  assert.equal(whenTurnedOn.hops, 5);

  await page.evaluate(() => {
    document.getElementById('t').firstChild.data = 'Echo';
  });
  const afterEdit = await rangesOf(page, '#t');
  assert.deepEqual(afterEdit.texts, []);
  assert.equal(afterEdit.hops, 4);

  await page.emulateMedia({ forcedColors: 'none' });
  const whenTurnedOff = await rangesOf(page, '#t');
  assert.deepEqual(whenTurnedOff.texts, ['E', 'c', 'h', 'o']);
});
