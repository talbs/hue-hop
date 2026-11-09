import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('every attribute has a property that reflects it, even set before define', async () => {
  const rows = [
    ['start', 'red', 'red', 'red'],
    ['hue', 'reef', 'reef', 'reef'],
    ['hue', null, null, null],
    ['display', true, '', true],
    ['drift', false, null, false],
  ];
  for (const [name, value, expectedAttribute, readBack] of rows) {
    const page = await browser.newPage();
    await page.setContent('<hue-hop id="t" hue="dusk" drift>Nas</hue-hop>');
    await page.evaluate(
      ([name, value]) => {
        document.getElementById('t')[name] = value;
      },
      [name, value]
    );
    await page.addScriptTag({ path: 'dist/hue-hop.js', type: 'module' });
    const [attribute, property] = await page.evaluate((name) => {
      const element = document.getElementById('t');
      return [element.getAttribute(name), element[name]];
    }, name);
    assert.equal(attribute, expectedAttribute, `${name} = ${value}`);
    assert.equal(property, readBack, `${name} = ${value}`);
  }
});

test('the element entry exports the class without defining the tag', async () => {
  const page = await browser.newPage();
  await page.setContent('<my-hop id="t" hue="dusk">Nas</my-hop>');
  const code = await readFile('dist/element.js', 'utf8');
  const [isBaseTagDefined, hops] = await page.evaluate(async (code) => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const { HueHop } = await import(URL.createObjectURL(blob));
    customElements.define('my-hop', class extends HueHop {});
    return [
      Boolean(customElements.get('hue-hop')),
      document.getElementById('t').hops,
    ];
  }, code);
  assert.equal(isBaseTagDefined, false);
  assert.equal(hops, 3);
});

test('importing without a dom does not throw', async () => {
  const { HueHop } = await import('../dist/hue-hop.js');
  assert.equal(typeof HueHop, 'function');
});

test('a subclass and the base tag both color on one page', async () => {
  const rows = [
    ['base first', ['hue-hop', 'my-hop']],
    ['subclass first', ['my-hop', 'hue-hop']],
  ];
  const textByTag = { 'hue-hop': 'Short', 'my-hop': 'Much longer text' };
  for (const [name, tags] of rows) {
    const page = await openPage(
      tags
        .map((tag) => `<${tag} hue="dusk">${textByTag[tag]}</${tag}>`)
        .join('')
    );
    const firstLetterColors = await page.evaluate(async (tags) => {
      customElements.define(
        'my-hop',
        class extends customElements.get('hue-hop') {}
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return tags.map(
        (tag) =>
          getComputedStyle(
            document.querySelector(tag),
            '::highlight(hue-hop-0)'
          ).color
      );
    }, tags);
    for (const color of firstLetterColors) {
      assert.ok(color.includes('oklch'), `${name}: ${firstLetterColors}`);
    }
  }
});

test('page css beats a hue, and a hue beats inherited values', async () => {
  const hop = '<hue-hop id="t" class="x" hue="dusk">Nas</hue-hop>';
  const colorsOf = async (css) => {
    const page = await openPage(`<style>${css}</style>${hop}`);
    return page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const element = document.getElementById('t');
      return {
        start: getComputedStyle(element).getPropertyValue('--hop-start'),
        middle: getComputedStyle(element, '::highlight(hue-hop-1)').color,
      };
    });
  };
  const plain = await colorsOf('');
  const rows = [
    ['layered rule', '@layer theme { hue-hop { --hop-start: red } }', 'red'],
    ['layered utility', '@layer utilities { .x { --hop-start: red } }', 'red'],
    ['unlayered rule', 'hue-hop { --hop-start: red }', 'red'],
    ['unlayered :root', ':root { --hop-start: red }', 'oklch'],
    ['layered :root', '@layer theme { :root { --hop-start: red } }', 'oklch'],
    ['inherited boost', ':root { --hop-boost: 0.2 }', 'oklch', true],
  ];
  for (const [name, css, expected, isMiddleBoosted] of rows) {
    const { start, middle } = await colorsOf(css);
    assert.ok(start.includes(expected), `${name}: ${start}`);
    if (isMiddleBoosted) {
      assert.notEqual(middle, plain.middle, `${name}: ${middle}`);
    }
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
      hasHopsAttribute: element.hasAttribute('hops'),
      hops: element.hops,
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
    const { hasHopsAttribute, hops, indexes, texts } = await rangesOf(
      page,
      '#t'
    );
    assert.deepEqual(texts, expected, name);
    assert.equal(hops, stepCount, name);
    assert.equal(hasHopsAttribute, false, name);
    assert.deepEqual(indexes, steps, name);
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
    const { hops, texts } = await rangesOf(page, '#t');
    assert.deepEqual(texts, expected, name);
    assert.equal(hops, expected.length, name);
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

test('a hop recounts after a detached edit', async () => {
  const page = await openPage(
    '<hue-hop id="t" start="red" end="blue">Illmatic</hue-hop>'
  );
  const { hops, lastLetter, blue } = await page.evaluate(async () => {
    const element = document.getElementById('t');
    const parent = element.parentNode;
    element.remove();
    element.textContent = 'Nas';
    parent.append(element);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const probe = document.createElement('i');
    probe.style.color = 'oklch(from blue l c h)';
    document.body.append(probe);
    return {
      hops: element.hops,
      lastLetter: getComputedStyle(element, '::highlight(hue-hop-2)').color,
      blue: getComputedStyle(probe).color,
    };
  });
  assert.equal(hops, 3);
  const channels = (color) => color.match(/[\d.]+/g).map(Number);
  const [actual, expected] = [channels(lastLetter), channels(blue)];
  for (const [index, value] of expected.entries()) {
    assert.ok(
      Math.abs(actual[index] - value) < 0.01 * Math.max(1, value),
      `${lastLetter} vs ${blue}`
    );
  }
});

test('only a hop that had no box when it registered registers again', async () => {
  const hop = '<hue-hop>Alpha</hue-hop>';
  const below = '<div style="height: 3000px"></div>';
  const rows = [
    [
      'content-visibility: auto, offscreen',
      `${below}<div id="w" style="content-visibility: auto">${hop}</div>`,
      (w) => w.scrollIntoView(),
      true,
    ],
    [
      'content-visibility: hidden',
      `<div id="w" style="content-visibility: hidden">${hop}</div>`,
      (w) => {
        w.style.contentVisibility = 'visible';
      },
      true,
    ],
    [
      'display: none',
      `<div id="w" style="display: none">${hop}</div>`,
      (w) => {
        w.style.display = 'block';
      },
      true,
    ],
    [
      'closed details',
      `<details id="w">${hop}</details>`,
      (w) => {
        w.open = true;
      },
      true,
    ],
    [
      'below the fold, with a box',
      `${below}<div id="w">${hop}</div>`,
      (w) => w.scrollIntoView(),
      false,
    ],
    ['in view', `<div id="w">${hop}</div>`, () => {}, false],
  ];
  for (const [name, html, reveal, isRegisteredAgain] of rows) {
    const page = await openPage(html);
    const { kept, total } = await page.evaluate(`(async () => {
      const settle = async () => {
        for (let frame = 0; frame < 10; frame++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      };
      const liveRanges = () =>
        [...CSS.highlights.values()].flatMap((highlight) => [...highlight]);
      await settle();
      const before = liveRanges();
      (${reveal})(document.getElementById('w'));
      await settle();
      const after = liveRanges();
      return {
        kept: before.filter((range) => after.includes(range)).length,
        total: after.length,
      };
    })()`);
    assert.equal(total, 5, name);
    assert.equal(kept, isRegisteredAgain ? 0 : 5, name);
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
